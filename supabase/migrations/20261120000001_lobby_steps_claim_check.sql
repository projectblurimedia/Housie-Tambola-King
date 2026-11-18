-- Owner's changes of 2026-11-19:
--   * Calling speed 1–20 s (was 3–20).
--   * Lobby in steps: 'joining' (players join) → host taps Next → 'tickets' (everyone picks
--     tickets) → host sets prizes and plays. Tickets can only be taken in the 'tickets' step.
--   * "Check before announcing" (rooms.check_claims, default on, Fastest-finger rooms):
--     a claim pauses the numbers 10 s and tells everyone to check their tickets; anyone who
--     completed the same prize on the same number claims a share in that time. The winner
--     announcement (all prizes of that number together) comes when the prizes settle,
--     followed by a short pause before the next number.

alter table public.rooms drop constraint rooms_call_interval_seconds_check;
alter table public.rooms add constraint rooms_call_interval_seconds_check check (call_interval_seconds between 1 and 20);
alter table public.rooms add column check_claims boolean not null default true;

alter table public.games add column phase text not null default 'joining' check (phase in ('joining', 'tickets'));
-- Lobbies that already exist keep working: they are past the joining step.
update public.games set phase = 'tickets' where status = 'lobby';

create or replace function public._check_window()
returns interval
language sql immutable set search_path = ''
as $$ select interval '10 seconds' $$;

create or replace function public._announce_pause()
returns interval
language sql immutable set search_path = ''
as $$ select interval '7 seconds' $$;

