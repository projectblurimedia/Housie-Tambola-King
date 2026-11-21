-- Owner's request 2026-11-21: the host can change a series' number of games from the lobby's
-- Edit settings (it was only settable at creation). 0 = no limit (the host ends the series).
-- Allowed while the current game is in the lobby; a fixed length must include that game.
-- Safe to run more than once (it may first be run by hand in the Supabase SQL editor).

create or replace function public.set_series_length(p_room uuid, p_len int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found or r.host_id is distinct from v_uid or r.status <> 'open' then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if r.kind <> 'series' then
    raise exception 'NOT_A_SERIES' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.games where id = r.current_game_id and status <> 'lobby') then
    raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001';
  end if;
  -- The game waiting in the lobby is number games_played + 1.
  if p_len is null or (p_len <> 0 and (p_len not between 2 and 50 or p_len < r.games_played + 1)) then
    raise exception 'INVALID_SERIES_LENGTH' using errcode = 'P0001';
  end if;
  if r.series_length = p_len then
    return;
  end if;
  update public.rooms
     set series_length = p_len,
         total_games = case when p_len = 0 then 500 else p_len end
   where id = p_room;
  perform public._broadcast(p_room, 'room_settings', jsonb_build_object('roomId', p_room));
end;
$$;

revoke execute on function public.set_series_length(uuid, int) from public, anon;
grant execute on function public.set_series_length(uuid, int) to authenticated;
