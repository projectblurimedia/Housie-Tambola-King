-- Snakes & Ladders board design (owner, 2026-11-28): the host also picks one of 9 board designs
-- (options.theme 0–8: folk bright, flower garden, royal folk, kids, festival, folk sea-snakes, ocean,
-- deep sea, waves) and whether the squares show pictures (options.icons, default on). Looks only —
-- the snakes and ladders still come from options.board (level + layout).

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