-- ─── create_room with check-before-announcing ─────────────────────────────────
drop function public.create_room(text, public.room_kind, public.room_visibility, int, numeric, int, int, jsonb, text, boolean);
create function public.create_room(
  p_title text,
  p_kind public.room_kind,
  p_visibility public.room_visibility,
  p_max_players int,
  p_ticket_price numeric,
  p_call_interval_seconds int,
  p_series_length int,
  p_prizes jsonb,
  p_claim_mode text default 'fastest',
  p_auto_mark boolean default false,
  p_check_claims boolean default true
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  v_prizes jsonb := public._validate_prizes(p_prizes);
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
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
  if coalesce(p_claim_mode, 'fastest') not in ('fastest', 'fair') then
    raise exception 'INVALID_CLAIM_MODE' using errcode = 'P0001';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := public._random_code();
    begin
      insert into public.rooms (
        code, host_id, title, kind, visibility, max_players, ticket_price,
        call_interval_seconds, prizes, series_length, total_games, claim_mode, auto_mark, check_claims
      ) values (
        v_code, v_uid, coalesce(left(v_title, 40), 'Housie Room'), p_kind, p_visibility, p_max_players,
        round(p_ticket_price, 2), least(greatest(coalesce(p_call_interval_seconds, 3), 1), 20),
        v_prizes, v_len, case when v_len = 0 then 500 else v_len end,
        coalesce(p_claim_mode, 'fastest'), coalesce(p_auto_mark, false), coalesce(p_check_claims, true)
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

create or replace function public.set_call_speed(p_room uuid, p_seconds int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if not exists (select 1 from public.rooms where id = p_room and host_id = v_uid) then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if p_seconds is null or p_seconds not between 1 and 20 then
    raise exception 'INVALID_SPEED' using errcode = 'P0001';
  end if;
  update public.rooms set call_interval_seconds = p_seconds where id = p_room;
  perform public._broadcast(p_room, 'speed', jsonb_build_object('seconds', p_seconds));
end;
$$;

-- ─── Lobby steps ──────────────────────────────────────────────────────────────
create or replace function public.open_tickets(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.games;
  r public.rooms;
begin
  select * into g from public.games where id = p_game for update;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into r from public.rooms where id = g.room_id;
  if r.host_id is distinct from v_uid then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if g.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001';
  end if;
  if r.member_count < 2 then
    raise exception 'NEED_TWO_PLAYERS' using errcode = 'P0001';
  end if;
  update public.games set phase = 'tickets' where id = p_game;
  perform public._broadcast(g.room_id, 'phase', jsonb_build_object('gameId', p_game, 'phase', 'tickets'));
end;
$$;

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
  if g.phase <> 'tickets' then
    raise exception 'TICKETS_NOT_OPEN' using errcode = 'P0001';
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

-- ─── Settling: full winner details in the broadcast; returns how many settled ──
drop function public._settle_prizes(uuid);
create function public._settle_prizes(p_game uuid)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  p record;
  v_room uuid;
  v_count int;
  v_each numeric;
  v_settled int := 0;
  v_winners jsonb;
begin
  select room_id into v_room from public.games where id = p_game;
  for p in select * from public.game_prizes where game_id = p_game and status = 'won' loop
    select count(*) into v_count from public.prize_winners where game_id = p_game and prize = p.prize;
    v_each := case when v_count > 0 then floor(p.amount / v_count * 100) / 100 else 0 end;
    update public.prize_winners set amount = v_each where game_id = p_game and prize = p.prize;
    update public.profiles pr
       set prizes_won = prizes_won + 1, amount_won = amount_won + v_each
     where pr.id in (select user_id from public.prize_winners where game_id = p_game and prize = p.prize);
    update public.game_prizes set status = 'settled' where game_id = p_game and prize = p.prize;
    select jsonb_agg(jsonb_build_object(
             'userId', w.user_id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
             'ticketSerial', tk.serial, 'numbers', w.numbers, 'amount', v_each) order by w.id)
      into v_winners
      from public.prize_winners w
      join public.profiles pr on pr.id = w.user_id
      join public.tickets tk on tk.id = w.ticket_id
     where w.game_id = p_game and w.prize = p.prize;
    perform public._broadcast(v_room, 'prize_settled', jsonb_build_object(
      'gameId', p_game, 'prize', p.prize, 'each', v_each, 'winners', v_count,
      'amount', p.amount, 'callIndex', p.won_at_call, 'winnerList', coalesce(v_winners, '[]'::jsonb)));
    v_settled := v_settled + 1;
  end loop;
  return v_settled;
end;
$$;

-- ─── Clock tick: after a checked claim settles, pause for the announcement ────
create or replace function public._advance_game(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.games;
  r public.rooms;
  v_next smallint;
  v_called smallint[];
  v_settled int;
begin
  select * into g from public.games
   where id = p_game and status = 'running' and not paused and next_call_at <= now()
   for update skip locked;
  if not found then
    return;
  end if;
  select * into r from public.rooms where id = g.room_id;

  v_settled := public._settle_prizes(p_game);

  if not exists (select 1 from public.game_prizes where game_id = p_game and prize = 'full_house' and status = 'open')
     or coalesce(array_length(g.called_numbers, 1), 0) >= 90 then
    perform public._finish_game(p_game);
    return;
  end if;

  -- Checked claims are announced only now (on settle): give the announcement its moment.
  if v_settled > 0 and r.claim_mode = 'fastest' and r.check_claims then
    update public.games set next_call_at = now() + public._announce_pause() where id = p_game;
    return;
  end if;

  select draw_order[coalesce(array_length(g.called_numbers, 1), 0) + 1] into v_next
    from public.game_secrets where game_id = p_game;
  v_called := g.called_numbers || v_next;

  update public.games
     set called_numbers = v_called,
         last_called_at = now(),
         next_call_at = now() + make_interval(secs => r.call_interval_seconds)
   where id = p_game;

  perform public._broadcast(g.room_id, 'call', jsonb_build_object(
    'gameId', p_game, 'n', v_next, 'index', array_length(v_called, 1),
    'nextCallAt', now() + make_interval(secs => r.call_interval_seconds)));

  if r.claim_mode = 'fair' and public._auto_award(p_game, v_called) then
    update public.games set next_call_at = now() + public._winner_pause() where id = p_game;
  end if;
end;
$$;

-- ─── Fastest finger with optional "check before announcing" ───────────────────
create or replace function public.claim_prize(p_ticket uuid, p_prize public.prize_type)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  t public.tickets;
  g public.games;
  r public.rooms;
  gp public.game_prizes;
  v_called_count int;
  v_done_at int;
  v_result text;
  v_winners jsonb;
begin
  select * into t from public.tickets where id = p_ticket and user_id = v_uid;
  if not found then
    raise exception 'TICKET_NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into g from public.games where id = t.game_id for update;
  if g.status <> 'running' then
    raise exception 'GAME_NOT_RUNNING' using errcode = 'P0001';
  end if;
  select * into r from public.rooms where id = g.room_id;
  if r.claim_mode = 'fair' then
    return jsonb_build_object('result', 'auto');
  end if;
  if (select count(*) from public.claim_attempts
       where game_id = g.id and user_id = v_uid and created_at > now() - interval '10 seconds') >= 12 then
    raise exception 'TOO_MANY_CLAIMS' using errcode = 'P0001';
  end if;
  select * into gp from public.game_prizes where game_id = g.id and prize = p_prize;
  if not found then
    raise exception 'PRIZE_NOT_IN_GAME' using errcode = 'P0001';
  end if;

  v_called_count := coalesce(array_length(g.called_numbers, 1), 0);
  v_done_at := public._prize_completed_at(t.cells, g.called_numbers, p_prize);

  if v_done_at is null then
    v_result := 'not_complete';
  elsif exists (select 1 from public.prize_winners where game_id = g.id and prize = p_prize and user_id = v_uid) then
    v_result := 'already_yours';
  elsif gp.status = 'open' then
    v_result := 'won';
  elsif gp.status = 'won' and v_done_at = gp.won_at_call and v_called_count = gp.claim_window_call then
    v_result := 'shared';
  else
    v_result := 'already_claimed';
  end if;

  insert into public.claim_attempts (game_id, user_id, prize, result) values (g.id, v_uid, p_prize, v_result);

  if v_result in ('won', 'shared') then
    insert into public.prize_winners (game_id, room_id, prize, user_id, ticket_id, call_index, numbers)
    values (g.id, g.room_id, p_prize, v_uid, t.id, v_done_at,
            public._winning_numbers(t.cells, g.called_numbers, p_prize));
    if v_result = 'won' then
      update public.game_prizes set status = 'won', won_at_call = v_done_at, claim_window_call = v_called_count
       where game_id = g.id and prize = p_prize;
      update public.games
         set next_call_at = greatest(next_call_at,
               now() + case when r.check_claims then public._check_window() else public._winner_pause() end)
       where id = g.id;
    end if;
    select jsonb_agg(jsonb_build_object(
             'userId', w.user_id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
             'ticketSerial', tk.serial, 'numbers', w.numbers) order by w.id)
      into v_winners
      from public.prize_winners w
      join public.profiles pr on pr.id = w.user_id
      join public.tickets tk on tk.id = w.ticket_id
     where w.game_id = g.id and w.prize = p_prize;
    if r.check_claims then
      -- Not announced yet: everyone checks their tickets first; the announcement comes on settle.
      perform public._broadcast(g.room_id, 'claim_check', jsonb_build_object(
        'gameId', g.id, 'prize', p_prize, 'callIndex', v_done_at, 'winners', v_winners,
        'deadline', (select next_call_at from public.games where id = g.id)));
    else
      perform public._broadcast(g.room_id, 'prize', jsonb_build_object(
        'gameId', g.id, 'prize', p_prize, 'amount', gp.amount, 'callIndex', v_done_at, 'winners', v_winners));
    end if;
  end if;

  return jsonb_build_object('result', v_result);
end;
$$;

-- ─── get_room_state: + checkClaims, game.phase ────────────────────────────────
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
      'totalGames', r.total_games, 'gamesPlayed', r.games_played, 'memberCount', r.member_count,
      'claimMode', r.claim_mode, 'autoMark', r.auto_mark, 'checkClaims', r.check_claims),
    'game', case when g.id is null then null else jsonb_build_object(
      'id', g.id, 'gameNo', g.game_no, 'status', g.status, 'phase', g.phase, 'ticketPrice', g.ticket_price, 'pot', g.pot,
      'prizesCustom', g.prizes_custom, 'ticketCount', g.ticket_count, 'playerCount', g.player_count,
      'calledNumbers', g.called_numbers, 'lastCalledAt', g.last_called_at, 'nextCallAt', g.next_call_at,
      'paused', g.paused, 'startedAt', g.started_at, 'finishedAt', g.finished_at) end,
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
revoke execute on function public._check_window() from public, anon, authenticated;
revoke execute on function public._announce_pause() from public, anon, authenticated;
revoke execute on function public._settle_prizes(uuid) from public, anon, authenticated;
revoke execute on function public._advance_game(uuid) from public, anon, authenticated;
revoke execute on function
  public.create_room(text, public.room_kind, public.room_visibility, int, numeric, int, int, jsonb, text, boolean, boolean),
  public.open_tickets(uuid)
  from public, anon;
grant execute on function
  public.create_room(text, public.room_kind, public.room_visibility, int, numeric, int, int, jsonb, text, boolean, boolean),
  public.open_tickets(uuid)
  to authenticated;
