-- Snakes & Ladders levels (owner, 2026-11-27): 15 boards — easy 0–4 (4 snakes, 8 ladders),
-- medium 5–9 (the earlier 5 boards), hard 10–14 (9 snakes, 4 ladders). The host picks a level and
-- a board when creating (options.board 0–14). Same as SNL_BOARDS in app/src/game/engine/board.ts.

create or replace function public._snl_boards()
returns jsonb
language sql immutable set search_path = ''
as $$
  select '[{"ladders":{"2":22,"4":23,"8":47,"40":82,"46":75,"50":71,"53":88,"57":84},"snakes":{"31":10,"65":5,"89":9,"98":58}},{"ladders":{"3":43,"6":26,"8":28,"14":34,"17":37,"19":80,"33":68,"58":83},"snakes":{"25":5,"74":46,"90":9,"97":45}},{"ladders":{"2":23,"9":29,"10":30,"24":64,"31":51,"33":88,"36":65,"70":89},"snakes":{"34":14,"60":40,"83":39,"86":15}},{"ladders":{"5":25,"7":26,"12":53,"30":70,"40":81,"59":82,"68":88,"69":89},"snakes":{"24":3,"42":2,"94":35,"98":36}},{"ladders":{"8":28,"9":29,"15":55,"21":60,"23":77,"62":81,"66":86,"70":90},"snakes":{"42":22,"50":30,"76":16,"94":32}},{"ladders":{"4":37,"5":26,"11":69,"13":53,"20":40,"27":47,"35":55},"snakes":{"81":41,"87":66,"92":71,"93":73,"96":44,"98":22}},{"ladders":{"14":54,"15":46,"22":42,"25":85,"57":77,"60":79},"snakes":{"38":4,"41":20,"87":67,"90":28,"95":66,"98":43}},{"ladders":{"4":44,"8":32,"26":74,"30":51,"48":68,"57":77},"snakes":{"56":25,"69":49,"78":2,"81":21,"85":65,"91":73}},{"ladders":{"4":25,"10":30,"18":83,"20":42,"36":76,"44":77},"snakes":{"54":34,"68":29,"75":26,"80":60,"82":59,"91":31,"94":72}},{"ladders":{"3":43,"4":44,"10":30,"16":36,"21":81,"22":59},"snakes":{"26":6,"75":35,"87":29,"91":31,"97":65,"99":63}},{"ladders":{"10":30,"33":73,"37":84,"39":79},"snakes":{"22":2,"29":7,"38":3,"52":31,"67":5,"80":20,"91":71,"96":74,"98":78}},{"ladders":{"3":23,"39":83,"44":77,"50":69},"snakes":{"22":2,"24":6,"30":8,"32":14,"48":27,"61":20,"73":53,"91":71,"94":25}},{"ladders":{"6":36,"7":27,"9":70,"61":82},"snakes":{"23":3,"39":20,"60":40,"65":47,"75":55,"78":43,"84":17,"91":71,"93":34}},{"ladders":{"2":22,"3":43,"14":53,"40":81},"snakes":{"59":39,"69":10,"71":51,"77":15,"82":62,"86":65,"94":73,"96":56,"98":78}},{"ladders":{"7":28,"12":32,"30":51,"40":81},"snakes":{"21":2,"26":6,"42":23,"75":53,"83":59,"87":33,"92":70,"96":17,"99":79}}]'::jsonb
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
                     then jsonb_build_object('order', v_order, 'turn', v_users[1]::text, 'pos', v_pos, 'sixes', 0, 'misses', '{}'::jsonb, 'board', public._snl_boards() -> least(14, greatest(0, coalesce((g.options ->> 'board')::int, 0))))
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

create or replace function public.create_party(p_kind text, p_rounds int, p_entry int default 0, p_options jsonb default null)
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
    v_opts := jsonb_build_object('board', least(14, greatest(0, coalesce((p_options ->> 'board')::int, 0))));
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
