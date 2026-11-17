-- Mobile-number login WITHOUT OTP (owner's decision for the testing phase, 2026-11-18).
--
-- The app sends name + 10-digit mobile number; this creates (or reuses) the player's account
-- and returns one-time credentials the app immediately signs in with. The same number always
-- maps to the same account, so rooms, wins and standings follow the number across phones.
--
-- SECURITY: there is no proof of owning the number — anyone can sign in as any number.
-- Accepted for testing only. Planned fix: replace with real SMS OTP (send-sms-hook +
-- Fast2SMS) before public launch, then revoke execute on this function from anon.
--
-- Accounts are Supabase email/password users with an internal address
-- 91<mobile>@player.housietambolaking.app (no email is ever sent). auth.users.phone is left
-- empty so it never clashes with the admin account or a future real phone-OTP login.

create or replace function public.phone_login(p_phone text, p_name text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_digits text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  v_name text := public._clean_name(p_name);
  v_email text;
  v_password text := encode(extensions.gen_random_bytes(24), 'hex');
  v_uid uuid;
begin
  if v_digits !~ '^[6-9][0-9]{9}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  if v_name is null then
    raise exception 'INVALID_DISPLAY_NAME' using errcode = 'P0001';
  end if;
  v_email := '91' || v_digits || '@player.housietambolaking.app';

  select id into v_uid from auth.users where email = v_email;

  if v_uid is not null and exists (select 1 from public.profiles where id = v_uid and is_banned) then
    raise exception 'ACCOUNT_BANNED' using errcode = 'P0001';
  end if;

  if v_uid is null then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous,
      confirmation_token, recovery_token, email_change_token_new, email_change, phone_change,
      phone_change_token, email_change_token_current, reauthentication_token)
    values (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', v_name), now(), now(), false,
      '', '', '', '', '', '', '', '')
    returning id into v_uid;
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  else
    -- Fresh one-time password on every login; existing sessions on other phones keep working.
    update auth.users
       set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')), updated_at = now()
     where id = v_uid;
  end if;

  update public.profiles
     set display_name = v_name, phone = '91' || v_digits, is_guest = false, updated_at = now()
   where id = v_uid;

  return jsonb_build_object('email', v_email, 'password', v_password);
end;
$$;

revoke execute on function public.phone_login(text, text) from public;
grant execute on function public.phone_login(text, text) to anon, authenticated;
