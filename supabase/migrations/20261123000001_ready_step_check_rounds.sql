-- Owner's changes of 2026-11-18 (fourth round):
--   * Lobby step 3 is now: host sets prizes → everyone taps "Ready for this game" → the game
--     starts by itself when every player with tickets is ready (games.phase 'ready').
--   * Check rounds: after a claim (Normal rule) each player taps "Checked" (or claims); the
--     check ends early when everyone has, or at the check time. rooms.check_seconds = 0 means
--     "until everyone is ready" (the host can also end the check).
--   * After number 90 the game doesn't end at once: a last check window lets everyone claim.

-- ─── Columns / tables ─────────────────────────────────────────────────────────
alter table public.games drop constraint games_phase_check;
alter table public.games add constraint games_phase_check check (phase in ('joining', 'tickets', 'ready'));
alter table public.games add column check_open boolean not null default false;
alter table public.games add column check_round int not null default 0;
alter table public.games add column final_check boolean not null default false;

alter table public.rooms drop constraint rooms_check_seconds_check;
alter table public.rooms add constraint rooms_check_seconds_check check (check_seconds = 0 or check_seconds between 5 and 60);

create table public.game_ready (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
alter table public.game_ready enable row level security;

create table public.check_acks (
  game_id uuid not null references public.games(id) on delete cascade,
  round int not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, round, user_id)
);
alter table public.check_acks enable row level security;
-- No policies: both are read through get_room_state and written through RPCs.

-- ─── Helpers ──────────────────────────────────────────────────────────────────
create or replace function public._clamp_check(p_seconds int)
returns int
language sql immutable set search_path = ''
as $$ select case when p_seconds <= 0 then 0 else least(greatest(p_seconds, 5), 60) end $$;

-- "Until everyone is ready": far enough away that only acks / the host end it.
create or replace function public._check_forever()
returns interval
language sql immutable set search_path = ''
as $$ select interval '30 minutes' $$;

/** Players who must respond: still in the room and holding tickets in this game. */
create or replace function public._active_players(p_game uuid)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select distinct t.user_id
    from public.tickets t
    join public.games g on g.id = t.game_id
    join public.room_members m on m.room_id = g.room_id and m.user_id = t.user_id
   where t.game_id = p_game
$$;

