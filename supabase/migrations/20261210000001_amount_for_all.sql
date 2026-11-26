-- ₹ Amount rooms are open to everyone again (owner, 2026-11-26): amounts are for scoring only and
-- players settle among themselves outside the app, as before. Removes the approved-numbers
-- feature (20261209000001). New rooms still start Free; the app sets Coins / ₹ Amount.

drop trigger if exists room_members_amount_guard on public.room_members;
drop trigger if exists room_join_requests_amount_guard on public.room_join_requests;
drop function if exists public._amount_member_guard();
drop function if exists public.my_amount_access();
drop function if exists public.admin_set_amount_access(uuid, int);
drop function if exists public.admin_list_amount_access();
drop function if exists public.admin_get_amount_access(uuid);
alter table public.profiles drop column if exists amount_access;

create or replace function public.set_stake_mode(p_room uuid, p_mode text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  r public.rooms;
  g public.games;
  v_price numeric;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found or r.host_id is distinct from v_uid or r.status <> 'open' then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if p_mode not in ('free', 'coins', 'amount') then
    raise exception 'INVALID_STAKE_MODE' using errcode = 'P0001';
  end if;
  select * into g from public.games where id = r.current_game_id for update;
  if g.id is null or g.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001';
  end if;
  if r.stake_mode = p_mode then
    return;
  end if;
  if exists (select 1 from public.tickets where game_id = g.id) then
    raise exception 'PRICE_LOCKED' using errcode = 'P0001';
  end if;
  v_price := case when p_mode = 'free' then 0 when p_mode = 'coins' then round(r.ticket_price) else r.ticket_price end;
  update public.rooms set stake_mode = p_mode, ticket_price = v_price where id = p_room;
  update public.games set ticket_price = v_price where id = g.id;
  perform public._recount_game(g.id);
  perform public._broadcast(p_room, 'room_settings', jsonb_build_object('roomId', p_room));
end;
$$;
