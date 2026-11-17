-- Owner's changes of 2026-11-19:
--   1. Tickets: 5 numbers in every row AND 5 numbers in every column group
--      (left = columns 1–3, center = 4–6, right = 7–9).
--   2. Ticket count is chosen once per game (confirmed in the app) — no re-rolling.
--   3. Host can change WHICH prizes are on before every game, not only the amounts.
--   4. Joining needs the host's approval. Accepted mid-game → watch now, play next game.
--   5. Series can be unlimited (series_length = 0): it runs until the host ends it.

-- ─── 1. Ticket generator ──────────────────────────────────────────────────────
create or replace function public._generate_ticket()
returns smallint[]
language plpgsql volatile set search_path = ''
as $$
declare
  v_grid smallint[];
  v_col_count int[];
  v_cols smallint[];
  v_nums smallint[];
  v_col smallint;
  v_r int; v_c int; v_k int; v_lo int; v_hi int;
begin
  -- Pick 5 of 9 columns per row until every column is used at least once AND each
  -- column group (0–2, 3–5, 6–8) holds exactly 5 numbers.
  loop
    v_grid := array_fill(0::smallint, array[27]);
    v_col_count := array_fill(0, array[9]);
    for v_r in 0..2 loop
      v_cols := public._shuffled_range(0, 8, 5);
      foreach v_col in array v_cols loop
        v_grid[v_r * 9 + v_col + 1] := -1;
        v_col_count[v_col + 1] := v_col_count[v_col + 1] + 1;
      end loop;
    end loop;
    exit when not (0 = any (v_col_count))
      and v_col_count[1] + v_col_count[2] + v_col_count[3] = 5
      and v_col_count[4] + v_col_count[5] + v_col_count[6] = 5
      and v_col_count[7] + v_col_count[8] + v_col_count[9] = 5;
  end loop;

  for v_c in 0..8 loop
    v_lo := case when v_c = 0 then 1 else v_c * 10 end;
    v_hi := case when v_c = 8 then 90 else v_c * 10 + 9 end;
    select array_agg(x order by x) into v_nums
      from unnest(public._shuffled_range(v_lo, v_hi, v_col_count[v_c + 1])) x;
    v_k := 1;
    for v_r in 0..2 loop
      if v_grid[v_r * 9 + v_c + 1] = -1 then
        v_grid[v_r * 9 + v_c + 1] := v_nums[v_k];
        v_k := v_k + 1;
      end if;
    end loop;
  end loop;
  return v_grid;
end;
$$;

-- ─── 2. Tickets chosen once per game ──────────────────────────────────────────
create or replace function public.set_my_tickets(p_game uuid, p_count int)
returns setof public.tickets
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.games;
  v_have int;
  v_max_serial int;
  i int;
begin
  if p_count is null or p_count not between 1 and 4 then
    raise exception 'INVALID_TICKET_COUNT' using errcode = 'P0001';
  end if;
  select * into g from public.games where id = p_game for update;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.room_members where room_id = g.room_id and user_id = v_uid) then
    raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  if g.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001';
  end if;
  select count(*) into v_have from public.tickets where game_id = p_game and user_id = v_uid;
  if v_have > 0 then
    raise exception 'TICKETS_ALREADY_CHOSEN' using errcode = 'P0001';
  end if;

  select coalesce(max(serial), 0) into v_max_serial from public.tickets where game_id = p_game;
  for i in 1..p_count loop
    insert into public.tickets (game_id, user_id, serial, cells)
    values (p_game, v_uid, v_max_serial + i, public._generate_ticket());
  end loop;
  perform public._recount_game(p_game);
  return query select * from public.tickets where game_id = p_game and user_id = v_uid order by serial;
end;
$$;

