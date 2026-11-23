-- Owner's requests of 2026-11-23.
--   * Room chat: a new joiner sees only messages from when they joined (not the old chat);
--     "X joined" / "X left" lines appear in the chat (chat_messages.kind).
--   * Players can ask the host to pause (request_pause → broadcast 'pause_request').
--   * Players who left or were removed still see the history of rooms they played in
--     (My rooms lists them; standings, game-by-game and results are readable for them).
--   * Clean-up like NearbyU: ended rooms and old chat are deleted after N days
--     (app_settings.room_retention_days, set in admin web; default 30). My rooms shows when.
--   * Players can remove an ended room from their My rooms (hide_room).

-- ─── Chat: kinds + join/leave lines ───────────────────────────────────────────
alter table public.chat_messages add column if not exists kind text not null default 'user'
  check (kind in ('user', 'join', 'leave'));

create or replace function public._chat_member_line()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_room uuid := coalesce(new.room_id, old.room_id);
  v_user uuid := coalesce(new.user_id, old.user_id);
  v_kind text := case when tg_op = 'INSERT' then 'join' else 'leave' end;
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

drop trigger if exists room_members_chat_line on public.room_members;
create trigger room_members_chat_line
  after insert or delete on public.room_members
  for each row execute function public._chat_member_line();

