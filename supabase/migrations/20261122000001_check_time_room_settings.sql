-- Owner's changes of 2026-11-18 (third round):
--   * Normal rule: the host picks how long everyone gets to check after a claim
--     (rooms.check_seconds, 5–60, default 10).
--   * The host can edit the room's settings while the lobby is open (update_room_settings);
--     everyone sees the applied settings. The ticket price is locked once tickets are open.

alter table public.rooms add column check_seconds int not null default 10 check (check_seconds between 5 and 60);

-- ─── create_room: + check time ────────────────────────────────────────────────
drop function public.create_room(text, public.room_kind, public.room_visibility, int, numeric, int, int, jsonb, text, boolean, boolean, boolean);
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
  p_check_claims boolean default true,
  p_chat_enabled boolean default true,
  p_check_seconds int default 10
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
  if coalesce(p_claim_mode, 'fastest') <> 'fastest' then
    raise exception 'INVALID_CLAIM_MODE' using errcode = 'P0001';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := public._random_code();
    begin
      insert into public.rooms (
        code, host_id, title, kind, visibility, max_players, ticket_price,
        call_interval_seconds, prizes, series_length, total_games, claim_mode, auto_mark, check_claims, chat_enabled, check_seconds
      ) values (
        v_code, v_uid, coalesce(left(v_title, 40), 'Housie Room'), p_kind, p_visibility, p_max_players,
        round(p_ticket_price, 2), least(greatest(coalesce(p_call_interval_seconds, 3), 1), 20),
        v_prizes, v_len, case when v_len = 0 then 500 else v_len end,
        coalesce(p_claim_mode, 'fastest'), coalesce(p_auto_mark, false), coalesce(p_check_claims, true), coalesce(p_chat_enabled, true),
        least(greatest(coalesce(p_check_seconds, 10), 5), 60)
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

-- ─── claim_prize: the room's own check time ───────────────────────────────────
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
  -- Sharing a same-number win exists only in Normal rooms (check before announcing).
  -- Fastest finger: whoever claims first wins it alone.
  elsif r.check_claims and gp.status = 'won' and v_done_at = gp.won_at_call and v_called_count = gp.claim_window_call then
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
               now() + case when r.check_claims then make_interval(secs => r.check_seconds) else public._winner_pause() end)
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

-- ─── get_room_state: + checkSeconds ───────────────────────────────────────────
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
      'claimMode', r.claim_mode, 'autoMark', r.auto_mark, 'checkClaims', r.check_claims, 'chatEnabled', r.chat_enabled, 'checkSeconds', r.check_seconds),
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

-- ─── Host edits the room before the game starts ──────────────────────────────
create function public.update_room_settings(
  p_room uuid,
  p_title text,
  p_visibility public.room_visibility,
  p_max_players int,
  p_ticket_price numeric,
  p_check_claims boolean,
  p_check_seconds int,
  p_auto_mark boolean,
  p_chat_enabled boolean
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  r public.rooms;
  g public.games;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_price numeric := round(coalesce(p_ticket_price, 0), 2);
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;
  if r.host_id is distinct from v_uid then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if r.status <> 'open' then
    raise exception 'ROOM_ENDED' using errcode = 'P0001';
  end if;
  select * into g from public.games where id = r.current_game_id for update;
  if g.id is null or g.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001';
  end if;
  if v_price < 0 or v_price > 100000 then
    raise exception 'INVALID_TICKET_PRICE' using errcode = 'P0001';
  end if;
  if p_max_players is null or p_max_players not between 2 and 100 or p_max_players < r.member_count then
    raise exception 'INVALID_MAX_PLAYERS' using errcode = 'P0001';
  end if;
  if v_price <> r.ticket_price and exists (select 1 from public.tickets where game_id = g.id) then
    raise exception 'PRICE_LOCKED' using errcode = 'P0001';
  end if;

  update public.rooms
     set title = coalesce(left(v_title, 40), title),
         visibility = coalesce(p_visibility, visibility),
         max_players = p_max_players,
         ticket_price = v_price,
         check_claims = coalesce(p_check_claims, check_claims),
         check_seconds = least(greatest(coalesce(p_check_seconds, check_seconds), 5), 60),
         auto_mark = coalesce(p_auto_mark, auto_mark),
         chat_enabled = coalesce(p_chat_enabled, chat_enabled)
   where id = p_room;
  if v_price <> g.ticket_price then
    update public.games set ticket_price = v_price where id = g.id;
    perform public._recount_game(g.id);
  end if;
  perform public._broadcast(p_room, 'room_settings', jsonb_build_object('roomId', p_room));
end;
$$;

-- ─── Privileges ───────────────────────────────────────────────────────────────
revoke execute on function
  public.create_room(text, public.room_kind, public.room_visibility, int, numeric, int, int, jsonb, text, boolean, boolean, boolean, int),
  public.update_room_settings(uuid, text, public.room_visibility, int, numeric, boolean, int, boolean, boolean)
  from public, anon;
grant execute on function
  public.create_room(text, public.room_kind, public.room_visibility, int, numeric, int, int, jsonb, text, boolean, boolean, boolean, int),
  public.update_room_settings(uuid, text, public.room_visibility, int, numeric, boolean, int, boolean, boolean)
  to authenticated;
