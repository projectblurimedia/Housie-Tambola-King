-- Owner's request 2026-11-23: a player's pause request must not be missed by the host.
-- get_room_state carries the last minute's requests for the running game (the app shows a
-- banner to the host), so they arrive even when a live broadcast is missed.

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
      'claimMode', r.claim_mode, 'autoMark', r.auto_mark, 'checkClaims', r.check_claims, 'chatEnabled', r.chat_enabled, 'checkSeconds', r.check_seconds, 'hintMode', r.hint_mode, 'lateClaimCalls', r.late_claim_calls),
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
    'pauseRequests', case when g.id is null or g.status <> 'running' or g.paused then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('userId', pq.user_id, 'name', pr.display_name, 'at', pq.created_at) order by pq.created_at)
        from public.pause_requests pq join public.profiles pr on pr.id = pq.user_id
       where pq.game_id = g.id and pq.created_at > now() - interval '60 seconds'), '[]'::jsonb) end,
    'joinRequests', case when r.host_id = v_uid then coalesce((
      select jsonb_agg(jsonb_build_object('userId', pr.id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
                                          'requestedAt', q.created_at) order by q.created_at)
        from public.room_join_requests q join public.profiles pr on pr.id = q.user_id
       where q.room_id = p_room and q.status = 'pending'), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;