-- Messages from the moment this player (last) joined; 'kind' for join/leave lines.
create or replace function public.get_chat(p_room uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  v_since timestamptz;
begin
  select joined_at into v_since from public.room_members where room_id = p_room and user_id = v_uid;
  if v_since is null then
    if not public.is_admin() then
      raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
    end if;
    v_since := '-infinity';
  end if;
  return coalesce((
    select jsonb_agg(x.msg order by x.id)
      from (
        select c.id, jsonb_build_object('id', c.id, 'userId', c.user_id, 'name', pr.display_name,
                                        'avatarKey', pr.avatar_key, 'body', c.body, 'kind', c.kind, 'at', c.created_at) as msg
          from public.chat_messages c join public.profiles pr on pr.id = c.user_id
         where c.room_id = p_room and c.created_at >= v_since
         order by c.id desc
         limit 80
      ) x), '[]'::jsonb);
end;
$$;

-- ─── Pause requests (players → host) ──────────────────────────────────────────
create table if not exists public.pause_requests (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
alter table public.pause_requests enable row level security;
revoke all on public.pause_requests from anon, authenticated;
create index if not exists pause_requests_user_idx on public.pause_requests (user_id);

create or replace function public.request_pause(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.games;
  pr public.profiles;
begin
  select * into g from public.games where id = p_game;
  if not found or not exists (select 1 from public.room_members where room_id = g.room_id and user_id = v_uid) then
    raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  if g.status <> 'running' or g.paused then
    raise exception 'GAME_NOT_RUNNING' using errcode = 'P0001';
  end if;
  -- One request per player every 30 seconds.
  if exists (select 1 from public.pause_requests where game_id = p_game and user_id = v_uid and created_at > now() - interval '30 seconds') then
    raise exception 'PAUSE_ASKED_RECENTLY' using errcode = 'P0001';
  end if;
  insert into public.pause_requests (game_id, user_id) values (p_game, v_uid)
  on conflict (game_id, user_id) do update set created_at = now();
  select * into pr from public.profiles where id = v_uid;
  perform public._broadcast(g.room_id, 'pause_request', jsonb_build_object(
    'gameId', p_game, 'userId', v_uid, 'name', pr.display_name, 'avatarKey', pr.avatar_key));
end;
$$;

-- ─── History for players who left / were removed ─────────────────────────────
/** A member, anyone who held tickets in one of the room's games, or an admin. */
create or replace function public._can_view_room(p_room uuid, p_uid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.room_members where room_id = p_room and user_id = p_uid)
      or exists (select 1 from public.tickets t join public.games g on g.id = t.game_id
                  where g.room_id = p_room and t.user_id = p_uid)
      or public.is_admin()
$$;

create or replace function public.get_room_standings(p_room uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if not public._can_view_room(p_room, v_uid) then
    raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  return (
    with played as (
      select t.user_id, count(*) as tickets, sum(g.ticket_price) as spent, count(distinct g.id) as games
        from public.tickets t join public.games g on g.id = t.game_id
       where g.room_id = p_room and g.status = 'finished'
       group by t.user_id
    ),
    won as (
      select w.user_id, count(*) as wins, sum(w.amount) as won,
             jsonb_agg(jsonb_build_object('gameNo', g.game_no, 'prize', w.prize, 'amount', w.amount,
                                          'numbers', w.numbers) order by g.game_no, public._prize_order(w.prize)) as list
        from public.prize_winners w join public.games g on g.id = w.game_id
       where w.room_id = p_room and g.status = 'finished'
       group by w.user_id
    ),
    people as (
      select user_id from played
      union select user_id from won
      union select user_id from public.room_members where room_id = p_room
    )
    select coalesce(jsonb_agg(row_data order by (row_data ->> 'net')::numeric desc,
                                              (row_data ->> 'won')::numeric desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'userId', pe.user_id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
          'games', coalesce(pl.games, 0), 'tickets', coalesce(pl.tickets, 0),
          'spent', coalesce(pl.spent, 0), 'wins', coalesce(wo.wins, 0), 'won', coalesce(wo.won, 0),
          'net', coalesce(wo.won, 0) - coalesce(pl.spent, 0),
          'list', coalesce(wo.list, '[]'::jsonb),
          'isMember', exists (select 1 from public.room_members m where m.room_id = p_room and m.user_id = pe.user_id)) as row_data
          from people pe
          join public.profiles pr on pr.id = pe.user_id
          left join played pl on pl.user_id = pe.user_id
          left join won wo on wo.user_id = pe.user_id
      ) s
  );
end;
$$;

create or replace function public.get_room_ledger(p_room uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if not public._can_view_room(p_room, v_uid) then
    raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'gameId', g.id, 'gameNo', g.game_no, 'finishedAt', g.finished_at, 'pot', g.pot,
             'rows', (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'userId', x.user_id, 'tickets', x.tickets, 'spent', x.spent, 'won', x.won,
                        'net', x.won - x.spent) order by x.won - x.spent desc), '[]'::jsonb)
                 from (
                   select t.user_id, count(*) as tickets, count(*) * g.ticket_price as spent,
                          coalesce((select sum(w.amount) from public.prize_winners w
                                     where w.game_id = g.id and w.user_id = t.user_id), 0) as won
                     from public.tickets t
                    where t.game_id = g.id
                    group by t.user_id
                 ) x))
           order by g.game_no)
      from public.games g
     where g.room_id = p_room and g.status = 'finished'), '[]'::jsonb);
end;
$$;

create or replace function public.get_game_results(p_game uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.games;
begin
  select * into g from public.games where id = p_game;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not public._can_view_room(g.room_id, v_uid) then
    raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'gameId', g.id, 'gameNo', g.game_no, 'status', g.status, 'pot', g.pot,
    'calledCount', coalesce(array_length(g.called_numbers, 1), 0),
    'finishedAt', g.finished_at, 'prizes', public._prizes_json(g.id),
    'players', coalesce((
      select jsonb_agg(x order by (x ->> 'net')::numeric desc, x ->> 'name') from (
        select jsonb_build_object(
          'userId', pr.id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
          'tickets', s.tickets, 'spent', s.tickets * g.ticket_price,
          'won', coalesce(w.won, 0), 'net', coalesce(w.won, 0) - s.tickets * g.ticket_price) as x
          from (select user_id, count(*) as tickets from public.tickets where game_id = g.id group by user_id) s
          join public.profiles pr on pr.id = s.user_id
          left join (select user_id, sum(amount) as won from public.prize_winners where game_id = g.id group by user_id) w
            on w.user_id = s.user_id
      ) q), '[]'::jsonb));
end;
$$;

