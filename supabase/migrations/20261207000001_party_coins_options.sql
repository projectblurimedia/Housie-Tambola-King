-- Party games, round 3:
-- • Coins: the host sets an entry (0–10,000 play coins). Everyone pays it when the game starts;
--   the winner (or winners / a team, split equally) takes the pot. The host ending a game
--   mid-play refunds everyone; a player who leaves mid-game forfeits their entry.
-- • Board games: 3 chances — a player whose turn the server has to play 3 times is out; the last
--   one standing (or the other team) wins.
-- • Ashta Chamma options (chosen at create): start ('enter' = come in on 4 / 8, 'board' = all
--   pawns start on their square), safe ('corners' = inner-ring corners also safe, 'straight' =
--   inner squares straight in from each start square also safe), teams (4 players: opposite
--   sides play together, never cut each other, win when both are home), needCut (a cut is
--   needed before going into the inner ring).

alter table public.party_games add column entry_coins int not null default 0 check (entry_coins between 0 and 10000);
alter table public.party_players add column paid int not null default 0;

-- ─── Coins ───────────────────────────────────────────────────────────────────────
/** Pay the pot to the winners (equal split, remainder to the first) and clear the entries. */
create function public._party_payout(p_game uuid, p_winners uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_code text;
  v_pot int;
  v_n int := coalesce(array_length(p_winners, 1), 0);
  v_each int;
  v_rem int;
  i int;
begin
  select code into v_code from public.party_games where id = p_game;
  select coalesce(sum(paid), 0) into v_pot from public.party_players where game_id = p_game;
  if v_pot > 0 and v_n > 0 then
    v_each := v_pot / v_n;
    v_rem := v_pot - v_each * v_n;
    for i in 1..v_n loop
      update public.profiles set coins = coins + v_each + case when i = 1 then v_rem else 0 end where id = p_winners[i];
      insert into public.coin_ledger (user_id, delta, reason, note)
      values (p_winners[i], v_each + case when i = 1 then v_rem else 0 end, 'prize', 'party:' || v_code);
    end loop;
    update public.party_games
       set state = state || jsonb_build_object('payout', jsonb_build_object('pot', v_pot, 'each', v_each))
     where id = p_game;
  end if;
  update public.party_players set paid = 0 where game_id = p_game;
end;
$$;

/** Give everyone's entry back (host ended the game mid-play). */
create function public._party_refund(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_code text;
  r record;
begin
  select code into v_code from public.party_games where id = p_game;
  for r in select user_id, paid from public.party_players where game_id = p_game and paid > 0 loop
    update public.profiles set coins = coins + r.paid where id = r.user_id;
    insert into public.coin_ledger (user_id, delta, reason, note) values (r.user_id, r.paid, 'refund', 'party:' || v_code);
  end loop;
  update public.party_players set paid = 0 where game_id = p_game;
end;
$$;

/** Card games: the top scorer(s) among those still playing. */
create function public._party_top(p_game uuid)
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(user_id), '{}') from public.party_players
   where game_id = p_game and active
     and score = (select max(score) from public.party_players where game_id = p_game and active)
$$;

-- ─── Ashta Chamma rules with options ─────────────────────────────────────────────
create function public._chamma_is_safe(p_cell int, p_mode text)
returns boolean
language sql immutable set search_path = ''
as $$
  select p_cell in (22, 14, 2, 10, 12)
      or (p_mode = 'corners' and p_cell in (6, 8, 16, 18))
      or (p_mode = 'straight' and p_cell in (7, 11, 13, 17))
$$;

/** Board game over: winners take the pot; state.winners lists them. */
create function public._board_finish_many(p_game uuid, p_winners uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.party_games
     set status = 'finished', phase = 'done', deadline = null,
         state = state || jsonb_build_object('winnerId', p_winners[1], 'winners', to_jsonb(p_winners)), updated_at = now()
   where id = p_game;
  perform public._party_payout(p_game, p_winners);
  perform public._party_broadcast(p_game, 'finished', jsonb_build_object('winners', to_jsonb(p_winners)));
end;
$$;

create or replace function public._board_finish(p_game uuid, p_winner uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._board_finish_many(p_game, array[p_winner]);
end;
$$;

/** Ended because players are out / left? (last one standing, or a team with nobody left). */
create function public._board_check_end(p_game uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  g public.party_games;
  v_active uuid[];
  t int;
begin
  select * into g from public.party_games where id = p_game;
  if g.status <> 'playing' then
    return true;
  end if;
  select coalesce(array_agg(user_id order by seat), '{}') into v_active from public.party_players where game_id = p_game and active;
  if g.kind = 'chamma' and coalesce((g.state ->> 'teams')::boolean, false) then
    for t in 0..1 loop
      if not exists (
        select 1 from unnest(v_active) u where ((g.state -> 'sides' ->> u::text)::int % 2) = t
      ) then
        perform public._board_finish_many(p_game, (
          select coalesce(array_agg(u), '{}') from unnest(v_active) u where ((g.state -> 'sides' ->> u::text)::int % 2) <> t
        ));
        return true;
      end if;
    end loop;
    return false;
  end if;
  if coalesce(array_length(v_active, 1), 0) < 2 then
    perform public._board_finish_many(p_game, v_active);
    return true;
  end if;
  return false;
end;
$$;

/** The server played a turn for p_uid: one of their 3 chances gone; the 3rd puts them out. */
create function public._board_miss(p_game uuid, p_uid uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_misses int;
begin
  update public.party_games
     set state = state || jsonb_build_object('misses',
                   coalesce(state -> 'misses', '{}'::jsonb)
                   || jsonb_build_object(p_uid::text, coalesce((state -> 'misses' ->> p_uid::text)::int, 0) + 1))
   where id = p_game
  returning (state -> 'misses' ->> p_uid::text)::int into v_misses;
  if v_misses >= 3 then
    update public.party_players set active = false where game_id = p_game and user_id = p_uid;
    perform public._party_broadcast(p_game, 'players', jsonb_build_object('out', p_uid));
    return true;
  end if;
  return false;
end;
$$;

create or replace function public._board_next(p_game uuid, p_same boolean default false)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.party_games;
  v_order text[];
  v_n int;
  v_i int;
  v_k int;
  v_next text;
  v_ok boolean;
begin
  select * into g from public.party_games where id = p_game;
  select array_agg(x order by o) into v_order from jsonb_array_elements_text(g.state -> 'order') with ordinality t(x, o);
  v_n := array_length(v_order, 1);
  v_next := g.state ->> 'turn';
  -- Playable = still in, and (Ashta Chamma) not already all home.
  v_ok := exists (select 1 from public.party_players where game_id = p_game and user_id = v_next::uuid and active)
          and not (g.kind = 'chamma' and (select bool_and(x = 24) from unnest(public._jints(g.state -> 'pawns' -> v_next)) x));
  if not p_same or not v_ok then
    v_i := array_position(v_order, g.state ->> 'turn');
    for v_k in 1..v_n loop
      v_next := v_order[((coalesce(v_i, 0) - 1 + v_k) % v_n) + 1];
      exit when exists (select 1 from public.party_players where game_id = p_game and user_id = v_next::uuid and active)
            and not (g.kind = 'chamma' and (select bool_and(x = 24) from unnest(public._jints(g.state -> 'pawns' -> v_next)) x));
    end loop;
  end if;
  update public.party_games
     set phase = case when g.kind = 'snakes' then 'turn' else 'throw' end,
         state = state || jsonb_build_object('turn', v_next, 'throw', null,
                                             'sixes', case when p_same then coalesce((state ->> 'sixes')::int, 0) else 0 end),
         deadline = now() + interval '20 seconds', updated_at = now()
   where id = p_game;
  perform public._party_broadcast(p_game, 'turn', jsonb_build_object('userId', v_next));
end;
$$;

create or replace function public._chamma_throw(p_game uuid, p_uid uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.party_games;
  v_seeds jsonb := '[]'::jsonb;
  v_up int := 0;
  v_throw int;
  v_pawns int[];
  v_cut boolean;
  v_any boolean := false;
  i int;
  b boolean;
begin
  select * into g from public.party_games where id = p_game;
  for i in 1..4 loop
    b := random() < 0.5;
    v_seeds := v_seeds || to_jsonb(b);
    if b then v_up := v_up + 1; end if;
  end loop;
  v_throw := case when v_up = 0 then 8 else v_up end;
  v_pawns := public._jints(g.state -> 'pawns' -> p_uid::text);
  v_cut := coalesce((g.state -> 'cut' ->> p_uid::text)::boolean, false) or not coalesce((g.state ->> 'needCut')::boolean, true);
  for i in 1..4 loop
    if public._chamma_target(v_pawns[i], v_throw, v_cut) is not null then v_any := true; end if;
  end loop;
  update public.party_games
     set state = state || jsonb_build_object('throw', v_throw, 'seeds', v_seeds, 'thrownAt', extract(epoch from now()), 'thrownBy', p_uid),
         phase = case when v_any then 'move' else phase end,
         deadline = now() + interval '20 seconds', updated_at = now()
   where id = p_game;
  perform public._party_broadcast(p_game, 'throw', jsonb_build_object('userId', p_uid, 'throw', v_throw, 'seeds', v_seeds));
  if not v_any then
    perform public._board_next(p_game, v_throw in (4, 8));
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
                                                              'throw', v_throw, 'captured', v_captured,
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

-- ─── Dealing with options; clock with 3 chances ──────────────────────────────────
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
                     then jsonb_build_object('order', v_order, 'turn', v_users[1]::text, 'pos', v_pos, 'sixes', 0, 'misses', '{}'::jsonb)
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

create or replace function public._party_tick(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.party_games;
  v_target uuid;
  v_turn uuid;
  v_pawns int[];
  v_cut boolean;
  v_best int := -1;
  v_best_idx int := -2;
  i int;
  v_t int;
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
  elsif g.phase in ('turn', 'throw', 'move') then
    v_turn := (g.state ->> 'turn')::uuid;
    if not exists (select 1 from public.party_players where game_id = p_game and user_id = v_turn and active) then
      if not public._board_check_end(p_game) then perform public._board_next(p_game); end if;
      return;
    end if;
    -- One of their 3 chances; the 3rd puts them out.
    if public._board_miss(p_game, v_turn) then
      if not public._board_check_end(p_game) then perform public._board_next(p_game); end if;
      return;
    end if;
    select * into g from public.party_games where id = p_game;
    if g.phase = 'turn' then
      perform public._snakes_roll(p_game, v_turn);
    elsif g.phase = 'throw' then
      perform public._chamma_throw(p_game, v_turn);
    else
      v_pawns := public._jints(g.state -> 'pawns' -> v_turn::text);
      v_cut := coalesce((g.state -> 'cut' ->> v_turn::text)::boolean, false) or not coalesce((g.state ->> 'needCut')::boolean, true);
      for i in 1..4 loop
        v_t := public._chamma_target(v_pawns[i], (g.state ->> 'throw')::int, v_cut);
        if v_t is not null and v_pawns[i] > v_best_idx then
          v_best := i - 1;
          v_best_idx := v_pawns[i];
        end if;
      end loop;
      if v_best >= 0 then
        perform public._chamma_move(p_game, v_turn, v_best);
      else
        perform public._board_next(p_game);
      end if;
    end if;
  end if;
end;
$$;

create or replace function public._party_after_reveal(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.party_games;
  v_top uuid[];
begin
  select * into g from public.party_games where id = p_game;
  if g.round_no >= g.rounds then
    v_top := public._party_top(p_game);
    update public.party_games
       set status = 'finished', phase = 'done', deadline = null,
           state = state || jsonb_build_object('winners', to_jsonb(v_top)), updated_at = now()
     where id = p_game;
    delete from public.party_secrets where game_id = p_game;
    perform public._party_payout(p_game, v_top);
    perform public._party_broadcast(p_game, 'finished', '{}'::jsonb);
  else
    perform public._party_deal(p_game);
  end if;
end;
$$;

create or replace function public._party_check_players(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.party_games;
  v_top uuid[];
begin
  select * into g from public.party_games where id = p_game;
  if g.status <> 'playing' then
    return;
  end if;
  if public._party_board(g.kind) then
    perform public._board_check_end(p_game);
  elsif (select count(*) from public.party_players where game_id = p_game and active) < public._party_min(g.kind) then
    v_top := public._party_top(p_game);
    update public.party_games
       set status = 'finished', phase = 'done', deadline = null,
           state = state || jsonb_build_object('winners', to_jsonb(v_top)), updated_at = now()
     where id = p_game;
    delete from public.party_secrets where game_id = p_game;
    perform public._party_payout(p_game, v_top);
    perform public._party_broadcast(p_game, 'finished', '{}'::jsonb);
  end if;
end;
$$;

-- ─── Client API changes ──────────────────────────────────────────────────────────
drop function public.create_party(text, int);
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

create or replace function public.join_party_by_code(p_code text)
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
  if g.entry_coins > 0 and (select coins from public.profiles where id = v_uid) < g.entry_coins then
    raise exception 'NOT_ENOUGH_COINS' using errcode = 'P0001';
  end if;
  insert into public.party_players (game_id, user_id, seat)
  values (g.id, v_uid, coalesce((select max(seat) + 1 from public.party_players where game_id = g.id), 0))
  on conflict (game_id, user_id) do update set active = true, score = 0;
  update public.party_games set updated_at = now() where id = g.id;
  perform public._party_broadcast(g.id, 'players', '{}'::jsonb);
  return g.id;
end;
$$;

create or replace function public.start_party(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.party_games;
  v_n int;
  r record;
begin
  select * into g from public.party_games where id = p_game for update;
  if g.host_id is distinct from v_uid then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if g.status <> 'lobby' then
    raise exception 'PARTY_STARTED' using errcode = 'P0001';
  end if;
  select count(*) into v_n from public.party_players where game_id = p_game and active;
  if v_n < public._party_min(g.kind) then
    raise exception 'NEED_MORE_PLAYERS' using errcode = 'P0001';
  end if;
  if g.kind = 'show' and g.options ->> 'category' = 'custom'
     and jsonb_array_length(coalesce(g.options -> 'items', '[]'::jsonb)) < v_n then
    raise exception 'NOT_ENOUGH_ITEMS' using errcode = 'P0001';
  end if;
  if g.kind = 'chamma' and coalesce((g.options ->> 'teams')::boolean, false) and v_n <> 4 then
    raise exception 'TEAMS_NEED_4' using errcode = 'P0001';
  end if;
  -- Entries: everyone must have enough; then all pay at once.
  if g.entry_coins > 0 then
    if exists (
      select 1 from public.party_players p join public.profiles pr on pr.id = p.user_id
       where p.game_id = p_game and p.active and pr.coins < g.entry_coins
    ) then
      raise exception 'PLAYER_LOW_COINS' using errcode = 'P0001';
    end if;
    for r in select user_id from public.party_players where game_id = p_game and active loop
      update public.profiles set coins = coins - g.entry_coins where id = r.user_id;
      insert into public.coin_ledger (user_id, delta, reason, note) values (r.user_id, -g.entry_coins, 'ticket', 'party:' || g.code);
    end loop;
    update public.party_players set paid = g.entry_coins where game_id = p_game and active;
  end if;
  update public.party_players p set seat = r2.rn - 1, score = 0
    from (select user_id, row_number() over (order by seat, joined_at) as rn
            from public.party_players where game_id = p_game and active) r2
   where p.game_id = p_game and p.user_id = r2.user_id;
  update public.party_games set round_no = 0 where id = p_game;
  perform public._party_deal(p_game);
end;
$$;

create or replace function public.end_party(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if (select host_id from public.party_games where id = p_game) is distinct from v_uid then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  perform public._party_refund(p_game);
  update public.party_games set status = 'closed', deadline = null, updated_at = now() where id = p_game;
  delete from public.party_secrets where game_id = p_game;
  perform public._party_broadcast(p_game, 'closed', '{}'::jsonb);
end;
$$;

create or replace function public.get_party_state(p_game uuid)
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
      'state', g.state, 'options', g.options, 'deadline', g.deadline, 'entryCoins', g.entry_coins,
      'pot', (select coalesce(sum(paid), 0) from public.party_players where game_id = g.id)),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
               'userId', p.user_id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
               'seat', p.seat, 'score', p.score, 'active', p.active, 'paid', p.paid,
               'picked', (select ps.pick is not null from public.party_secrets ps
                           where ps.game_id = p.game_id and ps.user_id = p.user_id))
             order by p.seat)
        from public.party_players p join public.profiles pr on pr.id = p.user_id
       where p.game_id = p_game), '[]'::jsonb),
    'me', jsonb_build_object('userId', v_uid, 'role', s.role, 'hand', to_jsonb(s.hand), 'pick', s.pick,
                             'coins', (select coins from public.profiles where id = v_uid)),
    'serverNow', now()
  );
end;
$$;

revoke execute on function
  public._party_payout(uuid, uuid[]), public._party_refund(uuid), public._party_top(uuid),
  public._chamma_is_safe(int, text), public._board_finish_many(uuid, uuid[]), public._board_check_end(uuid),
  public._board_miss(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.create_party(text, int, int, jsonb) from public, anon;
grant execute on function public.create_party(text, int, int, jsonb) to authenticated;
