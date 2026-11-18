-- Owner's change of 2026-11-18: 50 built-in avatars (a1…a50) instead of 12.

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
  if p_avatar_key is not null and p_avatar_key !~ '^a([1-9]|[1-4][0-9]|50)$' then
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
