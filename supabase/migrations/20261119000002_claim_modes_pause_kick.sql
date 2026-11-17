-- Owner's changes of 2026-11-18:
--   * Room claim rule: 'fastest' (first tap wins; same-number ties share until the next
--     number) or 'fair' (server awards everyone whose ticket completed the prize on that
--     number — a late tap still gets the reward). Plus an auto-mark option for tickets.
--   * Numbers pause while a winner announcement shows (8 s), so others can see it and, in
--     'fastest', still claim a share for the same number.
--   * Host can pause/resume calling and change the speed during a game.
--   * Host can remove a player from the room.
--   * Per-game results include each player's +/− for that game; standings sorted by net.

alter table public.rooms
  add column claim_mode text not null default 'fastest' check (claim_mode in ('fastest', 'fair')),
  add column auto_mark boolean not null default false;
alter table public.rooms alter column call_interval_seconds set default 3;

alter table public.games add column paused boolean not null default false;

-- Seconds the clock waits after a prize is won (winner announcement + same-number claims).
create or replace function public._winner_pause()
returns interval
language sql immutable set search_path = ''
as $$ select interval '8 seconds' $$;

-- ─── create_room with claim rule + auto-mark ──────────────────────────────────
drop function public.create_room(text, public.room_kind, public.room_visibility, int, numeric, int, int, jsonb);
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
  p_auto_mark boolean default false
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
        call_interval_seconds, prizes, series_length, total_games, claim_mode, auto_mark
      ) values (
        v_code, v_uid, coalesce(left(v_title, 40), 'Housie Room'), p_kind, p_visibility, p_max_players,
        round(p_ticket_price, 2), least(greatest(coalesce(p_call_interval_seconds, 3), 3), 20),
        v_prizes, v_len, case when v_len = 0 then 500 else v_len end,
        coalesce(p_claim_mode, 'fastest'), coalesce(p_auto_mark, false)
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

-- ─── Fair play: the server awards every ticket completing a prize on this number ──
create or replace function public._auto_award(p_game uuid, p_called smallint[])
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_idx int := array_length(p_called, 1);
  v_room uuid;
  v_any boolean := false;
  p record;
  v_n int;
  v_winners jsonb;
begin
  select room_id into v_room from public.games where id = p_game;
  for p in select prize, amount from public.game_prizes where game_id = p_game and status = 'open' loop
    insert into public.prize_winners (game_id, room_id, prize, user_id, ticket_id, call_index, numbers)
    select distinct on (t.user_id) p_game, v_room, p.prize, t.user_id, t.id, v_idx,
           public._winning_numbers(t.cells, p_called, p.prize)
      from public.tickets t
     where t.game_id = p_game
       and p_called[v_idx] = any (t.cells)
       and public._prize_completed_at(t.cells, p_called, p.prize) = v_idx
     order by t.user_id, t.serial
    on conflict do nothing;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      v_any := true;
      update public.game_prizes set status = 'won', won_at_call = v_idx, claim_window_call = v_idx
       where game_id = p_game and prize = p.prize;
      select jsonb_agg(jsonb_build_object(
               'userId', w.user_id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
               'ticketSerial', tk.serial, 'numbers', w.numbers) order by w.id)
        into v_winners
        from public.prize_winners w
        join public.profiles pr on pr.id = w.user_id
        join public.tickets tk on tk.id = w.ticket_id
       where w.game_id = p_game and w.prize = p.prize;
      perform public._broadcast(v_room, 'prize', jsonb_build_object(
        'gameId', p_game, 'prize', p.prize, 'amount', p.amount, 'callIndex', v_idx, 'winners', v_winners));
    end if;
  end loop;
  return v_any;
end;
$$;

-- ─── Clock tick: skips paused games, auto-awards in fair rooms, pauses after a win ──
create or replace function public._advance_game(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.games;
  r public.rooms;
  v_next smallint;
  v_called smallint[];
begin
  select * into g from public.games
   where id = p_game and status = 'running' and not paused and next_call_at <= now()
   for update skip locked;
  if not found then
    return;
  end if;
  select * into r from public.rooms where id = g.room_id;

  perform public._settle_prizes(p_game);

  if not exists (select 1 from public.game_prizes where game_id = p_game and prize = 'full_house' and status = 'open')
     or coalesce(array_length(g.called_numbers, 1), 0) >= 90 then
    perform public._finish_game(p_game);
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

create or replace function public.advance_due_games()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in select id from public.games where status = 'running' and not paused and next_call_at <= now() loop
    begin
      perform public._advance_game(v_id);
    exception when others then
      raise warning 'advance failed for game %: %', v_id, sqlerrm;
    end;
  end loop;
end;
$$;

-- ─── Fastest-finger claims (fair rooms are awarded by the clock) ──────────────
create or replace function public.claim_prize(p_ticket uuid, p_prize public.prize_type)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  t public.tickets;
  g public.games;
  gp public.game_prizes;
  v_mode text;
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
  select claim_mode into v_mode from public.rooms where id = g.room_id;
  if v_mode = 'fair' then
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
      -- Hold the next number while the winner announcement shows; others who completed
      -- this prize on the same number can still claim their share in this time.
      update public.games set next_call_at = greatest(next_call_at, now() + public._winner_pause()) where id = g.id;
    end if;
    select jsonb_agg(jsonb_build_object(
             'userId', w.user_id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
             'ticketSerial', tk.serial, 'numbers', w.numbers) order by w.id)
      into v_winners
      from public.prize_winners w
      join public.profiles pr on pr.id = w.user_id
      join public.tickets tk on tk.id = w.ticket_id
     where w.game_id = g.id and w.prize = p_prize;
    perform public._broadcast(g.room_id, 'prize', jsonb_build_object(
      'gameId', g.id, 'prize', p_prize, 'amount', gp.amount, 'callIndex', v_done_at, 'winners', v_winners));
  end if;

  return jsonb_build_object('result', v_result);
end;
$$;

-- ─── Host controls during a game ──────────────────────────────────────────────
create or replace function public.set_game_paused(p_game uuid, p_paused boolean)
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
  if g.status <> 'running' then
    raise exception 'GAME_NOT_RUNNING' using errcode = 'P0001';
  end if;
  update public.games
     set paused = p_paused,
         next_call_at = case when p_paused then next_call_at else now() + interval '2 seconds' end
   where id = p_game;
  perform public._broadcast(g.room_id, 'paused', jsonb_build_object('gameId', p_game, 'paused', p_paused));
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
  if p_seconds is null or p_seconds not between 3 and 20 then
    raise exception 'INVALID_SPEED' using errcode = 'P0001';
  end if;
  update public.rooms set call_interval_seconds = p_seconds where id = p_room;
  perform public._broadcast(p_room, 'speed', jsonb_build_object('seconds', p_seconds));
end;
$$;

-- Host removes a player. Their tickets for a game that hasn't started are dropped.
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
end;
$$;

-- ─── Reads ────────────────────────────────────────────────────────────────────
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
      'claimMode', r.claim_mode, 'autoMark', r.auto_mark),
    'game', case when g.id is null then null else jsonb_build_object(
      'id', g.id, 'gameNo', g.game_no, 'status', g.status, 'ticketPrice', g.ticket_price, 'pot', g.pot,
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

create or replace function public.get_game_results(p_game uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.games;
begin
  select * into g from public.games where id = p_game;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.room_members where room_id = g.room_id and user_id = v_uid) and not public.is_admin() then
    raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'gameId', g.id, 'gameNo', g.game_no, 'status', g.status, 'pot', g.pot,
    'calledCount', coalesce(array_length(g.called_numbers, 1), 0),
    'finishedAt', g.finished_at, 'prizes', public._prizes_json(g.id),
    -- Each player's result for this game: tickets × price spent, prizes won, net (+/−).
    'players', coalesce((
      select jsonb_agg(x order by (x ->> 'net')::numeric desc, x ->> 'name') from (
        select jsonb_build_object(
          'userId', pr.id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
          'tickets', s.tickets, 'spent', s.tickets * g.ticket_price,
          'won', coalesce(w.won, 0), 'net', coalesce(w.won, 0) - s.tickets * g.ticket_price) as x
          from (select user_id, count(*) as tickets from public.tickets where game_id = g.id group by user_id) s
          join public.profiles pr on pr.id = s.user_id
          left join (select user_id, sum(amount) as won from public.prize_winners where game_id = g.id group by user_id) w
            on w.user_id = s.user_id
      ) q), '[]'::jsonb));
end;
$$;

create or replace function public.get_room_standings(p_room uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = v_uid) and not public.is_admin() then
    raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  return (
    with played as (
      select t.user_id, count(*) as tickets, sum(g.ticket_price) as spent, count(distinct g.id) as games
        from public.tickets t join public.games g on g.id = t.game_id
       where g.room_id = p_room and g.status = 'finished'
       group by t.user_id
    ),
    won as (
      select w.user_id, count(*) as wins, sum(w.amount) as won,
             jsonb_agg(jsonb_build_object('gameNo', g.game_no, 'prize', w.prize, 'amount', w.amount,
                                          'numbers', w.numbers) order by g.game_no, public._prize_order(w.prize)) as list
        from public.prize_winners w join public.games g on g.id = w.game_id
       where w.room_id = p_room and g.status = 'finished'
       group by w.user_id
    ),
    people as (
      select user_id from played
      union select user_id from won
      union select user_id from public.room_members where room_id = p_room
    )
    select coalesce(jsonb_agg(row_data order by (row_data ->> 'net')::numeric desc,
                                              (row_data ->> 'won')::numeric desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'userId', pe.user_id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
          'games', coalesce(pl.games, 0), 'tickets', coalesce(pl.tickets, 0),
          'spent', coalesce(pl.spent, 0), 'wins', coalesce(wo.wins, 0), 'won', coalesce(wo.won, 0),
          'net', coalesce(wo.won, 0) - coalesce(pl.spent, 0),
          'list', coalesce(wo.list, '[]'::jsonb)) as row_data
          from people pe
          join public.profiles pr on pr.id = pe.user_id
          left join played pl on pl.user_id = pe.user_id
          left join won wo on wo.user_id = pe.user_id
      ) s
  );
end;
$$;

-- ─── Privileges ───────────────────────────────────────────────────────────────
revoke execute on function public._winner_pause() from public, anon, authenticated;
revoke execute on function public._auto_award(uuid, smallint[]) from public, anon, authenticated;
revoke execute on function public._advance_game(uuid) from public, anon, authenticated;
revoke execute on function public.advance_due_games() from public, anon, authenticated;
revoke execute on function
  public.create_room(text, public.room_kind, public.room_visibility, int, numeric, int, int, jsonb, text, boolean),
  public.set_game_paused(uuid, boolean),
  public.set_call_speed(uuid, int),
  public.remove_member(uuid, uuid)
  from public, anon;
grant execute on function
  public.create_room(text, public.room_kind, public.room_visibility, int, numeric, int, int, jsonb, text, boolean),
  public.set_game_paused(uuid, boolean),
  public.set_call_speed(uuid, int),
  public.remove_member(uuid, uuid)
  to authenticated;
