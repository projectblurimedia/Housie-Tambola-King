-- Snakes & Ladders, round 5 (owner, 2026-11-27):
-- • 5 hand-picked boards (upright ladders, no two pieces overlapping, two big snakes each); the
--   host picks one when creating (options.board 0–4). Kept in step with app/src/game/engine/board.ts.
-- • Everyone starts off the board; a 1 brings your token onto square 1 (then play as usual).
-- • Up to 10 players.
-- • Party chat for every party game (party_chat + send / get, broadcast "chat" on party:<id>).

create function public._snl_boards()
returns jsonb
language sql immutable set search_path = ''
as $$
  select '[
    {"ladders":{"2":22,"3":37,"39":59,"45":65,"68":88,"69":89},"snakes":{"25":6,"52":28,"61":21,"64":43,"71":11,"87":35,"96":76,"99":77}},
    {"ladders":{"5":25,"8":29,"15":35,"49":89,"61":81,"68":88},"snakes":{"41":20,"54":33,"70":30,"77":17,"85":56,"91":71,"94":66,"99":23}},
    {"ladders":{"5":25,"9":29,"19":59,"35":65,"53":88,"54":74},"snakes":{"26":7,"30":10,"33":8,"63":24,"81":40,"90":32,"95":75,"98":79}},
    {"ladders":{"7":34,"9":28,"17":38,"21":41,"33":53,"47":87,"68":88},"snakes":{"31":11,"45":15,"75":55,"79":19,"81":61,"83":65,"91":49}},
    {"ladders":{"5":37,"7":46,"20":40,"30":50,"51":71,"56":75,"64":84},"snakes":{"42":2,"48":28,"78":18,"80":41,"82":59,"89":29,"93":67}}
  ]'::jsonb
$$;

create or replace function public._party_max(p_kind text)
returns int
language sql immutable set search_path = ''
as $$ select case p_kind when 'seeta' then 15 when 'show' then 10 when 'snakes' then 10 else 4 end $$;