-- ─── Clean-up after N days (admin setting) + "remove from my rooms" ───────────
alter table public.app_settings add column if not exists room_retention_days int not null default 30
  check (room_retention_days between 1 and 365);

create table if not exists public.hidden_rooms (
  user_id uuid not null references public.profiles (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, room_id)
);
alter table public.hidden_rooms enable row level security;
revoke all on public.hidden_rooms from anon, authenticated;
create index if not exists hidden_rooms_room_idx on public.hidden_rooms (room_id);

create or replace function public._retention_days()
returns int
language sql stable security definer set search_path = ''
as $$ select coalesce((select room_retention_days from public.app_settings where id = 1), 30) $$;

/** Daily: ended rooms (with their games, tickets, wins, chat) and old chat go after N days. */
create or replace function public.purge_old_rooms()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_days int := public._retention_days();
begin
  delete from public.rooms
   where status = 'ended' and coalesce(ended_at, created_at) < now() - make_interval(days => v_days);
  delete from public.chat_messages where created_at < now() - make_interval(days => v_days);
end;
$$;

/** Remove a room from my "My rooms" (only once it has ended, or after I left it). */
create or replace function public.hide_room(p_room uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room;
  if not found then
    return;
  end if;
  if r.status = 'open' and exists (select 1 from public.room_members where room_id = p_room and user_id = v_uid) then
    raise exception 'ROOM_STILL_OPEN' using errcode = 'P0001';
  end if;
  insert into public.hidden_rooms (user_id, room_id) values (v_uid, p_room) on conflict do nothing;
end;
$$;

-- My rooms: rooms I'm in + rooms I played in and left; minus hidden; with the delete date.
create or replace function public.get_my_rooms(p_limit int default 30)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with mine as (
    select m.room_id, m.joined_at as at, true as is_member
      from public.room_members m where m.user_id = auth.uid()
    union all
    select g.room_id, max(t.created_at) as at, false as is_member
      from public.tickets t join public.games g on g.id = t.game_id
     where t.user_id = auth.uid()
       and not exists (select 1 from public.room_members m where m.room_id = g.room_id and m.user_id = auth.uid())
     group by g.room_id
  )
  select coalesce(jsonb_agg(x order by (x ->> 'joinedAt') desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', r.id, 'code', r.code, 'title', r.title, 'kind', r.kind, 'status', r.status,
      'isHost', r.host_id = auth.uid(), 'isMember', mi.is_member,
      'gamesPlayed', r.games_played, 'totalGames', r.total_games,
      'memberCount', r.member_count, 'joinedAt', mi.at,
      'endedAt', r.ended_at,
      'deleteAt', case when r.status = 'ended'
                       then coalesce(r.ended_at, r.created_at) + make_interval(days => public._retention_days()) end,
      'gameStatus', (select status from public.games where id = r.current_game_id),
      'myWon', coalesce((select sum(amount) from public.prize_winners w
                          where w.room_id = r.id and w.user_id = auth.uid()), 0)
    ) as x
    from mine mi join public.rooms r on r.id = mi.room_id
    where not exists (select 1 from public.hidden_rooms h where h.user_id = auth.uid() and h.room_id = r.id)
    order by mi.at desc
    limit least(greatest(p_limit, 1), 50)
  ) s;
$$;

select cron.schedule('housie-purge-old-rooms', '47 3 * * *', $$select public.purge_old_rooms()$$);

-- ─── Privileges ───────────────────────────────────────────────────────────────
revoke execute on function public._chat_member_line(), public._can_view_room(uuid, uuid), public._retention_days(),
  public.purge_old_rooms() from public, anon, authenticated;
revoke execute on function public.request_pause(uuid), public.hide_room(uuid), public.get_chat(uuid),
  public.get_room_standings(uuid), public.get_room_ledger(uuid), public.get_game_results(uuid), public.get_my_rooms(int)
  from public, anon;
grant execute on function public.request_pause(uuid), public.hide_room(uuid), public.get_chat(uuid),
  public.get_room_standings(uuid), public.get_room_ledger(uuid), public.get_game_results(uuid), public.get_my_rooms(int)
  to authenticated;
