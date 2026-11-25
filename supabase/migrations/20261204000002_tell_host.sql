-- Owner's request 2026-11-25: in the "get ready" step a player can tell the host about a
-- problem (wrong tickets, wait for me, prize amounts…). Sent live to the host only, even when
-- room chat is off; nothing stored. Once every 15 seconds per player.

create table if not exists public.host_messages (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
alter table public.host_messages enable row level security;
revoke all on public.host_messages from anon, authenticated;
create index if not exists host_messages_user_idx on public.host_messages (user_id);

create or replace function public.tell_host(p_room uuid, p_text text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  v_text text := btrim(coalesce(p_text, ''));
  pr public.profiles;
begin
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = v_uid) then
    raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  if char_length(v_text) not between 1 and 200 then
    raise exception 'INVALID_MESSAGE' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.host_messages where room_id = p_room and user_id = v_uid and created_at > now() - interval '15 seconds') then
    raise exception 'CHAT_TOO_FAST' using errcode = 'P0001';
  end if;
  insert into public.host_messages (room_id, user_id) values (p_room, v_uid)
  on conflict (room_id, user_id) do update set created_at = now();
  select * into pr from public.profiles where id = v_uid;
  perform public._broadcast(p_room, 'player_issue', jsonb_build_object(
    'userId', v_uid, 'name', pr.display_name, 'avatarKey', pr.avatar_key, 'text', v_text));
end;
$$;

revoke execute on function public.tell_host(uuid, text) from public, anon;
grant execute on function public.tell_host(uuid, text) to authenticated;
