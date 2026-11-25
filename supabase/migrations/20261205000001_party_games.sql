-- Party games (points only — no coins, no money): "Find Seeta" and "Show".
--
-- Find Seeta: 3–15 players. Each round roles are dealt at random (Ram, Seeta, Lakshmana, …);
--   Ram is revealed and guesses who Seeta is. Right → Ram keeps 1000, Seeta 0; wrong → Seeta
--   takes Ram's 1000, Ram 0. Everyone else always gets their role's points.
-- Show: 3–10 players. n colours × 4 cards are shuffled and dealt 4 each. Each turn every player
--   picks one card and all pass at once to the next seat. Whoever holds 4 of one colour taps
--   SHOW; then everyone races to tap SHOW. Points by order: 1st (n−1)×100 … last 0.
--
-- Join by code / link (no approval), host starts with 3+, host picks 3–20 rounds. Roles and
-- hands live in party_secrets (no client access); each player reads only their own via
-- get_party_state. Every change is broadcast on the private topic "party:<id>". Deadlines are
-- enforced by pg_cron (advance_due_parties) and by clients calling party_nudge.

create table public.party_games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  kind text not null check (kind in ('seeta', 'show')),
  host_id uuid references public.profiles (id) on delete set null,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished', 'closed')),
  rounds smallint not null default 5 check (rounds between 3 and 20),
  round_no smallint not null default 0,
  -- lobby | seeta: guess, reveal | show: pass, show, reveal | done
  phase text not null default 'lobby',
  turn_no int not null default 0,
  -- Public round state (never a hidden role or hand).
  state jsonb not null default '{}'::jsonb,
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index party_games_host_idx on public.party_games (host_id);
create index party_games_due_idx on public.party_games (deadline) where status = 'playing';

create table public.party_players (
  game_id uuid not null references public.party_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat smallint not null,
  score int not null default 0,
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index party_players_user_idx on public.party_players (user_id);

create table public.party_secrets (
  game_id uuid not null references public.party_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text,
  hand smallint[],
  pick smallint,
  primary key (game_id, user_id)
);
create index party_secrets_user_idx on public.party_secrets (user_id);

alter table public.party_games enable row level security;
alter table public.party_players enable row level security;
alter table public.party_secrets enable row level security;
-- No policies: everything goes through the functions below.

-- ─── Realtime: members of a party receive "party:<id>" too ──────────────────────
create or replace function public.can_receive_topic(p_topic text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_topic ~ '^room:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return exists (
      select 1 from public.room_members
       where room_id = substr(p_topic, 6)::uuid and user_id = (select auth.uid())
    ) or public.is_admin();
  end if;
  if p_topic ~ '^party:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return exists (
      select 1 from public.party_players
       where game_id = substr(p_topic, 7)::uuid and user_id = (select auth.uid())
    );
  end if;
  return false;
end;
$$;

