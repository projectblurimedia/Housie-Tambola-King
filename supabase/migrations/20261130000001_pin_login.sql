-- Owner's decision 2026-11-19: mobile number + 4-digit PIN replaces the no-OTP login.
--   Register: name + mobile + PIN (entered twice in the app)  → phone_register
--   Login:    mobile + PIN                                    → pin_login
--   Forgot PIN: pending (to be replaced by SMS OTP later).
--
-- PINs live only as bcrypt hashes in public.player_pins (RLS on, no policies, no grants):
-- no client can read them. 5 wrong PINs lock the account for 15 minutes.
-- Accounts made by the old phone_login (no PIN yet) set their PIN once through phone_register.
-- Sign-in itself is unchanged: on success the RPC returns one-time credentials for the
-- account's internal email (see 20261118000001_phone_login.sql).

create table public.player_pins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.player_pins enable row level security;
revoke all on public.player_pins from anon, authenticated;

create or replace function public._phone_digits(p_phone text)
returns text
language sql immutable set search_path = ''
as $$ select right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10) $$;

/** Fresh one-time password for an account; the app signs in with it straight away. */
create or replace function public._issue_login(p_uid uuid)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_password text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  update auth.users
     set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')), updated_at = now()
   where id = p_uid;
  return v_password;
end;
$$;

create or replace function public.phone_register(p_phone text, p_name text, p_pin text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_digits text := public._phone_digits(p_phone);
  v_name text := public._clean_name(p_name);
  v_email text;
  v_uid uuid;
begin
  if v_digits !~ '^[6-9][0-9]{9}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  if v_name is null then
    raise exception 'INVALID_DISPLAY_NAME' using errcode = 'P0001';
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then
    raise exception 'INVALID_PIN' using errcode = 'P0001';
  end if;
  v_email := '91' || v_digits || '@player.housietambolaking.app';

  select id into v_uid from auth.users where email = v_email;
  if v_uid is not null then
    if exists (select 1 from public.player_pins where user_id = v_uid) then
      raise exception 'PHONE_TAKEN' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.profiles where id = v_uid and is_banned) then
      raise exception 'ACCOUNT_BANNED' using errcode = 'P0001';
    end if;
  else
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous,
      confirmation_token, recovery_token, email_change_token_new, email_change, phone_change,
      phone_change_token, email_change_token_current, reauthentication_token)
    values (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      '', now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', v_name), now(), now(), false,
      '', '', '', '', '', '', '', '')
    returning id into v_uid;
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  end if;

  insert into public.player_pins (user_id, pin_hash) values (v_uid, extensions.crypt(p_pin, extensions.gen_salt('bf')));
  update public.profiles
     set display_name = v_name, phone = '91' || v_digits, is_guest = false, updated_at = now()
   where id = v_uid;

  return jsonb_build_object('email', v_email, 'password', public._issue_login(v_uid));
end;
$$;

-- Wrong PIN / locked are RETURNED (not raised) so the failed-attempt counter is kept.
create or replace function public.pin_login(p_phone text, p_pin text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_digits text := public._phone_digits(p_phone);
  v_email text;
  v_uid uuid;
  p public.player_pins;
  v_left int;
begin
  if v_digits !~ '^[6-9][0-9]{9}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then
    raise exception 'INVALID_PIN' using errcode = 'P0001';
  end if;
  v_email := '91' || v_digits || '@player.housietambolaking.app';
  select id into v_uid from auth.users where email = v_email;
  if v_uid is null then
    return jsonb_build_object('error', 'ACCOUNT_NOT_FOUND');
  end if;
  select * into p from public.player_pins where user_id = v_uid for update;
  if not found then
    -- Made before PINs existed: register once with this number to set a PIN.
    return jsonb_build_object('error', 'PIN_NOT_SET');
  end if;
  if exists (select 1 from public.profiles where id = v_uid and is_banned) then
    raise exception 'ACCOUNT_BANNED' using errcode = 'P0001';
  end if;
  if p.locked_until is not null and p.locked_until > now() then
    return jsonb_build_object('error', 'PIN_LOCKED', 'lockedUntil', p.locked_until);
  end if;

  if p.pin_hash <> extensions.crypt(p_pin, p.pin_hash) then
    v_left := 5 - (case when p.locked_until is not null then 0 else p.failed_attempts end + 1);
    if v_left <= 0 then
      update public.player_pins set failed_attempts = 0, locked_until = now() + interval '15 minutes', updated_at = now()
       where user_id = v_uid;
      return jsonb_build_object('error', 'PIN_LOCKED', 'lockedUntil', now() + interval '15 minutes');
    end if;
    update public.player_pins
       set failed_attempts = case when locked_until is not null then 1 else failed_attempts + 1 end,
           locked_until = null, updated_at = now()
     where user_id = v_uid;
    return jsonb_build_object('error', 'WRONG_PIN', 'attemptsLeft', v_left);
  end if;

  update public.player_pins set failed_attempts = 0, locked_until = null, updated_at = now() where user_id = v_uid;
  return jsonb_build_object('email', v_email, 'password', public._issue_login(v_uid));
end;
$$;

-- The old "number only" login is gone: anyone could sign in as any number with it.
drop function public.phone_login(text, text);

revoke execute on function public._phone_digits(text), public._issue_login(uuid) from public, anon, authenticated;
revoke execute on function public.phone_register(text, text, text), public.pin_login(text, text) from public;
grant execute on function public.phone_register(text, text, text), public.pin_login(text, text) to anon, authenticated;
