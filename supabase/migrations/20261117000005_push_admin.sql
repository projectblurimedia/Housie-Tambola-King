-- Device push tokens + admin dashboard RPCs (admin-web).
-- Every admin function re-checks the role server-side and writes an append-only audit row
-- for anything that changes data. First admin: see scripts/make-admin.sql.

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if p_token is null or char_length(p_token) not between 10 and 512 or p_platform not in ('android', 'ios') then
    raise exception 'INVALID_PUSH_TOKEN' using errcode = 'P0001';
  end if;
  insert into public.push_tokens (token, user_id, platform) values (p_token, v_uid, p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

-- ─── Admin ────────────────────────────────────────────────────────────────────
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_today timestamptz := (now() at time zone 'Asia/Kolkata')::date::timestamp at time zone 'Asia/Kolkata';
begin
  perform public._require_admin();
  return jsonb_build_object(
    'players', (select count(*) from public.profiles),
    'guests', (select count(*) from public.profiles where is_guest),
    'newToday', (select count(*) from public.profiles where created_at >= v_today),
    'banned', (select count(*) from public.profiles where is_banned),
    'openRooms', (select count(*) from public.rooms where status = 'open'),
    'runningGames', (select count(*) from public.games where status = 'running'),
    'roomsToday', (select count(*) from public.rooms where created_at >= v_today),
    'gamesToday', (select count(*) from public.games where started_at >= v_today),
    'ticketsToday', (select coalesce(sum(ticket_count), 0) from public.games where started_at >= v_today),
    'dailyNewPlayers', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', c) order by d), '[]'::jsonb) from (
        select (created_at at time zone 'Asia/Kolkata')::date as d, count(*) as c
          from public.profiles where created_at >= now() - interval '14 days' group by 1) s)
  );
end;
$$;

create or replace function public.admin_list_players(
  p_search text default null, p_filter text default 'all', p_limit int default 50, p_offset int default 0
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform public._require_admin();
  return jsonb_build_object(
    'total', (
      select count(*) from public.profiles p
       where (v_q is null or p.display_name ilike '%' || v_q || '%' or p.phone ilike '%' || v_q || '%' or p.id::text = v_q)
         and (p_filter = 'all' or (p_filter = 'banned' and p.is_banned) or (p_filter = 'guests' and p.is_guest)
              or (p_filter = 'verified' and not p.is_guest) or (p_filter = 'admins' and p.role = 'admin'))),
    'rows', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb) from (
        select p.id, p.display_name as "displayName", p.avatar_key as "avatarKey", p.phone, p.is_guest as "isGuest",
               p.role, p.is_banned as "isBanned", p.banned_reason as "bannedReason",
               p.games_played as "gamesPlayed", p.prizes_won as "prizesWon", p.amount_won as "amountWon",
               p.created_at as "createdAt"
          from public.profiles p
         where (v_q is null or p.display_name ilike '%' || v_q || '%' or p.phone ilike '%' || v_q || '%' or p.id::text = v_q)
           and (p_filter = 'all' or (p_filter = 'banned' and p.is_banned) or (p_filter = 'guests' and p.is_guest)
                or (p_filter = 'verified' and not p.is_guest) or (p_filter = 'admins' and p.role = 'admin'))
         order by p.created_at desc
         limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)) x), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_get_player(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'profile', (select row_to_json(p)::jsonb from public.profiles p where p.id = p_user),
    'rooms', coalesce((select jsonb_agg(x order by x ->> 'joinedAt' desc) from (
        select jsonb_build_object('id', r.id, 'code', r.code, 'title', r.title, 'kind', r.kind, 'status', r.status,
                                  'joinedAt', m.joined_at, 'isHost', r.host_id = p_user) as x
          from public.room_members m join public.rooms r on r.id = m.room_id
         where m.user_id = p_user order by m.joined_at desc limit 50) s), '[]'::jsonb),
    'wins', coalesce((select jsonb_agg(jsonb_build_object('prize', w.prize, 'amount', w.amount, 'createdAt', w.created_at)
                                       order by w.created_at desc)
                        from (select * from public.prize_winners where user_id = p_user order by created_at desc limit 50) w),
                     '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_set_ban(p_user uuid, p_banned boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := public._require_admin();
begin
  if p_user = v_admin then
    raise exception 'CANNOT_BAN_SELF' using errcode = 'P0001';
  end if;
  update public.profiles
     set is_banned = p_banned, banned_reason = case when p_banned then p_reason end, updated_at = now()
   where id = p_user;
  insert into public.audit_log (actor_id, action, target, details)
  values (v_admin, case when p_banned then 'player.ban' else 'player.unban' end, p_user::text,
          jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_set_role(p_user uuid, p_role public.app_role)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := public._require_admin();
begin
  if p_user = v_admin then
    raise exception 'CANNOT_CHANGE_OWN_ROLE' using errcode = 'P0001';
  end if;
  update public.profiles set role = p_role, updated_at = now() where id = p_user;
  insert into public.audit_log (actor_id, action, target, details)
  values (v_admin, 'player.set_role', p_user::text, jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.admin_list_rooms(
  p_status public.room_status default null, p_limit int default 50, p_offset int default 0
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'total', (select count(*) from public.rooms where p_status is null or status = p_status),
    'rows', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb) from (
        select r.id, r.code, r.title, r.kind, r.visibility, r.status, r.ticket_price as "ticketPrice",
               r.member_count as "memberCount", r.max_players as "maxPlayers",
               r.games_played as "gamesPlayed", r.total_games as "totalGames",
               g.status as "gameStatus", r.created_at as "createdAt", pr.display_name as "hostName"
          from public.rooms r
          left join public.profiles pr on pr.id = r.host_id
          left join public.games g on g.id = r.current_game_id
         where p_status is null or r.status = p_status
         order by r.created_at desc
         limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)) x), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_end_room(p_room uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := public._require_admin();
begin
  perform public._end_room(p_room, coalesce(nullif(btrim(p_reason), ''), 'admin'));
  insert into public.audit_log (actor_id, action, target, details)
  values (v_admin, 'room.end', p_room::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- Settings edits from admin-web go through RLS; log them.
create or replace function public._audit_settings_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, action, target, details)
  values (auth.uid(), 'app_settings.update', '1', to_jsonb(new));
  return new;
end;
$$;

create trigger audit_settings after update on public.app_settings
  for each row execute function public._audit_settings_change();

revoke execute on function public._audit_settings_change() from public, anon, authenticated;

revoke execute on function
  public.register_push_token(text, text),
  public.admin_dashboard(),
  public.admin_list_players(text, text, int, int),
  public.admin_get_player(uuid),
  public.admin_set_ban(uuid, boolean, text),
  public.admin_set_role(uuid, public.app_role),
  public.admin_list_rooms(public.room_status, int, int),
  public.admin_end_room(uuid, text)
  from public, anon;
grant execute on function
  public.register_push_token(text, text),
  public.admin_dashboard(),
  public.admin_list_players(text, text, int, int),
  public.admin_get_player(uuid),
  public.admin_set_ban(uuid, boolean, text),
  public.admin_set_role(uuid, public.app_role),
  public.admin_list_rooms(public.room_status, int, int),
  public.admin_end_room(uuid, text)
  to authenticated;