-- ─── 3. Host picks this game's prizes AND amounts ─────────────────────────────
-- p_amounts = { prize: ₹ } for exactly the prizes this game should have (Full Housie
-- required); amounts must add up to the pot. The choice becomes the room's default for
-- the next game too.
create or replace function public.set_game_prizes(p_game uuid, p_amounts jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.games;
  r public.rooms;
  v_sum numeric := 0;
  v_key text;
  v_val text;
  v_amount numeric;
  v_template jsonb := '{}';
begin
  select * into g from public.games where id = p_game for update;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into r from public.rooms where id = g.room_id for update;
  if r.host_id is distinct from v_uid then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if g.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001';
  end if;
  perform public._validate_prizes(p_amounts);

  for v_key, v_val in select key, value from jsonb_each_text(p_amounts) loop
    v_amount := round(v_val::numeric, 2);
    v_sum := v_sum + v_amount;
    -- Keep the room's proportions for prizes it already had; sensible defaults otherwise.
    v_template := v_template || jsonb_build_object(v_key, coalesce(
      (r.prizes ->> v_key)::numeric,
      case when v_key = 'full_house' then 30 when v_key = 'fast_3' then 5 else 10 end));
  end loop;
  if v_sum <> g.pot then
    raise exception 'PRIZES_MUST_EQUAL_POT' using errcode = 'P0001';
  end if;

  delete from public.game_prizes where game_id = p_game and not (p_amounts ? prize::text);
  insert into public.game_prizes (game_id, prize, weight, amount)
  select p_game, key::public.prize_type, (v_template ->> key)::numeric, round(value::numeric, 2)
    from jsonb_each_text(p_amounts)
  on conflict (game_id, prize) do update set amount = excluded.amount, weight = excluded.weight;

  update public.rooms set prizes = v_template where id = r.id;
  update public.games set prizes_custom = true where id = p_game;
  perform public._broadcast(g.room_id, 'lobby', jsonb_build_object(
    'gameId', p_game, 'ticketCount', g.ticket_count, 'playerCount', g.player_count, 'pot', g.pot));
end;
$$;

-- ─── 4. Join requests ─────────────────────────────────────────────────────────
create table public.room_join_requests (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (room_id, user_id)
);
create index room_join_requests_pending_idx on public.room_join_requests (room_id) where status = 'pending';
alter table public.room_join_requests enable row level security;
revoke all on public.room_join_requests from anon, authenticated;

-- Asks to join; members (and the host) are let straight in. Returns 'member' | 'pending'.
create or replace function public._request_join(p_room uuid, p_uid uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room;
  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.room_members where room_id = p_room and user_id = p_uid) then
    return 'member';
  end if;
  if r.status <> 'open' then
    raise exception 'ROOM_ENDED' using errcode = 'P0001';
  end if;
  if r.member_count >= r.max_players then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;
  insert into public.room_join_requests (room_id, user_id) values (p_room, p_uid)
  on conflict (room_id, user_id) do update set status = 'pending', created_at = now(), decided_at = null;
  perform public._broadcast(p_room, 'join_request', jsonb_build_object(
    'userId', p_uid, 'name', (select display_name from public.profiles where id = p_uid)));
  return 'pending';
end;
$$;

drop function public.join_room_by_code(text);
create function public.join_room_by_code(p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  v_room uuid;
begin
  select id into v_room from public.rooms where code = upper(btrim(p_code));
  if v_room is null then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;
  return jsonb_build_object('roomId', v_room, 'status', public._request_join(v_room, v_uid));
end;
$$;

drop function public.join_public_room(uuid);
create function public.join_public_room(p_room uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if not exists (select 1 from public.rooms where id = p_room and visibility = 'public') then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;
  return jsonb_build_object('roomId', p_room, 'status', public._request_join(p_room, v_uid));
end;
$$;

-- For a player waiting on the host: 'member' | 'pending' | 'rejected' | 'none'.
create or replace function public.my_join_status(p_room uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  r public.rooms;
  v_status text;
begin
  select * into r from public.rooms where id = p_room;
  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.room_members where room_id = p_room and user_id = v_uid) then
    v_status := 'member';
  else
    select status into v_status from public.room_join_requests where room_id = p_room and user_id = v_uid;
    v_status := coalesce(nullif(v_status, 'accepted'), 'none');
  end if;
  return jsonb_build_object(
    'status', v_status, 'roomStatus', r.status, 'title', r.title, 'code', r.code,
    'hostName', (select display_name from public.profiles where id = r.host_id),
    'hostAvatar', (select avatar_key from public.profiles where id = r.host_id));
end;
$$;

create or replace function public.respond_join_request(p_room uuid, p_user uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if not exists (select 1 from public.rooms where id = p_room and host_id = v_uid) then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.room_join_requests where room_id = p_room and user_id = p_user and status = 'pending') then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_accept then
    -- Checks room open + not full; a running game is only watched until the next one.
    perform public._join_room(p_room, p_user);
  end if;
  update public.room_join_requests
     set status = case when p_accept then 'accepted' else 'rejected' end, decided_at = now()
   where room_id = p_room and user_id = p_user;
  perform public._broadcast(p_room, 'join_decided', jsonb_build_object('userId', p_user, 'accepted', p_accept));
end;
$$;

-- ─── 5. Unlimited series ──────────────────────────────────────────────────────
alter table public.rooms drop constraint rooms_series_length_check;
alter table public.rooms add constraint rooms_series_length_check check (series_length between 0 and 50);

create or replace function public.create_room(
  p_title text,
  p_kind public.room_kind,
  p_visibility public.room_visibility,
  p_max_players int,
  p_ticket_price numeric,
  p_call_interval_seconds int,
  p_series_length int,
  p_prizes jsonb
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  v_prizes jsonb := public._validate_prizes(p_prizes);
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  -- Series: 0 = no limit (runs until the host ends it), else 2–50 games.
  v_len int := case when p_kind = 'series' then coalesce(p_series_length, 0) else 1 end;
  v_room uuid;
  v_code text;
  v_attempt int := 0;
begin
  if (select count(*) from public.rooms where host_id = v_uid and status = 'open') >= 3 then
    raise exception 'TOO_MANY_OPEN_ROOMS' using errcode = 'P0001';
  end if;
  if p_ticket_price is null or p_ticket_price < 0 or p_ticket_price > 100000 then
    raise exception 'INVALID_TICKET_PRICE' using errcode = 'P0001';
  end if;
  if p_max_players is null or p_max_players not between 2 and 100 then
    raise exception 'INVALID_MAX_PLAYERS' using errcode = 'P0001';
  end if;
  if p_kind = 'series' and v_len <> 0 and v_len not between 2 and 50 then
    raise exception 'INVALID_SERIES_LENGTH' using errcode = 'P0001';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := public._random_code();
    begin
      insert into public.rooms (
        code, host_id, title, kind, visibility, max_players, ticket_price,
        call_interval_seconds, prizes, series_length, total_games
      ) values (
        v_code, v_uid, coalesce(left(v_title, 40), 'Housie Room'), p_kind, p_visibility, p_max_players,
        round(p_ticket_price, 2), least(greatest(coalesce(p_call_interval_seconds, 6), 3), 20),
        v_prizes, v_len, case when v_len = 0 then 500 else v_len end
      ) returning id into v_room;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  perform public._join_room(v_room, v_uid);
  perform public._new_game(v_room);
  return jsonb_build_object('roomId', v_room, 'code', v_code);
end;
$$;

create or replace function public.play_again(p_room uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found or r.host_id is distinct from v_uid then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if r.status = 'open' then
    raise exception 'ROOM_STILL_PLAYING' using errcode = 'P0001';
  end if;
  update public.rooms
     set status = 'open', ended_at = null,
         total_games = least(games_played + case when series_length = 0 then 500 else series_length end, 500)
   where id = p_room;
  return public._new_game(p_room);
end;
$$;

-- get_room_state + the host's pending join requests.
create or replace function public.get_room_state(p_room uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  r public.rooms;
  g public.games;
  v_prev uuid;
begin
  select * into r from public.rooms where id = p_room;
  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = v_uid) and not public.is_admin() then
    raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  select * into g from public.games where id = r.current_game_id;
  select id into v_prev from public.games
   where room_id = p_room and status = 'finished' and game_no < coalesce(g.game_no, 32767)
   order by game_no desc limit 1;

  return jsonb_build_object(
    'serverTime', now(),
    'room', jsonb_build_object(
      'id', r.id, 'code', r.code, 'title', r.title, 'kind', r.kind, 'visibility', r.visibility,
      'status', r.status, 'hostId', r.host_id, 'maxPlayers', r.max_players, 'ticketPrice', r.ticket_price,
      'callIntervalSeconds', r.call_interval_seconds, 'prizes', r.prizes, 'seriesLength', r.series_length,
      'totalGames', r.total_games, 'gamesPlayed', r.games_played, 'memberCount', r.member_count),
    'game', case when g.id is null then null else jsonb_build_object(
      'id', g.id, 'gameNo', g.game_no, 'status', g.status, 'ticketPrice', g.ticket_price, 'pot', g.pot,
      'prizesCustom', g.prizes_custom, 'ticketCount', g.ticket_count, 'playerCount', g.player_count,
      'calledNumbers', g.called_numbers, 'lastCalledAt', g.last_called_at, 'nextCallAt', g.next_call_at,
      'startedAt', g.started_at, 'finishedAt', g.finished_at) end,
    'prizes', case when g.id is null then '[]'::jsonb else public._prizes_json(g.id) end,
    'previousGameId', v_prev,
    'myTickets', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'serial', t.serial, 'cells', t.cells) order by t.serial)
        from public.tickets t where t.game_id = g.id and t.user_id = v_uid), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'userId', pr.id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
               'tickets', (select count(*) from public.tickets t where t.game_id = g.id and t.user_id = pr.id))
               order by m.joined_at)
        from public.room_members m join public.profiles pr on pr.id = m.user_id
       where m.room_id = p_room), '[]'::jsonb),
    'joinRequests', case when r.host_id = v_uid then coalesce((
      select jsonb_agg(jsonb_build_object('userId', pr.id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
                                          'requestedAt', q.created_at) order by q.created_at)
        from public.room_join_requests q join public.profiles pr on pr.id = q.user_id
       where q.room_id = p_room and q.status = 'pending'), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

-- ─── Privileges ───────────────────────────────────────────────────────────────
revoke execute on function public._request_join(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._generate_ticket() from public, anon, authenticated;
revoke execute on function
  public.join_room_by_code(text), public.join_public_room(uuid), public.my_join_status(uuid),
  public.respond_join_request(uuid, uuid, boolean)
  from public, anon;
grant execute on function
  public.join_room_by_code(text), public.join_public_room(uuid), public.my_join_status(uuid),
  public.respond_join_request(uuid, uuid, boolean)
  to authenticated;
