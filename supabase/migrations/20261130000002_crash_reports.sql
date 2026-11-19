-- Crash reporting without a third-party service (2026-11-19).
-- The app sends JavaScript crashes (global error handler + screen error boundary) to
-- report_crash; the admin web lists them (admin_list_crashes). Kept 30 days.
-- Native (Java/C++) crashes are not caught here — Play Console's Android vitals covers those.

create table public.crash_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references public.profiles (id) on delete set null,
  fatal boolean not null default false,
  source text not null default 'js' check (source in ('js', 'boundary', 'promise')),
  message text not null,
  stack text,
  screen text,
  app_version text,
  update_id text,
  platform text,
  os_version text
);
create index crash_reports_created_idx on public.crash_reports (created_at desc);
create index crash_reports_user_idx on public.crash_reports (user_id);
alter table public.crash_reports enable row level security;
revoke all on public.crash_reports from anon, authenticated;

create function public.report_crash(
  p_message text,
  p_stack text default null,
  p_fatal boolean default false,
  p_source text default 'js',
  p_screen text default null,
  p_app_version text default null,
  p_update_id text default null,
  p_platform text default null,
  p_os_version text default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if coalesce(btrim(p_message), '') = '' then
    return;
  end if;
  -- Spam guard: 20 reports / hour per player, 300 / hour from signed-out phones in total.
  if v_uid is not null then
    if (select count(*) from public.crash_reports where user_id = v_uid and created_at > now() - interval '1 hour') >= 20 then
      return;
    end if;
  elsif (select count(*) from public.crash_reports where user_id is null and created_at > now() - interval '1 hour') >= 300 then
    return;
  end if;
  insert into public.crash_reports (user_id, fatal, source, message, stack, screen, app_version, update_id, platform, os_version)
  values (
    case when exists (select 1 from public.profiles where id = v_uid) then v_uid end,
    coalesce(p_fatal, false),
    case when p_source in ('js', 'boundary', 'promise') then p_source else 'js' end,
    left(p_message, 500), left(p_stack, 4000), left(p_screen, 80), left(p_app_version, 40),
    left(p_update_id, 64), left(p_platform, 20), left(p_os_version, 40));
end;
$$;

create function public.admin_list_crashes(p_limit int default 100, p_offset int default 0)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'total', (select count(*) from public.crash_reports),
    'last24h', (select count(*) from public.crash_reports where created_at > now() - interval '24 hours'),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'createdAt', c.created_at, 'fatal', c.fatal, 'source', c.source,
               'message', c.message, 'stack', c.stack, 'screen', c.screen, 'appVersion', c.app_version,
               'updateId', c.update_id, 'platform', c.platform, 'osVersion', c.os_version,
               'userId', c.user_id, 'userName', p.display_name) order by c.created_at desc)
        from (select * from public.crash_reports order by created_at desc
               limit least(greatest(coalesce(p_limit, 100), 1), 500) offset greatest(coalesce(p_offset, 0), 0)) c
        left join public.profiles p on p.id = c.user_id), '[]'::jsonb));
end;
$$;

select cron.schedule(
  'housie-crash-reports-prune', '37 3 * * *',
  $$delete from public.crash_reports where created_at < now() - interval '30 days'$$
);

revoke execute on function public.report_crash(text, text, boolean, text, text, text, text, text, text) from public;
grant execute on function public.report_crash(text, text, boolean, text, text, text, text, text, text) to anon, authenticated;
revoke execute on function public.admin_list_crashes(int, int) from public, anon;
grant execute on function public.admin_list_crashes(int, int) to authenticated;
