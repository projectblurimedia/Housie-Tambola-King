-- Owner, 2026-11-28:
--  * Snakes & Ladders: a 6 gives another roll only to a player already on the board (one still
--    waiting for a 1 has not started, so no extra roll).
--  * Ashta Chamma: an 8 (Ashta) that brings a pawn in brings a second waiting pawn in too ('pawn2').
--  * Board games can be a series (rounds 1–10): each game's winner gets a win and the next game is
--    dealt at once; after the last game the player(s) with the most wins take it (and the coin pot).

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
    perform public._board_next(p_game, v_roll = 6 and v_sixes < 3 and v_from > 0);
  end if;
end;
$$;

create or replace function public._chamma_move(p_game uuid, p_uid uuid, p_pawn int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.party_games;
  v_throw int;
  v_pawns int[];
  v_cut boolean;
  v_side int;
  v_from int;
  v_to int;
  v_cell int;
  v_captured jsonb := '[]'::jsonb;
  v_other text;
  v_op int[];
  v_oside int;
  j int;
  v_hit boolean;
  v_teams boolean;
  v_mate text;
  v_mate_done boolean;
  v_pawn2 int;
begin
  select * into g from public.party_games where id = p_game;
  v_throw := (g.state ->> 'throw')::int;
  v_pawns := public._jints(g.state -> 'pawns' -> p_uid::text);
  v_cut := coalesce((g.state -> 'cut' ->> p_uid::text)::boolean, false) or not coalesce((g.state ->> 'needCut')::boolean, true);
  v_side := (g.state -> 'sides' ->> p_uid::text)::int;
  v_teams := coalesce((g.state ->> 'teams')::boolean, false);
  if p_pawn is null or p_pawn not between 0 and 3 then
    raise exception 'INVALID_PAWN' using errcode = 'P0001';
  end if;
  v_from := v_pawns[p_pawn + 1];
  v_to := public._chamma_target(v_from, v_throw, v_cut);
  if v_to is null then
    raise exception 'INVALID_MOVE' using errcode = 'P0001';
  end if;
  v_pawns[p_pawn + 1] := v_to;
  -- Ashta (8) bringing a pawn in: a second waiting pawn comes in with it.
  if v_from = -1 and v_throw = 8 then
    for j in 1..4 loop
      if j <> p_pawn + 1 and v_pawns[j] = -1 then
        v_pawns[j] := 0;
        v_pawn2 := j - 1;
        exit;
      end if;
    end loop;
  end if;
  v_cell := public._chamma_cell(v_side, v_to);

  if not public._chamma_is_safe(v_cell, coalesce(g.state ->> 'safe', 'corners')) then
    for v_other in select jsonb_object_keys(g.state -> 'pawns') loop
      continue when v_other = p_uid::text;
      v_oside := (g.state -> 'sides' ->> v_other)::int;
      continue when v_teams and v_oside % 2 = v_side % 2;
      v_op := public._jints(g.state -> 'pawns' -> v_other);
      v_hit := false;
      for j in 1..4 loop
        if v_op[j] between 0 and 23 and public._chamma_cell(v_oside, v_op[j]) = v_cell then
          v_op[j] := case when coalesce(g.state ->> 'start', 'enter') = 'board' then 0 else -1 end;
          v_hit := true;
          v_captured := v_captured || jsonb_build_object('userId', v_other, 'pawn', j - 1);
        end if;
      end loop;
      if v_hit then
        g.state := jsonb_set(g.state, array['pawns', v_other], to_jsonb(v_op));
        update public.party_players set score = public._chamma_score(v_op) where game_id = p_game and user_id = v_other::uuid;
      end if;
    end loop;
  end if;
  if jsonb_array_length(v_captured) > 0 then
    g.state := jsonb_set(g.state, array['cut', p_uid::text], 'true'::jsonb);
  end if;
  g.state := jsonb_set(g.state, array['pawns', p_uid::text], to_jsonb(v_pawns))
             || jsonb_build_object('last', jsonb_build_object('userId', p_uid, 'pawn', p_pawn, 'from', v_from, 'to', v_to,
                                                              'throw', v_throw, 'captured', v_captured, 'pawn2', v_pawn2,
                                                              'at', extract(epoch from now())));
  update public.party_games set state = g.state, updated_at = now() where id = p_game;
  update public.party_players set score = public._chamma_score(v_pawns) where game_id = p_game and user_id = p_uid;
  perform public._party_broadcast(p_game, 'move', jsonb_build_object('userId', p_uid, 'pawn', p_pawn, 'from', v_from, 'to', v_to, 'captured', v_captured));

  if (select bool_and(x = 24) from unnest(v_pawns) x) then
    if v_teams then
      select k into v_mate from jsonb_object_keys(g.state -> 'sides') k
       where k <> p_uid::text and (g.state -> 'sides' ->> k)::int % 2 = v_side % 2 limit 1;
      v_mate_done := v_mate is null
        or (select bool_and(x = 24) from unnest(public._jints(g.state -> 'pawns' -> v_mate)) x)
        or not exists (select 1 from public.party_players where game_id = p_game and user_id = v_mate::uuid and active);
      if v_mate_done then
        perform public._board_finish_many(p_game, array_remove(array[p_uid, v_mate::uuid], null));
        return;
      end if;
    else
      perform public._board_finish(p_game, p_uid);
      return;
    end if;
  end if;
  perform public._board_next(p_game, v_throw in (4, 8) or jsonb_array_length(v_captured) > 0);
end;
$$;

create or replace function public._board_finish_many(p_game uuid, p_winners uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.party_games;
  v_wins jsonb;
  w uuid;
  v_top int;
  v_overall uuid[];
begin
  select * into g from public.party_games where id = p_game;
  v_wins := coalesce(g.state -> 'wins', '{}'::jsonb);
  foreach w in array p_winners loop
    v_wins := jsonb_set(v_wins, array[w::text], to_jsonb(coalesce((v_wins ->> w::text)::int, 0) + 1));
  end loop;
  -- More games to play (and still 2+ players): record the win and deal the next game.
  if g.round_no < g.rounds and (select count(*) from public.party_players where game_id = p_game and active) >= 2 then
    update public.party_games
       set state = state || jsonb_build_object('wins', v_wins, 'roundWinners', to_jsonb(p_winners)), updated_at = now()
     where id = p_game;
    perform public._party_broadcast(p_game, 'roundWon', jsonb_build_object('winners', to_jsonb(p_winners), 'roundNo', g.round_no));
    perform public._party_deal(p_game);
    return;
  end if;
  -- The last game (or a single game): whoever won most games wins (ties share).
  select max(value::int) into v_top from jsonb_each_text(v_wins);
  select array_agg(key::uuid) into v_overall from jsonb_each_text(v_wins) where value::int = v_top;
  v_overall := coalesce(v_overall, p_winners);
  update public.party_games
     set status = 'finished', phase = 'done', deadline = null,
         state = state || jsonb_build_object('winnerId', v_overall[1], 'winners', to_jsonb(v_overall), 'wins', v_wins), updated_at = now()
   where id = p_game;
  perform public._party_payout(p_game, v_overall);
  perform public._party_broadcast(p_game, 'finished', jsonb_build_object('winners', to_jsonb(v_overall)));
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
       set status = 'playing', round_no = g.round_no + 1, turn_no = 1,
           phase = case when g.kind = 'snakes' then 'turn' else 'throw' end,
           state = case when g.kind = 'snakes'
                     then jsonb_build_object('order', v_order, 'turn', v_users[1]::text, 'pos', v_pos, 'sixes', 0, 'misses', '{}'::jsonb, 'board', public._snl_boards() -> least(14, greatest(0, coalesce((g.options ->> 'board')::int, 0))),
                                             'wins', coalesce(g.state -> 'wins', '{}'::jsonb), 'roundWinners', g.state -> 'roundWinners')
                     else jsonb_build_object('order', v_order, 'turn', v_users[1]::text, 'pawns', v_pawns,
                                             'cut', v_cut, 'sides', v_sidemap, 'throw', null, 'misses', '{}'::jsonb,
                                             'start', coalesce(g.options ->> 'start', 'enter'),
                                             'safe', coalesce(g.options ->> 'safe', 'corners'),
                                             'teams', coalesce((g.options ->> 'teams')::boolean, false) and v_n = 4,
                                             'needCut', coalesce((g.options ->> 'needCut')::boolean, true),
                                             'wins', coalesce(g.state -> 'wins', '{}'::jsonb), 'roundWinners', g.state -> 'roundWinners')
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
  v_rounds int := case when public._party_board(p_kind) then least(10, greatest(1, coalesce(p_rounds, 1))) else p_rounds end;
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
    v_opts := jsonb_build_object(
      'board', least(14, greatest(0, coalesce((p_options ->> 'board')::int, 0))),
      'theme', least(8, greatest(0, coalesce((p_options ->> 'theme')::int, 0))),
      'icons', coalesce((p_options ->> 'icons')::boolean, true));
  elsif p_kind = 'chamma' then
    v_opts := jsonb_build_object(
      'start', case when p_options ->> 'start' = 'board' then 'board' else 'enter' end,
      'safe', case when p_options ->> 'safe' = 'straight' then 'straight' else 'corners' end,
      'teams', coalesce((p_options ->> 'teams')::boolean, false),
      'needCut', coalesce((p_options ->> 'needCut')::boolean, true));
  end if;
  -- ₹ Amount (scores only): no coins at all.
  if p_options ->> 'stake' = 'amount' then
    v_opts := v_opts || jsonb_build_object('stake', 'amount', 'amount', least(100000, greatest(0, coalesce((p_options ->> 'amount')::numeric, 0))));
    p_entry := 0;
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