-- ─── Internal helpers ───────────────────────────────────────────────────────────
create function public._party_broadcast(p_game uuid, p_event text, p_payload jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform realtime.send(p_payload, p_event, 'party:' || p_game::text, true);
exception when others then
  raise warning 'party broadcast failed for %: %', p_game, sqlerrm;
end;
$$;

create function public._party_max(p_kind text)
returns int
language sql immutable set search_path = ''
as $$ select case p_kind when 'seeta' then 15 else 10 end $$;

create function public._seeta_roles()
returns text[]
language sql immutable set search_path = ''
as $$
  select array['ram', 'seeta', 'lakshmana', 'bharatha', 'shatrughna', 'anjaneya', 'sugreeva', 'vibhishana',
               'jambavantha', 'angada', 'nala', 'neela', 'dasaratha', 'janaka', 'guha']
$$;

create function public._seeta_points(p_role text)
returns int
language sql immutable set search_path = ''
as $$
  select case p_role
    when 'ram' then 1000 when 'seeta' then 0 when 'lakshmana' then 800 when 'bharatha' then 700
    when 'shatrughna' then 600 when 'anjaneya' then 500 when 'sugreeva' then 450 when 'vibhishana' then 400
    when 'jambavantha' then 350 when 'angada' then 300 when 'nala' then 250 when 'neela' then 200
    when 'dasaratha' then 150 when 'janaka' then 100 when 'guha' then 50 else 0 end
$$;

create function public._party_member(p_game uuid, p_uid uuid)
returns public.party_players
language plpgsql stable security definer set search_path = ''
as $$
declare
  m public.party_players;
begin
  select * into m from public.party_players where game_id = p_game and user_id = p_uid;
  if m.user_id is null then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;
  return m;
end;
$$;

/** Deal the next round (round_no + 1). Caller holds the game row lock. */
create function public._party_deal(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.party_games;
  v_users uuid[];
  v_n int;
  v_roles text[] := public._seeta_roles();
  v_deck smallint[];
  v_try int := 0;
  v_ok boolean;
  i int;
  v_hand smallint[];
begin
  select * into g from public.party_games where id = p_game;
  select array_agg(user_id order by seat) into v_users
    from public.party_players where game_id = p_game and active;
  v_n := coalesce(array_length(v_users, 1), 0);
  delete from public.party_secrets where game_id = p_game;

  if g.kind = 'seeta' then
    -- Shuffle the players, then hand out the first n roles in order.
    select array_agg(u order by random()) into v_users from unnest(v_users) u;
    for i in 1..v_n loop
      insert into public.party_secrets (game_id, user_id, role) values (p_game, v_users[i], v_roles[i]);
    end loop;
    update public.party_games
       set status = 'playing', round_no = round_no + 1, phase = 'guess', turn_no = 0,
           state = jsonb_build_object('ramId', v_users[1]),
           deadline = now() + interval '60 seconds', updated_at = now()
     where id = p_game;
  else
    -- n colours × 4 cards; no one may start with four of a kind.
    loop
      v_try := v_try + 1;
      select array_agg(c order by random()) into v_deck
        from (select (gs % v_n)::smallint as c from generate_series(0, v_n * 4 - 1) gs) d;
      v_ok := true;
      for i in 0..v_n - 1 loop
        v_hand := v_deck[i * 4 + 1 : i * 4 + 4];
        if v_hand[1] = v_hand[2] and v_hand[2] = v_hand[3] and v_hand[3] = v_hand[4] then
          v_ok := false;
        end if;
      end loop;
      exit when v_ok or v_try > 30;
    end loop;
    for i in 0..v_n - 1 loop
      insert into public.party_secrets (game_id, user_id, hand)
      values (p_game, v_users[i + 1], v_deck[i * 4 + 1 : i * 4 + 4]);
    end loop;
    update public.party_games
       set status = 'playing', round_no = round_no + 1, phase = 'pass', turn_no = 1,
           state = '{}'::jsonb, deadline = now() + interval '20 seconds', updated_at = now()
     where id = p_game;
  end if;
  perform public._party_broadcast(p_game, 'round', jsonb_build_object('roundNo', g.round_no + 1));
end;
$$;

/** Find Seeta: Ram guessed p_target — reveal every role and score the round. */
create function public._seeta_reveal(p_game uuid, p_target uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.party_games;
  v_ram uuid;
  v_seeta uuid;
  v_correct boolean;
  v_roles jsonb;
begin
  select * into g from public.party_games where id = p_game;
  v_ram := (g.state ->> 'ramId')::uuid;
  select user_id into v_seeta from public.party_secrets where game_id = p_game and role = 'seeta';
  v_correct := p_target = v_seeta;

  with pts as (
    select s.user_id, s.role,
           case
             when s.role = 'ram' then case when v_correct then 1000 else 0 end
             when s.role = 'seeta' then case when v_correct then 0 else 1000 end
             else public._seeta_points(s.role)
           end as points
      from public.party_secrets s
     where s.game_id = p_game
  ), upd as (
    update public.party_players p set score = p.score + pts.points
      from pts where p.game_id = p_game and p.user_id = pts.user_id
    returning p.user_id
  )
  select jsonb_agg(jsonb_build_object('userId', user_id, 'role', role, 'points', points) order by points desc)
    into v_roles from pts;

  update public.party_games
     set phase = 'reveal',
         state = jsonb_build_object('ramId', v_ram, 'guessId', p_target, 'seetaId', v_seeta,
                                    'correct', v_correct, 'roles', coalesce(v_roles, '[]'::jsonb)),
         deadline = now() + interval '9 seconds', updated_at = now()
   where id = p_game;
  perform public._party_broadcast(p_game, 'reveal', jsonb_build_object('correct', v_correct));
end;
$$;

/** Show: everyone has picked — pass all picked cards to the next seat at once. */
create function public._show_rotate(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_users uuid[];
  v_hands smallint[][];
  v_picks int[];
  v_give smallint[];
  v_n int;
  i int;
  v_prev int;
  v_hand smallint[];
begin
  select array_agg(p.user_id order by p.seat) into v_users
    from public.party_players p where p.game_id = p_game and p.active;
  v_n := array_length(v_users, 1);
  v_give := '{}';
  v_picks := '{}';
  for i in 1..v_n loop
    select s.hand, coalesce(s.pick, floor(random() * 4)::int) into v_hand, v_prev
      from public.party_secrets s where s.game_id = p_game and s.user_id = v_users[i];
    v_picks := v_picks || v_prev;
    v_give := v_give || v_hand[v_prev + 1];
  end loop;
  -- Player i receives the card from player i−1 into the slot they gave away.
  for i in 1..v_n loop
    v_prev := case when i = 1 then v_n else i - 1 end;
    update public.party_secrets s
       set hand[v_picks[i] + 1] = v_give[v_prev], pick = null
     where s.game_id = p_game and s.user_id = v_users[i];
  end loop;
  update public.party_games
     set turn_no = turn_no + 1, deadline = now() + interval '20 seconds', updated_at = now()
   where id = p_game;
  perform public._party_broadcast(p_game, 'turn', jsonb_build_object('turn', (select turn_no from public.party_games where id = p_game)));
end;
$$;

/** Show: the race is over — score by tap order (1st (n−1)×100 … last 0). */
create function public._show_finish(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.party_games;
  v_n int;
  v_shows jsonb;
  v_results jsonb := '[]'::jsonb;
  v_uid uuid;
  v_place int;
  v_pts int;
begin
  select * into g from public.party_games where id = p_game;
  select count(*) into v_n from public.party_players where game_id = p_game and active;
  v_shows := coalesce(g.state -> 'shows', '[]'::jsonb);
  for v_uid in
    select user_id from public.party_players where game_id = p_game and active
  loop
    v_place := null;
    select ord::int into v_place
      from jsonb_array_elements_text(v_shows) with ordinality as x(u, ord)
     where x.u::uuid = v_uid;
    v_pts := case when v_place is null then 0 else greatest(0, (v_n - v_place) * 100) end;
    update public.party_players set score = score + v_pts where game_id = p_game and user_id = v_uid;
    v_results := v_results || jsonb_build_object('userId', v_uid, 'place', v_place, 'points', v_pts);
  end loop;
  update public.party_games
     set phase = 'reveal', state = g.state || jsonb_build_object('results', v_results),
         deadline = now() + interval '9 seconds', updated_at = now()
   where id = p_game;
  perform public._party_broadcast(p_game, 'reveal', '{}'::jsonb);
end;
$$;

/** After a round's reveal: next round, or the end of the game. */
create function public._party_after_reveal(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.party_games;
begin
  select * into g from public.party_games where id = p_game;
  if g.round_no >= g.rounds then
    update public.party_games set status = 'finished', phase = 'done', deadline = null, updated_at = now() where id = p_game;
    delete from public.party_secrets where game_id = p_game;
    perform public._party_broadcast(p_game, 'finished', '{}'::jsonb);
  else
    perform public._party_deal(p_game);
  end if;
end;
$$;

/** Too few players left mid-game: end it. */
create function public._party_check_players(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (select status from public.party_games where id = p_game) = 'playing'
     and (select count(*) from public.party_players where game_id = p_game and active) < 3 then
    update public.party_games set status = 'finished', phase = 'done', deadline = null, updated_at = now() where id = p_game;
    delete from public.party_secrets where game_id = p_game;
    perform public._party_broadcast(p_game, 'finished', '{}'::jsonb);
  end if;
end;
$$;

/** A deadline passed: act for whoever didn't. Locks the row; a second caller skips. */
create function public._party_tick(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.party_games;
  v_target uuid;
begin
  select * into g from public.party_games where id = p_game for update skip locked;
  if g.id is null or g.status <> 'playing' or g.deadline is null or g.deadline > now() then
    return;
  end if;
  if g.phase = 'guess' then
    select user_id into v_target from public.party_players
     where game_id = p_game and active and user_id <> (g.state ->> 'ramId')::uuid
     order by random() limit 1;
    perform public._seeta_reveal(p_game, v_target);
  elsif g.phase = 'pass' then
    perform public._show_rotate(p_game);
  elsif g.phase = 'show' then
    perform public._show_finish(p_game);
  elsif g.phase = 'reveal' then
    perform public._party_after_reveal(p_game);
  end if;
end;
$$;

create function public.advance_due_parties()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in select id from public.party_games where status = 'playing' and deadline <= now() loop
    begin
      perform public._party_tick(v_id);
    exception when others then
      raise warning 'party tick failed for %: %', v_id, sqlerrm;
    end;
  end loop;
end;
$$;

-- ─── Client API ──────────────────────────────────────────────────────────────────
create function public.create_party(p_kind text, p_rounds int)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  v_code text;
  v_id uuid;
begin
  if p_kind not in ('seeta', 'show') then
    raise exception 'INVALID_PARTY_KIND' using errcode = 'P0001';
  end if;
  if p_rounds is null or p_rounds not between 3 and 20 then
    raise exception 'INVALID_ROUNDS' using errcode = 'P0001';
  end if;
  if (select count(*) from public.party_games where host_id = v_uid and status in ('lobby', 'playing')) >= 3 then
    raise exception 'TOO_MANY_OPEN_PARTIES' using errcode = 'P0001';
  end if;
  loop
    v_code := public._random_code();
    exit when not exists (select 1 from public.party_games where code = v_code)
          and not exists (select 1 from public.rooms where code = v_code);
  end loop;
  insert into public.party_games (code, kind, host_id, rounds) values (v_code, p_kind, v_uid, p_rounds)
  returning id into v_id;
  insert into public.party_players (game_id, user_id, seat) values (v_id, v_uid, 0);
  return jsonb_build_object('id', v_id, 'code', v_code);
end;
$$;

create function public.join_party_by_code(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.party_games;
  m public.party_players;
begin
  select * into g from public.party_games where code = upper(btrim(p_code)) for update;
  if g.id is null or g.status = 'closed' then
    raise exception 'PARTY_NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into m from public.party_players where game_id = g.id and user_id = v_uid;
  if m.user_id is not null and m.active then
    return g.id;
  end if;
  if g.status <> 'lobby' then
    raise exception 'PARTY_STARTED' using errcode = 'P0001';
  end if;
  if (select count(*) from public.party_players where game_id = g.id and active) >= public._party_max(g.kind) then
    raise exception 'PARTY_FULL' using errcode = 'P0001';
  end if;
  insert into public.party_players (game_id, user_id, seat)
  values (g.id, v_uid, coalesce((select max(seat) + 1 from public.party_players where game_id = g.id), 0))
  on conflict (game_id, user_id) do update set active = true, score = 0;
  update public.party_games set updated_at = now() where id = g.id;
  perform public._party_broadcast(g.id, 'players', '{}'::jsonb);
  return g.id;
end;
$$;

/** Leave (or, for the host, remove p_user). In the lobby the row goes; mid-game it goes inactive. */
create function public._party_drop(p_game uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.party_games;
  v_next uuid;
begin
  select * into g from public.party_games where id = p_game for update;
  if g.status in ('lobby', 'finished') then
    delete from public.party_players where game_id = p_game and user_id = p_user;
  else
    update public.party_players set active = false where game_id = p_game and user_id = p_user;
    delete from public.party_secrets where game_id = p_game and user_id = p_user;
  end if;
  if g.host_id = p_user then
    select user_id into v_next from public.party_players
     where game_id = p_game and active order by seat limit 1;
    if v_next is null then
      update public.party_games set status = 'closed', deadline = null, updated_at = now() where id = p_game;
    else
      update public.party_games set host_id = v_next, updated_at = now() where id = p_game;
    end if;
  end if;
  perform public._party_broadcast(p_game, 'players', jsonb_build_object('left', p_user));
  perform public._party_check_players(p_game);
  -- A Show turn waiting only on the one who left goes on now.
  if g.kind = 'show' and g.status = 'playing' and g.phase = 'pass'
     and not exists (select 1 from public.party_players p join public.party_secrets s using (game_id, user_id)
                      where p.game_id = p_game and p.active and s.pick is null)
     and (select status from public.party_games where id = p_game) = 'playing' then
    perform public._show_rotate(p_game);
  end if;
end;
$$;

create function public.leave_party(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  perform public._party_member(p_game, v_uid);
  perform public._party_drop(p_game, v_uid);
end;
$$;

create function public.remove_party_player(p_game uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if (select host_id from public.party_games where id = p_game) is distinct from v_uid then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if p_user = v_uid then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  perform public._party_member(p_game, p_user);
  perform public._party_drop(p_game, p_user);
end;
$$;

create function public.start_party(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.party_games;
begin
  select * into g from public.party_games where id = p_game for update;
  if g.host_id is distinct from v_uid then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if g.status <> 'lobby' then
    raise exception 'PARTY_STARTED' using errcode = 'P0001';
  end if;
  if (select count(*) from public.party_players where game_id = p_game and active) < 3 then
    raise exception 'NEED_3_PLAYERS' using errcode = 'P0001';
  end if;
  -- Seats 0..n−1 in joining order; scores start at 0.
  update public.party_players p set seat = r.rn - 1, score = 0
    from (select user_id, row_number() over (order by seat, joined_at) as rn
            from public.party_players where game_id = p_game and active) r
   where p.game_id = p_game and p.user_id = r.user_id;
  update public.party_games set round_no = 0 where id = p_game;
  perform public._party_deal(p_game);
end;
$$;

create function public.play_party_again(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.party_games;
begin
  select * into g from public.party_games where id = p_game for update;
  if g.host_id is distinct from v_uid then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if g.status <> 'finished' then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  delete from public.party_players where game_id = p_game and not active;
  update public.party_players set score = 0 where game_id = p_game;
  update public.party_games
     set status = 'lobby', phase = 'lobby', round_no = 0, turn_no = 0, state = '{}'::jsonb,
         deadline = null, updated_at = now()
   where id = p_game;
  perform public._party_broadcast(p_game, 'lobby', '{}'::jsonb);
end;
$$;

create function public.end_party(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if (select host_id from public.party_games where id = p_game) is distinct from v_uid then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  update public.party_games set status = 'closed', deadline = null, updated_at = now() where id = p_game;
  delete from public.party_secrets where game_id = p_game;
  perform public._party_broadcast(p_game, 'closed', '{}'::jsonb);
end;
$$;

create function public.seeta_guess(p_game uuid, p_target uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.party_games;
begin
  select * into g from public.party_games where id = p_game for update;
  if g.kind <> 'seeta' or g.status <> 'playing' or g.phase <> 'guess' then
    raise exception 'NOT_NOW' using errcode = 'P0001';
  end if;
  if (g.state ->> 'ramId')::uuid is distinct from v_uid then
    raise exception 'NOT_RAM' using errcode = 'P0001';
  end if;
  if p_target = v_uid or not exists (
    select 1 from public.party_players where game_id = p_game and user_id = p_target and active
  ) then
    raise exception 'INVALID_TARGET' using errcode = 'P0001';
  end if;
  perform public._seeta_reveal(p_game, p_target);
end;
$$;

create function public.show_pick(p_game uuid, p_index int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.party_games;
begin
  select * into g from public.party_games where id = p_game for update;
  if g.kind <> 'show' or g.status <> 'playing' or g.phase <> 'pass' then
    raise exception 'NOT_NOW' using errcode = 'P0001';
  end if;
  if p_index is null or p_index not between 0 and 3 then
    raise exception 'INVALID_CARD' using errcode = 'P0001';
  end if;
  update public.party_secrets set pick = p_index where game_id = p_game and user_id = v_uid;
  if not found then
    raise exception 'NOT_A_MEMBER' using errcode = 'P0001';
  end if;
  perform public._party_broadcast(p_game, 'picked', jsonb_build_object('userId', v_uid));
  if not exists (
    select 1 from public.party_players p join public.party_secrets s using (game_id, user_id)
     where p.game_id = p_game and p.active and s.pick is null
  ) then
    perform public._show_rotate(p_game);
  end if;
end;
$$;

create function public.show_call(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.party_games;
  v_hand smallint[];
  v_shows jsonb;
begin
  select * into g from public.party_games where id = p_game for update;
  if g.kind <> 'show' or g.status <> 'playing' or g.phase not in ('pass', 'show') then
    raise exception 'NOT_NOW' using errcode = 'P0001';
  end if;
  perform public._party_member(p_game, v_uid);
  if g.phase = 'pass' then
    select hand into v_hand from public.party_secrets where game_id = p_game and user_id = v_uid;
    if v_hand is null or not (v_hand[1] = v_hand[2] and v_hand[2] = v_hand[3] and v_hand[3] = v_hand[4]) then
      raise exception 'NOT_A_SHOW' using errcode = 'P0001';
    end if;
    update public.party_games
       set phase = 'show',
           state = jsonb_build_object('firstId', v_uid, 'color', v_hand[1], 'shows', jsonb_build_array(v_uid)),
           deadline = now() + interval '8 seconds', updated_at = now()
     where id = p_game;
    perform public._party_broadcast(p_game, 'show', jsonb_build_object('userId', v_uid, 'first', true));
  else
    v_shows := coalesce(g.state -> 'shows', '[]'::jsonb);
    if v_shows ? v_uid::text then
      return;
    end if;
    v_shows := v_shows || to_jsonb(v_uid::text);
    update public.party_games set state = state || jsonb_build_object('shows', v_shows), updated_at = now()
     where id = p_game;
    perform public._party_broadcast(p_game, 'show', jsonb_build_object('userId', v_uid, 'first', false));
    if jsonb_array_length(v_shows) >= (select count(*) from public.party_players where game_id = p_game and active) then
      perform public._show_finish(p_game);
    end if;
  end if;
end;
$$;

create function public.party_nudge(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  perform public._party_member(p_game, v_uid);
  perform public._party_tick(p_game);
end;
$$;

create function public.get_party_state(p_game uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.party_games;
  s public.party_secrets;
begin
  perform public._party_member(p_game, v_uid);
  select * into g from public.party_games where id = p_game;
  select * into s from public.party_secrets where game_id = p_game and user_id = v_uid;
  return jsonb_build_object(
    'game', jsonb_build_object(
      'id', g.id, 'code', g.code, 'kind', g.kind, 'hostId', g.host_id, 'status', g.status,
      'rounds', g.rounds, 'roundNo', g.round_no, 'phase', g.phase, 'turnNo', g.turn_no,
      'state', g.state, 'deadline', g.deadline),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
               'userId', p.user_id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
               'seat', p.seat, 'score', p.score, 'active', p.active,
               'picked', (select ps.pick is not null from public.party_secrets ps
                           where ps.game_id = p.game_id and ps.user_id = p.user_id))
             order by p.seat)
        from public.party_players p join public.profiles pr on pr.id = p.user_id
       where p.game_id = p_game), '[]'::jsonb),
    'me', jsonb_build_object('userId', v_uid, 'role', s.role, 'hand', to_jsonb(s.hand), 'pick', s.pick),
    'serverNow', now()
  );
end;
$$;

create function public.get_my_parties()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', g.id, 'code', g.code, 'kind', g.kind, 'status', g.status,
           'isHost', g.host_id = (select auth.uid()),
           'players', (select count(*) from public.party_players x where x.game_id = g.id and x.active))
         order by g.updated_at desc), '[]'::jsonb)
    from public.party_games g
    join public.party_players p on p.game_id = g.id and p.user_id = (select auth.uid()) and p.active
   where g.status in ('lobby', 'playing', 'finished')
$$;

-- ─── Grants ──────────────────────────────────────────────────────────────────────
revoke execute on function
  public._party_broadcast(uuid, text, jsonb), public._party_max(text), public._seeta_roles(),
  public._seeta_points(text), public._party_member(uuid, uuid), public._party_deal(uuid),
  public._seeta_reveal(uuid, uuid), public._show_rotate(uuid), public._show_finish(uuid),
  public._party_after_reveal(uuid), public._party_check_players(uuid), public._party_tick(uuid),
  public._party_drop(uuid, uuid), public.advance_due_parties()
  from public, anon, authenticated;

revoke execute on function
  public.create_party(text, int), public.join_party_by_code(text), public.leave_party(uuid),
  public.remove_party_player(uuid, uuid), public.start_party(uuid), public.play_party_again(uuid),
  public.end_party(uuid), public.seeta_guess(uuid, uuid), public.show_pick(uuid, int),
  public.show_call(uuid), public.party_nudge(uuid), public.get_party_state(uuid), public.get_my_parties()
  from public, anon;
grant execute on function
  public.create_party(text, int), public.join_party_by_code(text), public.leave_party(uuid),
  public.remove_party_player(uuid, uuid), public.start_party(uuid), public.play_party_again(uuid),
  public.end_party(uuid), public.seeta_guess(uuid, uuid), public.show_pick(uuid, int),
  public.show_call(uuid), public.party_nudge(uuid), public.get_party_state(uuid), public.get_my_parties()
  to authenticated;

-- ─── Clock + clean-up ────────────────────────────────────────────────────────────
select cron.schedule('party-tick', '1 seconds', $$select public.advance_due_parties()$$);
select cron.schedule('party-cleanup', '23 * * * *',
  $$delete from public.party_games where updated_at < now() - interval '2 days'
       or (status = 'closed' and updated_at < now() - interval '1 hour')$$);