create or replace function public._start_game(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.games;
  v_sum numeric;
begin
  select * into g from public.games where id = p_game for update;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0001';
  end if;
  if g.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001';
  end if;
  -- The host plus at least one more player must have tickets.
  if g.player_count < 2 then
    raise exception 'NEED_TWO_PLAYERS' using errcode = 'P0001';
  end if;
  select coalesce(sum(amount), 0) into v_sum from public.game_prizes where game_id = p_game;
  if v_sum <> g.pot then
    perform public._auto_split(p_game);
  end if;

  insert into public.game_secrets (game_id, draw_order) values (p_game, public._shuffled_range(1, 90, 90));
  update public.games
     set status = 'running',
         started_at = now(),
         -- A short countdown so every phone is on the game screen before number 1.
         next_call_at = now() + interval '5 seconds'
   where id = p_game;
  update public.profiles p set games_played = games_played + 1
   where p.id in (select distinct user_id from public.tickets where game_id = p_game);

  perform public._broadcast(g.room_id, 'state', jsonb_build_object(
    'gameId', p_game, 'gameNo', g.game_no, 'status', 'running', 'nextCallAt', now() + interval '5 seconds'));
end;
$$;

create or replace function public.start_game(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if not exists (select 1 from public.games g join public.rooms r on r.id = g.room_id
                  where g.id = p_game and r.host_id = v_uid and r.status = 'open') then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  perform public._start_game(p_game);
end;
$$;

create or replace function public._maybe_start(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.games;
begin
  select * into g from public.games where id = p_game;
  if not found or g.status <> 'lobby' or g.phase <> 'ready' then
    return;
  end if;
  if (select count(*) from public._active_players(p_game)) >= 2
     and not exists (select 1 from public._active_players(p_game) u(id)
                      where not exists (select 1 from public.game_ready gr where gr.game_id = p_game and gr.user_id = u.id)) then
    perform public._start_game(p_game);
  end if;
end;
$$;

create or replace function public._ack_check(p_game uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.games;
begin
  select * into g from public.games where id = p_game;
  if not found or not g.check_open then
    return;
  end if;
  insert into public.check_acks (game_id, round, user_id) values (p_game, g.check_round, p_user) on conflict do nothing;
  perform public._broadcast(g.room_id, 'check_ack', jsonb_build_object(
    'gameId', p_game, 'round', g.check_round,
    'userIds', (select coalesce(jsonb_agg(user_id), '[]'::jsonb) from public.check_acks where game_id = p_game and round = g.check_round)));
  perform public._maybe_end_check(p_game);
end;
$$;

/** Everyone has checked: let the next clock tick settle and announce. */
create or replace function public._maybe_end_check(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.games;
begin
  select * into g from public.games where id = p_game;
  if not found or g.status <> 'running' or not g.check_open then
    return;
  end if;
  if not exists (select 1 from public._active_players(p_game) u(id)
                  where not exists (select 1 from public.check_acks a
                                     where a.game_id = p_game and a.round = g.check_round and a.user_id = u.id)) then
    update public.games set next_call_at = least(next_call_at, now()) where id = p_game;
  end if;
end;
$$;

-- ─── Lobby step 3: prizes set → everyone ready → start ───────────────────────
create function public.open_ready(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.games;
begin
  select * into g from public.games where id = p_game for update;
  if not found or not exists (select 1 from public.rooms where id = g.room_id and host_id = v_uid and status = 'open') then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if g.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001';
  end if;
  if g.phase <> 'tickets' then
    raise exception 'TICKETS_NOT_OPEN' using errcode = 'P0001';
  end if;
  if (select count(*) from public._active_players(p_game)) < 2 then
    raise exception 'NEED_TWO_PLAYERS' using errcode = 'P0001';
  end if;
  update public.games set phase = 'ready' where id = p_game;
  -- Setting the prizes is the host's "ready".
  insert into public.game_ready (game_id, user_id) values (p_game, v_uid) on conflict do nothing;
  perform public._broadcast(g.room_id, 'phase', jsonb_build_object('gameId', p_game, 'phase', 'ready'));
  perform public._maybe_start(p_game);
end;
$$;

create function public.set_ready(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.games;
begin
  select * into g from public.games where id = p_game for update;
  if not found or g.status <> 'lobby' or g.phase <> 'ready' then
    raise exception 'NOT_READY_STEP' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.tickets where game_id = p_game and user_id = v_uid) then
    raise exception 'NO_TICKETS' using errcode = 'P0001';
  end if;
  insert into public.game_ready (game_id, user_id) values (p_game, v_uid) on conflict do nothing;
  perform public._broadcast(g.room_id, 'ready', jsonb_build_object(
    'gameId', p_game, 'userIds', (select jsonb_agg(user_id) from public.game_ready where game_id = p_game)));
  perform public._maybe_start(p_game);
end;
$$;

-- ─── Check rounds ─────────────────────────────────────────────────────────────
create function public.check_done(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if not exists (select 1 from public.tickets where game_id = p_game and user_id = v_uid) then
    raise exception 'NO_TICKETS' using errcode = 'P0001';
  end if;
  perform public._ack_check(p_game, v_uid);
end;
$$;

create function public.end_check(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.games;
begin
  select * into g from public.games where id = p_game for update;
  if not found or not exists (select 1 from public.rooms where id = g.room_id and host_id = v_uid) then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if g.check_open then
    update public.games set next_call_at = least(next_call_at, now()) where id = p_game;
  end if;
end;
$$;

-- ─── Updated functions ────────────────────────────────────────────────────────
create or replace function public.create_room(
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
        public._clamp_check(coalesce(p_check_seconds, 10))
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

create or replace function public.update_room_settings(
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
         check_seconds = public._clamp_check(coalesce(p_check_seconds, check_seconds)),
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
               now() + case when not r.check_claims then public._winner_pause()
                            when r.check_seconds = 0 then public._check_forever()
                            else make_interval(secs => r.check_seconds) end)
       where id = g.id;
      if r.check_claims and not g.check_open then
        update public.games set check_open = true, check_round = check_round + 1 where id = g.id;
      end if;
    end if;
    if r.check_claims then
      perform public._ack_check(g.id, v_uid);
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
        'deadline', (select next_call_at from public.games where id = g.id),
        'round', (select check_round from public.games where id = g.id)));
    else
      perform public._broadcast(g.room_id, 'prize', jsonb_build_object(
        'gameId', g.id, 'prize', p_prize, 'amount', gp.amount, 'callIndex', v_done_at, 'winners', v_winners));
    end if;
  end if;

  return jsonb_build_object('result', v_result);
end;
$$;

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
  if g.check_open then
    update public.games set check_open = false where id = p_game;
  end if;

  if not exists (select 1 from public.game_prizes where game_id = p_game and prize = 'full_house' and status = 'open') then
    perform public._finish_game(p_game);
    return;
  end if;
  if coalesce(array_length(g.called_numbers, 1), 0) >= 90 then
    if g.final_check then
      perform public._finish_game(p_game);
      return;
    end if;
    -- Every number is out: one last chance for everyone to check and claim before the end.
    update public.games
       set final_check = true, check_open = true, check_round = check_round + 1,
           next_call_at = now() + case when r.check_claims and r.check_seconds = 0 then public._check_forever()
                                       else make_interval(secs => greatest(r.check_seconds, 15)) end
     where id = p_game
    returning * into g;
    perform public._broadcast(g.room_id, 'final_check', jsonb_build_object(
      'gameId', p_game, 'deadline', g.next_call_at, 'round', g.check_round));
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
      'paused', g.paused, 'startedAt', g.started_at, 'finishedAt', g.finished_at,
      'checkOpen', g.check_open, 'checkRound', g.check_round, 'finalCheck', g.final_check) end,
    'readyUserIds', coalesce((select jsonb_agg(gr.user_id) from public.game_ready gr where gr.game_id = g.id), '[]'::jsonb),
    'checkedUserIds', coalesce((select jsonb_agg(a.user_id) from public.check_acks a
                                 where a.game_id = g.id and a.round = g.check_round and g.check_open), '[]'::jsonb),
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

create or replace function public.remove_member(p_room uuid, p_user uuid)
returns void
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
  if p_user = v_uid then
    raise exception 'CANNOT_REMOVE_SELF' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = p_user) then
    return;
  end if;
  delete from public.tickets t using public.games g
   where t.game_id = g.id and g.id = r.current_game_id and g.status = 'lobby' and t.user_id = p_user;
  perform public._recount_game(r.current_game_id);
  delete from public.room_members where room_id = p_room and user_id = p_user;
  update public.rooms set member_count = member_count - 1 where id = p_room;
  update public.room_join_requests set status = 'rejected', decided_at = now() where room_id = p_room and user_id = p_user;
  perform public._broadcast(p_room, 'members', jsonb_build_object('memberCount', r.member_count - 1, 'removed', p_user));
  perform public._maybe_start(r.current_game_id);
  perform public._maybe_end_check(r.current_game_id);
end;
$$;

-- ─── Privileges ───────────────────────────────────────────────────────────────
revoke execute on function
  public._clamp_check(int), public._check_forever(), public._active_players(uuid), public._start_game(uuid),
  public._maybe_start(uuid), public._ack_check(uuid, uuid), public._maybe_end_check(uuid)
  from public, anon, authenticated;
revoke execute on function public.open_ready(uuid), public.set_ready(uuid), public.check_done(uuid), public.end_check(uuid) from public, anon;
grant execute on function public.open_ready(uuid), public.set_ready(uuid), public.check_done(uuid), public.end_check(uuid) to authenticated;
