-- Party chat "is typing…" like the Housie room chat: a broadcast only (nothing stored).
create function public.party_chat_typing(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  pr public.profiles;
begin
  perform public._party_member(p_game, v_uid);
  select * into pr from public.profiles where id = v_uid;
  perform public._party_broadcast(p_game, 'typing', jsonb_build_object('userId', v_uid, 'name', pr.display_name, 'avatarKey', pr.avatar_key));
end;
$$;

revoke execute on function public.party_chat_typing(uuid) from public, anon;
grant execute on function public.party_chat_typing(uuid) to authenticated;
