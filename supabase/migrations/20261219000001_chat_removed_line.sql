-- Room chat: when the host removes a player the line says "X was removed by the host", not
-- "X left" (owner, 2026-11-28). The row is deleted inside remove_player, called by the host, so
-- auth.uid() is the host there; a player leaving themselves has auth.uid() = the player.

do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.chat_messages'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.chat_messages drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.chat_messages add constraint chat_messages_kind_check check (kind in ('user', 'join', 'leave', 'removed'));

create or replace function public._chat_member_line()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_room uuid := coalesce(new.room_id, old.room_id);
  v_user uuid := coalesce(new.user_id, old.user_id);
  v_actor uuid := auth.uid();
  v_kind text := case
    when tg_op = 'INSERT' then 'join'
    when v_actor is not null and v_actor <> coalesce(new.user_id, old.user_id) then 'removed'
    else 'leave' end;
  m public.chat_messages;
  pr public.profiles;
begin
  -- Skip when the room or the player is being deleted (cascades), and the host creating the room.
  if not exists (select 1 from public.rooms where id = v_room) then
    return null;
  end if;
  select * into pr from public.profiles where id = v_user;
  if not found then
    return null;
  end if;
  if tg_op = 'INSERT' and exists (select 1 from public.rooms where id = v_room and host_id = v_user and member_count <= 1) then
    return null;
  end if;
  insert into public.chat_messages (room_id, user_id, body, kind) values (v_room, v_user, v_kind, v_kind) returning * into m;
  perform public._broadcast(v_room, 'chat', jsonb_build_object(
    'id', m.id, 'userId', v_user, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
    'body', m.body, 'kind', v_kind, 'at', m.created_at));
  return null;
end;
$$;
