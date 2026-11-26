-- ₹ Amount rooms (amounts for scoring only; players settle among themselves outside the app)
-- are limited to numbers the admin approves:
--   profiles.amount_access 0 = none (default: no ₹ Amount option at all), 1 = may join ₹ rooms,
--   2 = may also create them. 7093054784 starts at 2.
-- New rooms now default to Free (the app sets Coins / ₹ Amount explicitly).

alter table public.profiles add column amount_access smallint not null default 0 check (amount_access between 0 and 2);
update public.profiles set amount_access = 2 where public._phone_digits(phone) = '7093054784';
alter table public.rooms alter column stake_mode set default 'free';

/** My ₹ Amount access (0 none, 1 join, 2 create). */
create function public.my_amount_access()
returns int
language sql stable security definer set search_path = ''
as $$ select coalesce((select amount_access from public.profiles where id = (select auth.uid())), 0)::int $$;

-- Nobody without access can request to join, or become a member of, a ₹ Amount room.
create function public._amount_member_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select stake_mode from public.rooms where id = new.room_id) = 'amount'
     and coalesce((select amount_access from public.profiles where id = new.user_id), 0) < 1 then
    raise exception 'AMOUNT_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger room_members_amount_guard before insert on public.room_members
  for each row execute function public._amount_member_guard();
create trigger room_join_requests_amount_guard before insert or update of status on public.room_join_requests
  for each row execute function public._amount_member_guard();

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
  -- ₹ Amount: only approved creators, and only if everyone already in the room is approved.
  if p_mode = 'amount' and (
    coalesce((select amount_access from public.profiles where id = v_uid), 0) < 2
    or exists (
      select 1 from public.room_members m join public.profiles p on p.id = m.user_id
       where m.room_id = p_room and p.amount_access < 1
    )
  ) then
    raise exception 'AMOUNT_NOT_ALLOWED' using errcode = 'P0001';
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

-- ─── Admin ───────────────────────────────────────────────────────────────────────
create function public.admin_set_amount_access(p_user uuid, p_level int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := public._require_admin();
begin
  if p_level is null or p_level not between 0 and 2 then
    raise exception 'INVALID_LEVEL' using errcode = 'P0001';
  end if;
  update public.profiles set amount_access = p_level where id = p_user;
  if not found then
    raise exception 'PLAYER_NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.audit_log (actor_id, action, target, details)
  values (v_admin, 'amount.access', p_user::text, jsonb_build_object('level', p_level));
end;
$$;

/** Everyone with ₹ Amount access (for the admin list). */
create function public.admin_list_amount_access()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public._require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'name', display_name, 'phone', phone, 'level', amount_access)
                     order by amount_access desc, display_name)
      from public.profiles where amount_access > 0), '[]'::jsonb);
end;
$$;

/** One player's level (admin player page). */
create function public.admin_get_amount_access(p_user uuid)
returns int
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public._require_admin();
  return coalesce((select amount_access from public.profiles where id = p_user), 0);
end;
$$;

revoke execute on function public._amount_member_guard() from public, anon, authenticated;
revoke execute on function public.my_amount_access(), public.admin_set_amount_access(uuid, int),
  public.admin_list_amount_access(), public.admin_get_amount_access(uuid) from public, anon;
grant execute on function public.my_amount_access(), public.admin_set_amount_access(uuid, int),
  public.admin_list_amount_access(), public.admin_get_amount_access(uuid) to authenticated;
