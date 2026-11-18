-- Owner's changes of 2026-11-18 (sixth round): a third claim rule, **Auto** — the app strikes
-- every called number and the server awards each prize to everyone who completed it on the
-- same number (shared). Stored as claim_mode 'fair' (the server's auto-award engine).
-- The host can switch the rule in the lobby (update_room_settings gains p_claim_mode).

create or replace function public.create_room(
  p_title text,
  p_kind public.room_kind,
  p_visibility public.room_visibility,
  p_max_players int,
  p_ticket_price numeric,
  p_call_interval_seconds int,
  p_series_length int,
  p_prizes jsonb,
  p_claim_mode text default 'fastest',
  p_auto_mark boolean default false,
  p_check_claims boolean default true,
  p_chat_enabled boolean default true,
  p_check_seconds int default 10
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  v_prizes jsonb := public._validate_prizes(p_prizes);
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_len int := case when p_kind = 'series' then coalesce(p_series_length, 0) else 1 end;
  v_room uuid;
  v_code text;
  v_attempt int := 0;
begin
  if (select count(*) from public.rooms where host_id = v_uid and status = 'open') >= 3 then
    raise exception 'TOO_MANY_OPEN_ROOMS' using errcode = 'P0001';
  end if;
  if p_ticket_price is null or p_ticket_price < 0 or p_ticket_price > 100000 then
    raise exception 'INVALID_TICKET_PRICE' using errcode = 'P0001';
  end if;
  if p_max_players is null or p_max_players not between 2 and 100 then
    raise exception 'INVALID_MAX_PLAYERS' using errcode = 'P0001';
  end if;
  if p_kind = 'series' and v_len <> 0 and v_len not between 2 and 50 then
    raise exception 'INVALID_SERIES_LENGTH' using errcode = 'P0001';
  end if;
  -- 'fastest' (Normal / Fastest finger, by check_claims) or 'fair' (= Auto: the server strikes and awards).
  if coalesce(p_claim_mode, 'fastest') not in ('fastest', 'fair') then
    raise exception 'INVALID_CLAIM_MODE' using errcode = 'P0001';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := public._random_code();
    begin
      insert into public.rooms (
        code, host_id, title, kind, visibility, max_players, ticket_price,
        call_interval_seconds, prizes, series_length, total_games, claim_mode, auto_mark, check_claims, chat_enabled, check_seconds
      ) values (
        v_code, v_uid, coalesce(left(v_title, 40), 'Housie Room'), p_kind, p_visibility, p_max_players,
        round(p_ticket_price, 2), least(greatest(coalesce(p_call_interval_seconds, 3), 1), 20),
        v_prizes, v_len, case when v_len = 0 then 500 else v_len end,
        coalesce(p_claim_mode, 'fastest'), coalesce(p_auto_mark, false), coalesce(p_check_claims, true) and coalesce(p_claim_mode, 'fastest') = 'fastest', coalesce(p_chat_enabled, true),
        public._clamp_check(coalesce(p_check_seconds, 10))
      ) returning id into v_room;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  perform public._join_room(v_room, v_uid);
  perform public._new_game(v_room);
  return jsonb_build_object('roomId', v_room, 'code', v_code);
end;
$$;

drop function public.update_room_settings(uuid, text, public.room_visibility, int, numeric, boolean, int, boolean, boolean);
create function public.update_room_settings(
  p_room uuid,
  p_title text,
  p_visibility public.room_visibility,
  p_max_players int,
  p_ticket_price numeric,
  p_check_claims boolean,
  p_check_seconds int,
  p_auto_mark boolean,
  p_chat_enabled boolean,
  p_claim_mode text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  r public.rooms;
  g public.games;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_price numeric := round(coalesce(p_ticket_price, 0), 2);
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;
  if r.host_id is distinct from v_uid then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if r.status <> 'open' then
    raise exception 'ROOM_ENDED' using errcode = 'P0001';
  end if;
  select * into g from public.games where id = r.current_game_id for update;
  if g.id is null or g.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001';
  end if;
  if v_price < 0 or v_price > 100000 then
    raise exception 'INVALID_TICKET_PRICE' using errcode = 'P0001';
  end if;
  if p_max_players is null or p_max_players not between 2 and 100 or p_max_players < r.member_count then
    raise exception 'INVALID_MAX_PLAYERS' using errcode = 'P0001';
  end if;
  if p_claim_mode is not null and p_claim_mode not in ('fastest', 'fair') then
    raise exception 'INVALID_CLAIM_MODE' using errcode = 'P0001';
  end if;
  if v_price <> r.ticket_price and exists (select 1 from public.tickets where game_id = g.id) then
    raise exception 'PRICE_LOCKED' using errcode = 'P0001';
  end if;

  update public.rooms
     set title = coalesce(left(v_title, 40), title),
         visibility = coalesce(p_visibility, visibility),
         max_players = p_max_players,
         ticket_price = v_price,
         claim_mode = coalesce(p_claim_mode, claim_mode),
         check_claims = coalesce(p_check_claims, check_claims) and coalesce(p_claim_mode, claim_mode) = 'fastest',
         check_seconds = public._clamp_check(coalesce(p_check_seconds, check_seconds)),
         auto_mark = coalesce(p_auto_mark, auto_mark),
         chat_enabled = coalesce(p_chat_enabled, chat_enabled)
   where id = p_room;
  if v_price <> g.ticket_price then
    update public.games set ticket_price = v_price where id = g.id;
    perform public._recount_game(g.id);
  end if;
  perform public._broadcast(p_room, 'room_settings', jsonb_build_object('roomId', p_room));
end;
$$;

revoke execute on function public.update_room_settings(uuid, text, public.room_visibility, int, numeric, boolean, int, boolean, boolean, text) from public, anon;
grant execute on function public.update_room_settings(uuid, text, public.room_visibility, int, numeric, boolean, int, boolean, boolean, text) to authenticated;
