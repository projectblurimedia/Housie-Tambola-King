-- Snakes & Ladders: a fresh board for every game, saved on the game (state.board) so every
-- phone draws the same one. Never a ladder straight to 100; always two big snakes; endpoints
-- never shared (so no chains). Older games without a board keep the classic layout.

create function public._snl_board()
returns jsonb
language plpgsql volatile set search_path = ''
as $$
declare
  v_used int[] := array[1, 100];
  v_ladders jsonb := '{}'::jsonb;
  v_snakes jsonb := '{}'::jsonb;
  v_a int;
  v_b int;
  v_try int;
  k int;
  -- [kind, min start, max start, min length, max length]: 2 big snakes, 6 more, 8 ladders.
  v_specs int[][] := array[
    array[1, 84, 99, 55, 80], array[1, 62, 83, 40, 55],
    array[1, 25, 99, 10, 30], array[1, 25, 99, 10, 30], array[1, 25, 99, 10, 30],
    array[1, 25, 99, 12, 35], array[1, 40, 99, 15, 40], array[1, 20, 70, 10, 25],
    array[0, 2, 15, 15, 35], array[0, 5, 30, 10, 30], array[0, 10, 45, 12, 35], array[0, 20, 55, 10, 30],
    array[0, 30, 65, 12, 30], array[0, 40, 75, 10, 22], array[0, 50, 80, 8, 16], array[0, 60, 85, 6, 12]];
begin
  for k in 1..array_length(v_specs, 1) loop
    for v_try in 1..300 loop
      v_a := v_specs[k][2] + floor(random() * (v_specs[k][3] - v_specs[k][2] + 1))::int;
      v_b := case when v_specs[k][1] = 1
                  then v_a - (v_specs[k][4] + floor(random() * (v_specs[k][5] - v_specs[k][4] + 1))::int)
                  else v_a + (v_specs[k][4] + floor(random() * (v_specs[k][5] - v_specs[k][4] + 1))::int) end;
      -- Ladder tops stay below 98 (never straight to 100); snake tails above 1.
      continue when v_b < 2 or v_b > 97 or v_a = v_b or v_a = any(v_used) or v_b = any(v_used);
      -- Not both ends in the same row of ten (it would look flat).
      continue when (v_a - 1) / 10 = (v_b - 1) / 10;
      v_used := v_used || v_a || v_b;
      if v_specs[k][1] = 1 then
        v_snakes := v_snakes || jsonb_build_object(v_a::text, v_b);
      else
        v_ladders := v_ladders || jsonb_build_object(v_a::text, v_b);
      end if;
      exit;
    end loop;
  end loop;
  return jsonb_build_object('ladders', v_ladders, 'snakes', v_snakes);
end;
$$;

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
  v_mid := case when v_from + v_roll > 100 then v_from else v_from + v_roll end;
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
                     then jsonb_build_object('order', v_order, 'turn', v_users[1]::text, 'pos', v_pos, 'sixes', 0, 'misses', '{}'::jsonb, 'board', public._snl_board())
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

revoke execute on function public._snl_board() from public, anon, authenticated;