create or replace function public._snakes_roll(p_game uuid, p_uid uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.party_games;
  v_roll int := 1 + floor(random() * 6)::int;
  v_from int;
  v_mid int;
  v_to int;
  v_sixes int;
begin
  select * into g from public.party_games where id = p_game;
  v_from := coalesce((g.state -> 'pos' ->> p_uid::text)::int, 0);
  if v_from = 0 then
    -- Off the board: only a 1 brings the token onto square 1.
    v_mid := case when v_roll = 1 then 1 else 0 end;
  else
    v_mid := case when v_from + v_roll > 100 then v_from else v_from + v_roll end;
  end if;
  if g.state ? 'board' then
    v_to := coalesce((g.state -> 'board' -> 'ladders' ->> v_mid::text)::int, (g.state -> 'board' -> 'snakes' ->> v_mid::text)::int, v_mid);
  else
    v_to := public._snl_jump(v_mid);
  end if;
  v_sixes := case when v_roll = 6 then coalesce((g.state ->> 'sixes')::int, 0) + 1 else 0 end;
  update public.party_games
     set state = jsonb_set(state, array['pos', p_uid::text], to_jsonb(v_to))
                 || jsonb_build_object('roll', v_roll, 'sixes', v_sixes,
                                       'last', jsonb_build_object('userId', p_uid, 'roll', v_roll, 'from', v_from,
                                                                  'mid', v_mid, 'to', v_to, 'at', extract(epoch from now()))),
         updated_at = now()
   where id = p_game;
  update public.party_players set score = v_to where game_id = p_game and user_id = p_uid;
  perform public._party_broadcast(p_game, 'move', jsonb_build_object('userId', p_uid, 'roll', v_roll, 'from', v_from, 'mid', v_mid, 'to', v_to));
  if v_to = 100 then
    perform public._board_finish(p_game, p_uid);
  else
    perform public._board_next(p_game, v_roll = 6 and v_sixes < 3);
  end if;
end;
$$;

-- ─── Party chat ──────────────────────────────────────────────────────────────────
create table public.party_chat (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.party_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
create index party_chat_game_idx on public.party_chat (game_id, id desc);
create index party_chat_user_idx on public.party_chat (user_id);
alter table public.party_chat enable row level security;

create function public.send_party_chat(p_game uuid, p_body text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  v_body text := btrim(coalesce(p_body, ''));
  m public.party_chat;
  pr public.profiles;
  v_msg jsonb;
begin
  perform public._party_member(p_game, v_uid);
  if char_length(v_body) not between 1 and 200 then
    raise exception 'INVALID_MESSAGE' using errcode = 'P0001';
  end if;
  if (select count(*) from public.party_chat where user_id = v_uid and created_at > now() - interval '10 seconds') >= 5 then
    raise exception 'CHAT_TOO_FAST' using errcode = 'P0001';
  end if;
  insert into public.party_chat (game_id, user_id, body) values (p_game, v_uid, v_body) returning * into m;
  select * into pr from public.profiles where id = v_uid;
  v_msg := jsonb_build_object('id', m.id, 'userId', v_uid, 'name', pr.display_name, 'avatarKey', pr.avatar_key, 'body', m.body, 'at', m.created_at);
  perform public._party_broadcast(p_game, 'chat', v_msg);
  return v_msg;
end;
$$;

/** The last 80 messages since I joined this game. */
create function public.get_party_chat(p_game uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  m public.party_players;
begin
  m := public._party_member(p_game, v_uid);
  return coalesce((
    select jsonb_agg(x.msg order by x.id)
      from (
        select c.id, jsonb_build_object('id', c.id, 'userId', c.user_id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
                                        'body', c.body, 'at', c.created_at) as msg
          from public.party_chat c join public.profiles pr on pr.id = c.user_id
         where c.game_id = p_game and c.created_at >= m.joined_at
         order by c.id desc
         limit 80
      ) x), '[]'::jsonb);
end;
$$;

create or replace function public._party_deal(p_game uuid)
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
  v_sides int[];
  v_pos jsonb := '{}'::jsonb;
  v_pawns jsonb := '{}'::jsonb;
  v_cut jsonb := '{}'::jsonb;
  v_sidemap jsonb := '{}'::jsonb;
  v_order jsonb := '[]'::jsonb;
  v_start int;
begin
  select * into g from public.party_games where id = p_game;
  select array_agg(user_id order by seat) into v_users
    from public.party_players where game_id = p_game and active;
  v_n := coalesce(array_length(v_users, 1), 0);
  delete from public.party_secrets where game_id = p_game;

  if g.kind = 'seeta' then
    select array_agg(u order by random()) into v_users from unnest(v_users) u;
    for i in 1..v_n loop
      insert into public.party_secrets (game_id, user_id, role) values (p_game, v_users[i], v_roles[i]);
    end loop;
    update public.party_games
       set status = 'playing', round_no = round_no + 1, phase = 'guess', turn_no = 0,
           state = jsonb_build_object('ramId', v_users[1]),
           deadline = now() + interval '60 seconds', updated_at = now()
     where id = p_game;
  elsif g.kind = 'show' then
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
  else
    v_sides := case v_n when 2 then array[0, 2] when 3 then array[0, 1, 2] else array[0, 1, 2, 3, 4, 5] end;
    v_start := case when coalesce(g.options ->> 'start', 'enter') = 'board' then 0 else -1 end;
    for i in 1..v_n loop
      v_order := v_order || to_jsonb(v_users[i]::text);
      v_pos := v_pos || jsonb_build_object(v_users[i]::text, 0);
      v_pawns := v_pawns || jsonb_build_object(v_users[i]::text, jsonb_build_array(v_start, v_start, v_start, v_start));
      v_cut := v_cut || jsonb_build_object(v_users[i]::text, false);
      v_sidemap := v_sidemap || jsonb_build_object(v_users[i]::text, v_sides[i]);
    end loop;
    update public.party_players set score = 0 where game_id = p_game;
    update public.party_games
       set status = 'playing', round_no = 1, rounds = 1, turn_no = 1,
           phase = case when g.kind = 'snakes' then 'turn' else 'throw' end,
           state = case when g.kind = 'snakes'
                     then jsonb_build_object('order', v_order, 'turn', v_users[1]::text, 'pos', v_pos, 'sixes', 0, 'misses', '{}'::jsonb, 'board', public._snl_boards() -> least(4, greatest(0, coalesce((g.options ->> 'board')::int, 0))))
                     else jsonb_build_object('order', v_order, 'turn', v_users[1]::text, 'pawns', v_pawns,
                                             'cut', v_cut, 'sides', v_sidemap, 'throw', null, 'misses', '{}'::jsonb,
                                             'start', coalesce(g.options ->> 'start', 'enter'),
                                             'safe', coalesce(g.options ->> 'safe', 'corners'),
                                             'teams', coalesce((g.options ->> 'teams')::boolean, false) and v_n = 4,
                                             'needCut', coalesce((g.options ->> 'needCut')::boolean, true))
                   end,
           deadline = now() + interval '20 seconds', updated_at = now()
     where id = p_game;
  end if;
  perform public._party_broadcast(p_game, 'round', jsonb_build_object('roundNo', g.round_no + 1));
end;
$$;

drop function public.create_party(text, int, int, jsonb);
create function public.create_party(p_kind text, p_rounds int, p_entry int default 0, p_options jsonb default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  v_code text;
  v_id uuid;
  v_rounds int := case when public._party_board(p_kind) then 1 else p_rounds end;
  v_opts jsonb := '{}'::jsonb;
begin
  if p_kind not in ('seeta', 'show', 'snakes', 'chamma') then
    raise exception 'INVALID_PARTY_KIND' using errcode = 'P0001';
  end if;
  if v_rounds is null or v_rounds not between 1 and 20 or (not public._party_board(p_kind) and v_rounds < 3) then
    raise exception 'INVALID_ROUNDS' using errcode = 'P0001';
  end if;
  if coalesce(p_entry, 0) not between 0 and 10000 then
    raise exception 'INVALID_ENTRY' using errcode = 'P0001';
  end if;
  if coalesce(p_entry, 0) > 0 and (select coins from public.profiles where id = v_uid) < p_entry then
    raise exception 'NOT_ENOUGH_COINS' using errcode = 'P0001';
  end if;
  if (select count(*) from public.party_games where host_id = v_uid and status in ('lobby', 'playing')) >= 3 then
    raise exception 'TOO_MANY_OPEN_PARTIES' using errcode = 'P0001';
  end if;
  if p_kind = 'show' then
    v_opts := '{"category":"colors"}'::jsonb;
  elsif p_kind = 'snakes' then
    v_opts := jsonb_build_object('board', least(4, greatest(0, coalesce((p_options ->> 'board')::int, 0))));
  elsif p_kind = 'chamma' then
    v_opts := jsonb_build_object(
      'start', case when p_options ->> 'start' = 'board' then 'board' else 'enter' end,
      'safe', case when p_options ->> 'safe' = 'straight' then 'straight' else 'corners' end,
      'teams', coalesce((p_options ->> 'teams')::boolean, false),
      'needCut', coalesce((p_options ->> 'needCut')::boolean, true));
  end if;
  loop
    v_code := public._random_code();
    exit when not exists (select 1 from public.party_games where code = v_code)
          and not exists (select 1 from public.rooms where code = v_code);
  end loop;
  insert into public.party_games (code, kind, host_id, rounds, options, entry_coins)
  values (v_code, p_kind, v_uid, v_rounds, v_opts, coalesce(p_entry, 0))
  returning id into v_id;
  insert into public.party_players (game_id, user_id, seat) values (v_id, v_uid, 0);
  return jsonb_build_object('id', v_id, 'code', v_code);
end;
$$;

revoke execute on function public._snl_boards() from public, anon, authenticated;
revoke execute on function public.create_party(text, int, int, jsonb), public.send_party_chat(uuid, text), public.get_party_chat(uuid) from public, anon;
grant execute on function public.create_party(text, int, int, jsonb), public.send_party_chat(uuid, text), public.get_party_chat(uuid) to authenticated;
