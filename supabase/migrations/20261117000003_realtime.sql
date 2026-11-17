-- Realtime Authorization for private broadcast channels "room:<uuid>".
-- Clients subscribe with { config: { private: true } }. Only members of the room may
-- receive; nobody may send (no INSERT policy) — every message comes from the database via
-- public._broadcast(), so a modified client cannot fake a called number or a winner.

create or replace function public.can_receive_topic(p_topic text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_topic !~ '^room:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return exists (
    select 1 from public.room_members
     where room_id = substr(p_topic, 6)::uuid and user_id = auth.uid()
  ) or public.is_admin();
end;
$$;

revoke execute on function public.can_receive_topic(text) from public, anon;
grant execute on function public.can_receive_topic(text) to authenticated;

create policy "room members receive broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and public.can_receive_topic(realtime.topic())
  );
