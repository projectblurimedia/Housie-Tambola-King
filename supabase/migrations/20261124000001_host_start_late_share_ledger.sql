-- Owner's changes of 2026-11-18 (fifth round):
--   * Ready step: players getting ready no longer starts the game — the host starts it once
--     everyone with tickets is ready (start_game checks).
--   * Normal rule: during the check, a player whose ticket already had the prize complete
--     (finished on an earlier number, claimed late) still shares it.
--   * Standings: who is still in the room, and a game-by-game ledger (get_room_ledger).

-- Readiness only enables the host's Start button now.
create or replace function public._maybe_start(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  return;
end;
$$;

create or replace function public._all_ready(p_game uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select count(*) from public._active_players(p_game)) >= 2
     and not exists (select 1 from public._active_players(p_game) u(id)
                      where not exists (select 1 from public.game_ready gr where gr.game_id = p_game and gr.user_id = u.id))
$$;

create or replace function public.start_game(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.games;
begin
  select * into g from public.games where id = p_game;
  if not found or not exists (select 1 from public.rooms r where r.id = g.room_id and r.host_id = v_uid and r.status = 'open') then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if g.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001';
  end if;
  if g.phase <> 'ready' or not public._all_ready(p_game) then
    raise exception 'NOT_ALL_READY' using errcode = 'P0001';
  end if;
  perform public._start_game(p_game);
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
  -- Normal rule: while the check is open, anyone whose ticket has this prize complete shares it —
  -- even if they finished it on an earlier number and were late to claim (their loss, not a win).
  elsif r.check_claims and gp.status = 'won' and v_done_at <= gp.won_at_call and g.check_open then
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
          'list', coalesce(wo.list, '[]'::jsonb),
          'isMember', exists (select 1 from public.room_members m where m.room_id = p_room and m.user_id = pe.user_id)) as row_data
          from people pe
          join public.profiles pr on pr.id = pe.user_id
          left join played pl on pl.user_id = pe.user_id
          left join won wo on wo.user_id = pe.user_id
      ) s
  );
end;
$$;

-- ─── Game-by-game ledger: every finished game, what each player spent / won / net ──
create function public.get_room_ledger(p_room uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = v_uid) and not public.is_admin() then
    raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'gameId', g.id, 'gameNo', g.game_no, 'finishedAt', g.finished_at, 'pot', g.pot,
             'rows', (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'userId', x.user_id, 'tickets', x.tickets, 'spent', x.spent, 'won', x.won,
                        'net', x.won - x.spent) order by x.won - x.spent desc), '[]'::jsonb)
                 from (
                   select t.user_id, count(*) as tickets, count(*) * g.ticket_price as spent,
                          coalesce((select sum(w.amount) from public.prize_winners w
                                     where w.game_id = g.id and w.user_id = t.user_id), 0) as won
                     from public.tickets t
                    where t.game_id = g.id
                    group by t.user_id
                 ) x))
           order by g.game_no)
      from public.games g
     where g.room_id = p_room and g.status = 'finished'), '[]'::jsonb);
end;
$$;

revoke execute on function public._all_ready(uuid) from public, anon, authenticated;
revoke execute on function public.get_room_ledger(uuid) from public, anon;
grant execute on function public.get_room_ledger(uuid) to authenticated;
