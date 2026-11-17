-- Core: players (profiles), settings, audit log, auth triggers, profile RPCs.
--
-- Security model (applies to every migration in this project):
--   * Clients never write tables directly. Every state change goes through a
--     SECURITY DEFINER function (RPC) that validates the caller and the input.
--   * Functions prefixed with "_" are internal: execute is revoked from every client role.
--   * RPC errors are raised as a bare UPPER_SNAKE code (e.g. 'ROOM_FULL'); the apps map
--     that code to a localized message (app/src/localization/*.json → errors.*).
--   * Amounts are casual "₹" play values only — no real money and no wallet in this app.

create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('player', 'admin');
create type public.app_language as enum ('en', 'te');

-- ─── Settings (single row) ────────────────────────────────────────────────────
create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  min_app_version text not null default '1.0.0',
  maintenance_message text,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1);

-- ─── Profiles ─────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 30),
  avatar_key text not null default 'a1' check (avatar_key ~ '^a[0-9]{1,2}$'),
  phone text,
  is_guest boolean not null default true,
  language public.app_language not null default 'en',
  role public.app_role not null default 'player',
  is_banned boolean not null default false,
  banned_reason text,
  games_played int not null default 0,
  prizes_won int not null default 0,
  amount_won numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_phone_idx on public.profiles (phone) where phone is not null;

-- ─── Audit log (admin actions; append-only) ───────────────────────────────────
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ─── Helpers ──────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and not p.is_banned
  );
$$;

create or replace function public._require_player()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_banned boolean;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  select is_banned into v_banned from public.profiles where id = v_uid;
  if v_banned is null then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_banned then
    raise exception 'ACCOUNT_BANNED' using errcode = 'P0001';
  end if;
  return v_uid;
end;
$$;

create or replace function public._require_admin()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  return auth.uid();
end;
$$;

-- Any script is allowed (Telugu vowel signs are combining marks, not [:alnum:]), so only
-- control characters and markup-ish symbols are rejected.
create or replace function public._clean_name(p_name text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  v text := nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
begin
  if v is null then
    return null;
  end if;
  if char_length(v) not between 2 and 30 or v ~ '[[:cntrl:]<>{}"\\]' then
    raise exception 'INVALID_DISPLAY_NAME' using errcode = 'P0001';
  end if;
  return v;
end;
$$;

-- ─── New auth user → profile ──────────────────────────────────────────────────
create or replace function public._on_auth_user_created()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_lang public.app_language := 'en';
  v_name text;
begin
  if (new.raw_user_meta_data ->> 'language') = 'te' then
    v_lang := 'te';
  end if;
  begin
    v_name := public._clean_name(new.raw_user_meta_data ->> 'display_name');
  exception when others then
    v_name := null;
  end;

  insert into public.profiles (id, display_name, phone, is_guest, language, avatar_key)
  values (
    new.id,
    coalesce(v_name, 'Player' || lpad((floor(random() * 10000))::int::text, 4, '0')),
    nullif(new.phone, ''),
    coalesce(new.is_anonymous, false) or nullif(new.phone, '') is null,
    v_lang,
    'a' || (1 + floor(random() * 12))::int
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public._on_auth_user_created();

-- A guest who verifies a phone number (updateUser + verifyOtp 'phone_change') stops being a guest.
create or replace function public._on_auth_user_updated()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.phone is distinct from old.phone
     or new.phone_confirmed_at is distinct from old.phone_confirmed_at
     or new.is_anonymous is distinct from old.is_anonymous then
    update public.profiles
       set phone = case when new.phone_confirmed_at is not null then nullif(new.phone, '') else phone end,
           is_guest = coalesce(new.is_anonymous, false) or new.phone_confirmed_at is null,
           updated_at = now()
     where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public._on_auth_user_updated();

-- ─── Player RPCs ──────────────────────────────────────────────────────────────
create or replace function public.get_me()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  select jsonb_build_object(
    'id', p.id,
    'displayName', p.display_name,
    'avatarKey', p.avatar_key,
    'phone', p.phone,
    'isGuest', p.is_guest,
    'language', p.language,
    'role', p.role,
    'isBanned', p.is_banned,
    'bannedReason', p.banned_reason,
    'gamesPlayed', p.games_played,
    'prizesWon', p.prizes_won,
    'amountWon', p.amount_won,
    'createdAt', p.created_at
  ) into v
  from public.profiles p
  where p.id = v_uid;
  if v is null then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;
  return v;
end;
$$;

create or replace function public.update_my_profile(
  p_display_name text default null, p_avatar_key text default null, p_language public.app_language default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  v_name text := public._clean_name(p_display_name);
begin
  if p_avatar_key is not null and p_avatar_key !~ '^a([1-9]|1[0-2])$' then
    raise exception 'INVALID_AVATAR' using errcode = 'P0001';
  end if;
  update public.profiles
     set display_name = coalesce(v_name, display_name),
         avatar_key = coalesce(p_avatar_key, avatar_key),
         language = coalesce(p_language, language),
         updated_at = now()
   where id = v_uid;
  return public.get_me();
end;
$$;

-- Play Store requirement: in-app account deletion. Removes the auth user; everything cascades.
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  insert into public.audit_log (actor_id, action, target) values (v_uid, 'account.delete_self', v_uid::text);
  delete from auth.users where id = v_uid;
end;
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;

create policy "settings readable" on public.app_settings for select to anon, authenticated using (true);
create policy "settings admin write" on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Names/avatars/stats are public inside the app; phone and role are not (column grants).
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "admin reads audit" on public.audit_log for select to authenticated using (public.is_admin());

revoke all on public.profiles from anon, authenticated;
grant select (id, display_name, avatar_key, games_played, prizes_won, amount_won, created_at)
  on public.profiles to authenticated;
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;
revoke insert, delete, truncate on public.app_settings from anon, authenticated;
revoke update on public.app_settings from anon;

revoke execute on function public.get_me() from public, anon;
revoke execute on function public.update_my_profile(text, text, public.app_language) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.get_me() to authenticated;
grant execute on function public.update_my_profile(text, text, public.app_language) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
