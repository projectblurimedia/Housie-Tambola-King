-- Make the first admin. Sign in once (app or admin-web) with your mobile number, then run
-- this in Supabase Dashboard → SQL Editor. Phone is stored without '+', e.g. 919876543210.
update public.profiles
   set role = 'admin', updated_at = now()
 where phone = '91XXXXXXXXXX';

insert into public.audit_log (action, target, details)
select 'player.set_role', id::text, '{"role":"admin","via":"scripts/make-admin.sql"}'::jsonb
  from public.profiles where phone = '91XXXXXXXXXX';
