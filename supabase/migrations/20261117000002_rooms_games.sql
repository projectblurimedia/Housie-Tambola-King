-- Rooms, series of games, tickets, the secret draw order, prizes, winners, standings.
--
-- Room   = a group of players with a 6-char code. kind 'normal' (one game; host can play
--          again) or 'series' (N games back to back). visibility 'public' (listed) or 'private'.
-- Game   = one round inside a room: lobby (players pick 1–4 tickets) → running → finished.
-- Prizes = host-chosen subset of: Fast 3/5/7, Lines 1–3, Column groups Left/Center/Right,
--          Full Housie. Amounts are casual ₹ play values; before a game starts they must add
--          up to the pot (tickets × ticket price) — the host can edit them or they are split
--          automatically in proportion to the room's template amounts.
-- Claims = the player taps (strikes) called numbers; when their strikes complete a prize the
--          app claims it. First claim wins; anyone who completed it on the SAME called number
--          and claims before the next number is called shares it equally.
--
-- Ticket layout (shared with app/src/game/engine/ticket.ts — keep both in sync):
--   cells smallint[27], row-major 3 rows × 9 columns, 0 = blank. 5 numbers per row, 1–3 per
--   column, column c holds 1–9 (c=0), c*10..c*10+9, 80–90 (c=8), ascending top→bottom.
--   Column groups: left = columns 0–2, center = 3–5, right = 6–8.

create type public.room_kind as enum ('normal', 'series');
create type public.room_visibility as enum ('public', 'private');
create type public.room_status as enum ('open', 'ended');
create type public.game_status as enum ('lobby', 'running', 'finished', 'cancelled');
create type public.prize_type as enum (
  'fast_3', 'fast_5', 'fast_7',
  'line_1', 'line_2', 'line_3',
  'col_left', 'col_center', 'col_right',
  'full_house'
);
create type public.prize_status as enum ('open', 'won', 'settled', 'unclaimed');

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  host_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(title) between 1 and 40),
  kind public.room_kind not null,
  visibility public.room_visibility not null,
  status public.room_status not null default 'open',
  max_players int not null check (max_players between 2 and 100),
  ticket_price numeric(10, 2) not null check (ticket_price between 0 and 100000),
  call_interval_seconds smallint not null default 6 check (call_interval_seconds between 3 and 20),
  -- { "<prize_type>": template amount ₹ } — which prizes are on, and their proportions.
  prizes jsonb not null,
  series_length smallint not null default 1 check (series_length between 1 and 50),
  total_games smallint not null default 1 check (total_games between 1 and 500),
  games_played smallint not null default 0,
  current_game_id uuid,
  member_count int not null default 0,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index rooms_public_idx on public.rooms (created_at desc) where visibility = 'public' and status = 'open';
create index rooms_host_idx on public.rooms (host_id, created_at desc);

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index room_members_user_idx on public.room_members (user_id, joined_at desc);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  game_no smallint not null,
  status public.game_status not null default 'lobby',
  ticket_price numeric(10, 2) not null,
  pot numeric(12, 2) not null default 0,
  prizes_custom boolean not null default false,
  ticket_count int not null default 0,
  player_count int not null default 0,
  called_numbers smallint[] not null default '{}',
  last_called_at timestamptz,
  next_call_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (room_id, game_no)
);
create index games_running_idx on public.games (next_call_at) where status = 'running';
create index games_room_idx on public.games (room_id, game_no desc);

alter table public.rooms
  add constraint rooms_current_game_fk foreign key (current_game_id) references public.games (id) on delete set null;

-- Never readable by clients: knowing the order would reveal every future number.
create table public.game_secrets (
  game_id uuid primary key references public.games (id) on delete cascade,
  draw_order smallint[] not null check (array_length(draw_order, 1) = 90)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  serial int not null,
  cells smallint[] not null check (array_length(cells, 1) = 27),
  created_at timestamptz not null default now(),
  unique (game_id, serial)
);
create index tickets_game_user_idx on public.tickets (game_id, user_id);

create table public.game_prizes (
  game_id uuid not null references public.games (id) on delete cascade,
  prize public.prize_type not null,
  weight numeric(12, 2) not null default 0,
  amount numeric(12, 2) not null default 0,
  status public.prize_status not null default 'open',
  -- Call index on which the first winner's ticket completed the prize.
  won_at_call smallint,
  -- How many numbers were out when the first claim arrived: sharing closes after that call.
  claim_window_call smallint,
  primary key (game_id, prize)
);

create table public.prize_winners (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  prize public.prize_type not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  call_index smallint not null,
  numbers smallint[] not null,
  amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (game_id, prize, user_id)
);
create index prize_winners_room_idx on public.prize_winners (room_id, user_id);

create table public.claim_attempts (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  prize public.prize_type not null,
  result text not null,
  created_at timestamptz not null default now()
);
create index claim_attempts_recent_idx on public.claim_attempts (game_id, user_id, created_at desc);

-- ─── Pure helpers ─────────────────────────────────────────────────────────────

-- Cryptographically random order (gen_random_uuid is backed by a CSPRNG; random() is not).
create or replace function public._shuffled_range(p_lo int, p_hi int, p_take int)
returns smallint[]
language sql volatile set search_path = ''
as $$
  select coalesce(array_agg(x::smallint), '{}')
    from (select x from generate_series(p_lo, p_hi) x order by gen_random_uuid() limit p_take) s;
$$;

create or replace function public._generate_ticket()
returns smallint[]
language plpgsql volatile set search_path = ''
as $$
declare
  v_grid smallint[];
  v_col_count int[];
  v_cols smallint[];
  v_nums smallint[];
  v_col smallint;
  v_r int; v_c int; v_k int; v_lo int; v_hi int;
begin
  -- 1. Pick 5 of 9 columns per row until every column is used at least once (~2 tries).
  loop
    v_grid := array_fill(0::smallint, array[27]);
    v_col_count := array_fill(0, array[9]);
    for v_r in 0..2 loop
      v_cols := public._shuffled_range(0, 8, 5);
      foreach v_col in array v_cols loop
        v_grid[v_r * 9 + v_col + 1] := -1;
        v_col_count[v_col + 1] := v_col_count[v_col + 1] + 1;
      end loop;
    end loop;
    exit when not (0 = any (v_col_count));
  end loop;

  -- 2. Fill each column with distinct numbers from its range, ascending top→bottom.
  for v_c in 0..8 loop
    v_lo := case when v_c = 0 then 1 else v_c * 10 end;
    v_hi := case when v_c = 8 then 90 else v_c * 10 + 9 end;
    select array_agg(x order by x) into v_nums
      from unnest(public._shuffled_range(v_lo, v_hi, v_col_count[v_c + 1])) x;
    v_k := 1;
    for v_r in 0..2 loop
      if v_grid[v_r * 9 + v_c + 1] = -1 then
        v_grid[v_r * 9 + v_c + 1] := v_nums[v_k];
        v_k := v_k + 1;
      end if;
    end loop;
  end loop;
  return v_grid;
end;
$$;

create or replace function public._fast_count(p_prize public.prize_type)
returns int
language sql immutable set search_path = ''
as $$
  select case p_prize when 'fast_3' then 3 when 'fast_5' then 5 when 'fast_7' then 7 end;
$$;

-- Numbers a prize needs on this ticket, ascending (fast_N / full_house: all 15).
create or replace function public._prize_numbers(p_cells smallint[], p_prize public.prize_type)
returns smallint[]
language sql immutable set search_path = ''
as $$
  select coalesce(array_agg(n order by n), '{}')
    from (
      select n, (i - 1) / 9 as r, (i - 1) % 9 as c
        from unnest(p_cells) with ordinality as t(n, i)
       where n > 0
    ) cells
   where case p_prize
     when 'line_1' then r = 0
     when 'line_2' then r = 1
     when 'line_3' then r = 2
     when 'col_left' then c between 0 and 2
     when 'col_center' then c between 3 and 5
     when 'col_right' then c between 6 and 8
     else true
   end;
$$;

-- 1-based call index at which the prize was completed, or null if not complete.
-- Fast N = the Nth of the ticket's numbers to be called.
create or replace function public._prize_completed_at(
  p_cells smallint[], p_called smallint[], p_prize public.prize_type
)
returns int
language sql immutable set search_path = ''
as $$
  with positions as (
    select array_position(p_called, n) as pos
      from unnest(public._prize_numbers(p_cells, p_prize)) n
  )
  select case
    when public._fast_count(p_prize) is not null then
      (select pos from positions where pos is not null order by pos offset public._fast_count(p_prize) - 1 limit 1)
    when exists (select 1 from positions where pos is null) then null
    else (select max(pos) from positions)
  end;
$$;

-- The numbers that made the win, in call order (shown in the winner announcement).
create or replace function public._winning_numbers(
  p_cells smallint[], p_called smallint[], p_prize public.prize_type
)
returns smallint[]
language sql immutable set search_path = ''
as $$
  select coalesce(array_agg(n order by array_position(p_called, n)), '{}')
    from (
      select n from unnest(public._prize_numbers(p_cells, p_prize)) n
       where array_position(p_called, n) is not null
       order by array_position(p_called, n)
       limit coalesce(public._fast_count(p_prize), 15)
    ) s;
$$;

create or replace function public._random_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I confusion
  v_bytes bytea := extensions.gen_random_bytes(6);
  v_code text := '';
  i int;
begin
  for i in 0..5 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

-- { prize: amount } → validated. Full Housie is mandatory.
create or replace function public._validate_prizes(p_prizes jsonb)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  v_key text;
  v_val text;
  v_amount numeric;
begin
  if p_prizes is null or jsonb_typeof(p_prizes) <> 'object' or not (p_prizes ? 'full_house') then
    raise exception 'INVALID_PRIZES' using errcode = 'P0001';
  end if;
  for v_key, v_val in select key, value from jsonb_each_text(p_prizes) loop
    if v_key not in ('fast_3', 'fast_5', 'fast_7', 'line_1', 'line_2', 'line_3',
                     'col_left', 'col_center', 'col_right', 'full_house') then
      raise exception 'INVALID_PRIZES' using errcode = 'P0001';
    end if;
    begin
      v_amount := v_val::numeric;
    exception when others then
      raise exception 'INVALID_PRIZES' using errcode = 'P0001';
    end;
    if v_amount < 0 or v_amount > 10000000 then
      raise exception 'INVALID_PRIZES' using errcode = 'P0001';
    end if;
  end loop;
  return p_prizes;
end;
$$;

create or replace function public._prize_order(p_prize public.prize_type)
returns int
language sql stable set search_path = ''
as $$ select array_position(enum_range(null::public.prize_type), p_prize); $$;

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Every change is broadcast on the private topic "room:<id>" (see 20261117000003_realtime.sql).
create or replace function public._broadcast(p_room uuid, p_event text, p_payload jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform realtime.send(p_payload, p_event, 'room:' || p_room::text, true);
exception when others then
  -- A broadcast failure must never roll back game progress; clients also resync.
  raise warning 'broadcast failed for room %: %', p_room, sqlerrm;
end;
$$;

-- ─── Internal lifecycle ───────────────────────────────────────────────────────

-- Splits the pot over the prizes in proportion to their weights (template amounts).
-- Rounds down to paise; the remainder goes to Full Housie so the total is exactly the pot.
create or replace function public._auto_split(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_pot numeric;
  v_total_weight numeric;
  v_count int;
  v_assigned numeric;
begin
  select pot into v_pot from public.games where id = p_game;
  select coalesce(sum(weight), 0), count(*) into v_total_weight, v_count
    from public.game_prizes where game_id = p_game;
  if v_count = 0 then
    return;
  end if;
  if v_total_weight > 0 then
    update public.game_prizes
       set amount = floor(v_pot * weight / v_total_weight * 100) / 100
     where game_id = p_game;
  else
    update public.game_prizes set amount = floor(v_pot / v_count * 100) / 100 where game_id = p_game;
  end if;
  select sum(amount) into v_assigned from public.game_prizes where game_id = p_game;
  update public.game_prizes set amount = amount + (v_pot - v_assigned)
   where game_id = p_game and prize = 'full_house';
  update public.games set prizes_custom = false where id = p_game;
end;
$$;

-- Opens the next game's lobby in a room and points the room at it.
create or replace function public._new_game(p_room uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  r public.rooms;
  v_game uuid;
  v_no smallint;
begin
  select * into r from public.rooms where id = p_room for update;
  select coalesce(max(game_no), 0) + 1 into v_no from public.games where room_id = p_room;
  insert into public.games (room_id, game_no, ticket_price)
  values (p_room, v_no, r.ticket_price)
  returning id into v_game;
  insert into public.game_prizes (game_id, prize, weight)
  select v_game, key::public.prize_type, value::numeric from jsonb_each_text(r.prizes);
  update public.rooms set current_game_id = v_game where id = p_room;
  perform public._broadcast(p_room, 'game', jsonb_build_object('gameId', v_game, 'gameNo', v_no, 'status', 'lobby'));
  return v_game;
end;
$$;

create or replace function public._end_room(p_room uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.games set status = 'cancelled', finished_at = now(), next_call_at = null
   where room_id = p_room and status in ('lobby', 'running');
  update public.rooms set status = 'ended', ended_at = now() where id = p_room and status = 'open';
  perform public._broadcast(p_room, 'room_ended', jsonb_build_object('reason', p_reason));
end;
$$;

-- Fixes the prize amounts for every winner of every 'won' prize (split equally).
create or replace function public._settle_prizes(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p record;
  v_room uuid;
  v_count int;
  v_each numeric;
begin
  select room_id into v_room from public.games where id = p_game;
  for p in select * from public.game_prizes where game_id = p_game and status = 'won' loop
    select count(*) into v_count from public.prize_winners where game_id = p_game and prize = p.prize;
    v_each := case when v_count > 0 then floor(p.amount / v_count * 100) / 100 else 0 end;
    update public.prize_winners set amount = v_each where game_id = p_game and prize = p.prize;
    update public.profiles pr
       set prizes_won = prizes_won + 1, amount_won = amount_won + v_each
     where pr.id in (select user_id from public.prize_winners where game_id = p_game and prize = p.prize);
    update public.game_prizes set status = 'settled' where game_id = p_game and prize = p.prize;
    perform public._broadcast(v_room, 'prize_settled', jsonb_build_object(
      'gameId', p_game, 'prize', p.prize, 'each', v_each, 'winners', v_count));
  end loop;
end;
$$;

create or replace function public._finish_game(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.games;
  r public.rooms;
begin
  perform public._settle_prizes(p_game);
  update public.game_prizes set status = 'unclaimed' where game_id = p_game and status = 'open';
  update public.games set status = 'finished', finished_at = now(), next_call_at = null
   where id = p_game returning * into g;
  update public.rooms set games_played = games_played + 1 where id = g.room_id returning * into r;
  perform public._broadcast(g.room_id, 'state', jsonb_build_object(
    'gameId', p_game, 'gameNo', g.game_no, 'status', 'finished'));

  if r.status = 'open' and r.games_played < r.total_games then
    -- Series: the next game's lobby opens right away for everyone in the room.
    perform public._new_game(r.id);
  else
    update public.rooms set status = 'ended', ended_at = now() where id = r.id;
    perform public._broadcast(r.id, 'room_ended', jsonb_build_object('reason', 'completed'));
  end if;
end;
$$;

-- One clock tick for one game. Safe to call concurrently and too early (it just returns).
create or replace function public._advance_game(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.games;
  v_next smallint;
  v_called smallint[];
  v_interval int;
begin
  select * into g from public.games
   where id = p_game and status = 'running' and next_call_at <= now()
   for update skip locked;
  if not found then
    return;
  end if;

  -- Prizes won on the previous number are final once the next tick arrives.
  perform public._settle_prizes(p_game);

  if not exists (select 1 from public.game_prizes where game_id = p_game and prize = 'full_house' and status = 'open')
     or coalesce(array_length(g.called_numbers, 1), 0) >= 90 then
    perform public._finish_game(p_game);
    return;
  end if;

  select draw_order[coalesce(array_length(g.called_numbers, 1), 0) + 1] into v_next
    from public.game_secrets where game_id = p_game;
  v_called := g.called_numbers || v_next;
  select call_interval_seconds into v_interval from public.rooms where id = g.room_id;

  update public.games
     set called_numbers = v_called,
         last_called_at = now(),
         next_call_at = now() + make_interval(secs => v_interval)
   where id = p_game;

  perform public._broadcast(g.room_id, 'call', jsonb_build_object(
    'gameId', p_game,
    'n', v_next,
    'index', array_length(v_called, 1),
    'nextCallAt', now() + make_interval(secs => v_interval)));
end;
$$;

-- Called every second by pg_cron (20261117000004_cron.sql).
create or replace function public.advance_due_games()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in select id from public.games where status = 'running' and next_call_at <= now() loop
    begin
      perform public._advance_game(v_id);
    exception when others then
      raise warning 'advance failed for game %: %', v_id, sqlerrm;
    end;
  end loop;
end;
$$;

-- Hourly housekeeping.
create or replace function public.cleanup_stale_rooms()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- A lobby nobody started within 3 hours.
  for v_id in
    select r.id from public.rooms r join public.games g on g.id = r.current_game_id
     where r.status = 'open' and g.status = 'lobby' and g.created_at < now() - interval '3 hours'
  loop
    perform public._end_room(v_id, 'expired');
  end loop;
  -- A running game whose clock stopped for 10 minutes (should never happen).
  for v_id in
    select room_id from public.games where status = 'running' and next_call_at < now() - interval '10 minutes'
  loop
    perform public._end_room(v_id, 'stalled');
  end loop;
end;
$$;

-- ─── Player RPCs: rooms ───────────────────────────────────────────────────────

create or replace function public._join_room(p_room uuid, p_uid uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.room_members where room_id = p_room and user_id = p_uid) then
    return;
  end if;
  if r.status <> 'open' then
    raise exception 'ROOM_ENDED' using errcode = 'P0001';
  end if;
  if r.member_count >= r.max_players then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;
  insert into public.room_members (room_id, user_id) values (p_room, p_uid);
  update public.rooms set member_count = member_count + 1 where id = p_room;
  perform public._broadcast(p_room, 'members', jsonb_build_object(
    'memberCount', r.member_count + 1,
    'joined', (select display_name from public.profiles where id = p_uid)));
end;
$$;

create or replace function public.create_room(
  p_title text,
  p_kind public.room_kind,
  p_visibility public.room_visibility,
  p_max_players int,
  p_ticket_price numeric,
  p_call_interval_seconds int,
  p_series_length int,
  p_prizes jsonb
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  v_prizes jsonb := public._validate_prizes(p_prizes);
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_len int := case when p_kind = 'series' then p_series_length else 1 end;
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
  if v_len is null or v_len not between 1 and 50 or (p_kind = 'series' and v_len < 2) then
    raise exception 'INVALID_SERIES_LENGTH' using errcode = 'P0001';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := public._random_code();
    begin
      insert into public.rooms (
        code, host_id, title, kind, visibility, max_players, ticket_price,
        call_interval_seconds, prizes, series_length, total_games
      ) values (
        v_code, v_uid, coalesce(left(v_title, 40), 'Housie Room'), p_kind, p_visibility, p_max_players,
        round(p_ticket_price, 2), least(greatest(coalesce(p_call_interval_seconds, 6), 3), 20),
        v_prizes, v_len, v_len
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

create or replace function public.join_room_by_code(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  v_room uuid;
begin
  select id into v_room from public.rooms where code = upper(btrim(p_code));
  if v_room is null then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public._join_room(v_room, v_uid);
  return v_room;
end;
$$;

create or replace function public.join_public_room(p_room uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if not exists (select 1 from public.rooms where id = p_room and visibility = 'public') then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public._join_room(p_room, v_uid);
  return p_room;
end;
$$;

-- Leaving drops my tickets in a lobby. A leaving host hands the room to the next member.
create or replace function public.leave_room(p_room uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  r public.rooms;
  v_next_host uuid;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found or not exists (select 1 from public.room_members where room_id = p_room and user_id = v_uid) then
    return;
  end if;
  if r.status = 'open' then
    delete from public.tickets t using public.games g
     where t.game_id = g.id and g.id = r.current_game_id and g.status = 'lobby' and t.user_id = v_uid;
    perform public._recount_game(r.current_game_id);
  end if;
  delete from public.room_members where room_id = p_room and user_id = v_uid;
  update public.rooms set member_count = member_count - 1 where id = p_room;

  if r.host_id = v_uid then
    select user_id into v_next_host from public.room_members where room_id = p_room order by joined_at limit 1;
    if v_next_host is null then
      perform public._end_room(p_room, 'empty');
      return;
    end if;
    update public.rooms set host_id = v_next_host where id = p_room;
  end if;
  perform public._broadcast(p_room, 'members', jsonb_build_object('memberCount', r.member_count - 1));
end;
$$;

create or replace function public.end_room(p_room uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if not exists (select 1 from public.rooms where id = p_room and host_id = v_uid and status = 'open') then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  perform public._end_room(p_room, 'host');
end;
$$;

-- After a room ended (normal game done / series complete): another game (or series) in the
-- same room with the same people and settings.
create or replace function public.play_again(p_room uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found or r.host_id is distinct from v_uid then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if r.status = 'open' then
    raise exception 'ROOM_STILL_PLAYING' using errcode = 'P0001';
  end if;
  update public.rooms
     set status = 'open', ended_at = null, total_games = least(games_played + series_length, 500)
   where id = p_room;
  return public._new_game(p_room);
end;
$$;

-- ─── Player RPCs: a game ──────────────────────────────────────────────────────

-- Recomputes ticket/player counts and the pot; re-splits prizes unless the host's custom
-- amounts still add up to the new pot.
create or replace function public._recount_game(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.games;
  v_sum numeric;
begin
  if p_game is null then
    return;
  end if;
  update public.games ga
     set ticket_count = s.n, player_count = s.p, pot = s.n * ga.ticket_price
    from (select count(*) as n, count(distinct user_id) as p from public.tickets where game_id = p_game) s
   where ga.id = p_game
  returning ga.* into g;
  select coalesce(sum(amount), 0) into v_sum from public.game_prizes where game_id = p_game;
  if not g.prizes_custom or v_sum <> g.pot then
    perform public._auto_split(p_game);
  end if;
  perform public._broadcast(g.room_id, 'lobby', jsonb_build_object(
    'gameId', p_game, 'ticketCount', g.ticket_count, 'playerCount', g.player_count, 'pot', g.pot));
end;
$$;

-- "How many tickets this game?" — 0 to 4, changeable until the game starts. Free: the
-- ticket price only feeds the casual pot.
create or replace function public.set_my_tickets(p_game uuid, p_count int)
returns setof public.tickets
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.games;
  v_have int;
  v_max_serial int;
  i int;
begin
  if p_count is null or p_count not between 0 and 4 then
    raise exception 'INVALID_TICKET_COUNT' using errcode = 'P0001';
  end if;
  select * into g from public.games where id = p_game for update;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.room_members where room_id = g.room_id and user_id = v_uid) then
    raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  if g.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001';
  end if;

  select count(*) into v_have from public.tickets where game_id = p_game and user_id = v_uid;
  if p_count > v_have then
    select coalesce(max(serial), 0) into v_max_serial from public.tickets where game_id = p_game;
    for i in 1..(p_count - v_have) loop
      insert into public.tickets (game_id, user_id, serial, cells)
      values (p_game, v_uid, v_max_serial + i, public._generate_ticket());
    end loop;
  elsif p_count < v_have then
    delete from public.tickets where id in (
      select id from public.tickets where game_id = p_game and user_id = v_uid
       order by serial desc limit v_have - p_count);
  end if;
  perform public._recount_game(p_game);
  return query select * from public.tickets where game_id = p_game and user_id = v_uid order by serial;
end;
$$;

-- Host's own prize amounts for this game. They must add up to the pot exactly.
create or replace function public.set_game_prizes(p_game uuid, p_amounts jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.games;
  v_sum numeric := 0;
  v_key text;
  v_val text;
  v_amount numeric;
begin
  select * into g from public.games where id = p_game for update;
  if not found or not exists (select 1 from public.rooms where id = g.room_id and host_id = v_uid) then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if g.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001';
  end if;
  if p_amounts is null or jsonb_typeof(p_amounts) <> 'object' then
    raise exception 'INVALID_PRIZES' using errcode = 'P0001';
  end if;
  for v_key, v_val in select key, value from jsonb_each_text(p_amounts) loop
    if not exists (select 1 from public.game_prizes where game_id = p_game and prize::text = v_key) then
      raise exception 'INVALID_PRIZES' using errcode = 'P0001';
    end if;
    v_amount := round(v_val::numeric, 2);
    if v_amount < 0 then
      raise exception 'INVALID_PRIZES' using errcode = 'P0001';
    end if;
    v_sum := v_sum + v_amount;
  end loop;
  if (select count(*) from public.game_prizes where game_id = p_game)
     <> (select count(*) from jsonb_object_keys(p_amounts)) then
    raise exception 'INVALID_PRIZES' using errcode = 'P0001';
  end if;
  if v_sum <> g.pot then
    raise exception 'PRIZES_MUST_EQUAL_POT' using errcode = 'P0001';
  end if;
  update public.game_prizes gp set amount = round((p_amounts ->> gp.prize::text)::numeric, 2)
   where gp.game_id = p_game;
  update public.games set prizes_custom = true where id = p_game;
  perform public._broadcast(g.room_id, 'lobby', jsonb_build_object(
    'gameId', p_game, 'ticketCount', g.ticket_count, 'playerCount', g.player_count, 'pot', g.pot));
end;
$$;

create or replace function public.start_game(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.games;
  v_sum numeric;
begin
  select * into g from public.games where id = p_game for update;
  if not found or not exists (select 1 from public.rooms where id = g.room_id and host_id = v_uid and status = 'open') then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if g.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001';
  end if;
  -- The host plus at least one more player must have tickets.
  if g.player_count < 2 then
    raise exception 'NEED_TWO_PLAYERS' using errcode = 'P0001';
  end if;
  select coalesce(sum(amount), 0) into v_sum from public.game_prizes where game_id = p_game;
  if v_sum <> g.pot then
    perform public._auto_split(p_game);
  end if;

  insert into public.game_secrets (game_id, draw_order) values (p_game, public._shuffled_range(1, 90, 90));
  update public.games
     set status = 'running',
         started_at = now(),
         -- A short countdown so every phone is on the game screen before number 1.
         next_call_at = now() + interval '5 seconds'
   where id = p_game;
  update public.profiles p set games_played = games_played + 1
   where p.id in (select distinct user_id from public.tickets where game_id = p_game);

  perform public._broadcast(g.room_id, 'state', jsonb_build_object(
    'gameId', p_game, 'gameNo', g.game_no, 'status', 'running', 'nextCallAt', now() + interval '5 seconds'));
end;
$$;

-- The app calls this the moment the player's strikes complete a prize.
create or replace function public.claim_prize(p_ticket uuid, p_prize public.prize_type)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  t public.tickets;
  g public.games;
  gp public.game_prizes;
  v_called_count int;
  v_done_at int;
  v_result text;
  v_winners jsonb;
begin
  select * into t from public.tickets where id = p_ticket and user_id = v_uid;
  if not found then
    raise exception 'TICKET_NOT_FOUND' using errcode = 'P0001';
  end if;
  -- Lock the game row: serializes claims against each other and against the clock tick.
  select * into g from public.games where id = t.game_id for update;
  if g.status <> 'running' then
    raise exception 'GAME_NOT_RUNNING' using errcode = 'P0001';
  end if;
  if (select count(*) from public.claim_attempts
       where game_id = g.id and user_id = v_uid and created_at > now() - interval '10 seconds') >= 12 then
    raise exception 'TOO_MANY_CLAIMS' using errcode = 'P0001';
  end if;
  select * into gp from public.game_prizes where game_id = g.id and prize = p_prize;
  if not found then
    raise exception 'PRIZE_NOT_IN_GAME' using errcode = 'P0001';
  end if;

  v_called_count := coalesce(array_length(g.called_numbers, 1), 0);
  v_done_at := public._prize_completed_at(t.cells, g.called_numbers, p_prize);

  if v_done_at is null then
    v_result := 'not_complete';
  elsif exists (select 1 from public.prize_winners where game_id = g.id and prize = p_prize and user_id = v_uid) then
    v_result := 'already_yours';
  elsif gp.status = 'open' then
    v_result := 'won';
  elsif gp.status = 'won' and v_done_at = gp.won_at_call and v_called_count = gp.claim_window_call then
    -- Completed on the same number as the first winner, and no new number since: split.
    v_result := 'shared';
  else
    v_result := 'already_claimed';
  end if;

  insert into public.claim_attempts (game_id, user_id, prize, result) values (g.id, v_uid, p_prize, v_result);

  if v_result in ('won', 'shared') then
    insert into public.prize_winners (game_id, room_id, prize, user_id, ticket_id, call_index, numbers)
    values (g.id, g.room_id, p_prize, v_uid, t.id, v_done_at,
            public._winning_numbers(t.cells, g.called_numbers, p_prize));
    if v_result = 'won' then
      update public.game_prizes set status = 'won', won_at_call = v_done_at, claim_window_call = v_called_count
       where game_id = g.id and prize = p_prize;
    end if;
    select jsonb_agg(jsonb_build_object(
             'userId', w.user_id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
             'ticketSerial', tk.serial, 'numbers', w.numbers) order by w.id)
      into v_winners
      from public.prize_winners w
      join public.profiles pr on pr.id = w.user_id
      join public.tickets tk on tk.id = w.ticket_id
     where w.game_id = g.id and w.prize = p_prize;
    perform public._broadcast(g.room_id, 'prize', jsonb_build_object(
      'gameId', g.id, 'prize', p_prize, 'amount', gp.amount, 'callIndex', v_done_at, 'winners', v_winners));
  end if;

  return jsonb_build_object('result', v_result);
end;
$$;

-- Backup clock: clients call this when a number is overdue (e.g. a delayed cron run).
create or replace function public.nudge_game(p_game uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._require_player();
  perform public._advance_game(p_game);
end;
$$;

-- ─── Reads ────────────────────────────────────────────────────────────────────

create or replace function public._prizes_json(p_game uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'prize', gp.prize, 'weight', gp.weight, 'amount', gp.amount, 'status', gp.status, 'wonAtCall', gp.won_at_call,
      'winners', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'userId', w.user_id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
                 'amount', w.amount, 'numbers', w.numbers, 'ticketSerial', tk.serial) order by w.id)
          from public.prize_winners w
          join public.profiles pr on pr.id = w.user_id
          join public.tickets tk on tk.id = w.ticket_id
         where w.game_id = p_game and w.prize = gp.prize), '[]'::jsonb))
      order by public._prize_order(gp.prize)), '[]'::jsonb)
    from public.game_prizes gp where gp.game_id = p_game;
$$;

-- Everything a phone needs to (re)draw the room screen in one round trip.
create or replace function public.get_room_state(p_room uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  r public.rooms;
  g public.games;
  v_prev uuid;
begin
  select * into r from public.rooms where id = p_room;
  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = v_uid) and not public.is_admin() then
    raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  select * into g from public.games where id = r.current_game_id;
  select id into v_prev from public.games
   where room_id = p_room and status = 'finished' and game_no < coalesce(g.game_no, 32767)
   order by game_no desc limit 1;

  return jsonb_build_object(
    'serverTime', now(),
    'room', jsonb_build_object(
      'id', r.id, 'code', r.code, 'title', r.title, 'kind', r.kind, 'visibility', r.visibility,
      'status', r.status, 'hostId', r.host_id, 'maxPlayers', r.max_players, 'ticketPrice', r.ticket_price,
      'callIntervalSeconds', r.call_interval_seconds, 'prizes', r.prizes, 'seriesLength', r.series_length,
      'totalGames', r.total_games, 'gamesPlayed', r.games_played, 'memberCount', r.member_count),
    'game', case when g.id is null then null else jsonb_build_object(
      'id', g.id, 'gameNo', g.game_no, 'status', g.status, 'ticketPrice', g.ticket_price, 'pot', g.pot,
      'prizesCustom', g.prizes_custom, 'ticketCount', g.ticket_count, 'playerCount', g.player_count,
      'calledNumbers', g.called_numbers, 'lastCalledAt', g.last_called_at, 'nextCallAt', g.next_call_at,
      'startedAt', g.started_at, 'finishedAt', g.finished_at) end,
    'prizes', case when g.id is null then '[]'::jsonb else public._prizes_json(g.id) end,
    'previousGameId', v_prev,
    'myTickets', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'serial', t.serial, 'cells', t.cells) order by t.serial)
        from public.tickets t where t.game_id = g.id and t.user_id = v_uid), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'userId', pr.id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
               'tickets', (select count(*) from public.tickets t where t.game_id = g.id and t.user_id = pr.id))
               order by m.joined_at)
        from public.room_members m join public.profiles pr on pr.id = m.user_id
       where m.room_id = p_room), '[]'::jsonb)
  );
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
  if not exists (select 1 from public.room_members where room_id = g.room_id and user_id = v_uid) and not public.is_admin() then
    raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'gameId', g.id, 'gameNo', g.game_no, 'status', g.status, 'pot', g.pot,
    'calledCount', coalesce(array_length(g.called_numbers, 1), 0),
    'finishedAt', g.finished_at, 'prizes', public._prizes_json(g.id));
end;
$$;

-- Series scoreboard: everyone who played in this room, with every win listed.
create or replace function public.get_room_standings(p_room uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = v_uid) and not public.is_admin() then
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
    select coalesce(jsonb_agg(row_data order by (row_data ->> 'won')::numeric desc,
                                              (row_data ->> 'net')::numeric desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'userId', pe.user_id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
          'games', coalesce(pl.games, 0), 'tickets', coalesce(pl.tickets, 0),
          'spent', coalesce(pl.spent, 0), 'wins', coalesce(wo.wins, 0), 'won', coalesce(wo.won, 0),
          'net', coalesce(wo.won, 0) - coalesce(pl.spent, 0),
          'list', coalesce(wo.list, '[]'::jsonb)) as row_data
          from people pe
          join public.profiles pr on pr.id = pe.user_id
          left join played pl on pl.user_id = pe.user_id
          left join won wo on wo.user_id = pe.user_id
      ) s
  );
end;
$$;

create or replace function public.list_public_rooms()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'code', r.code, 'title', r.title, 'kind', r.kind, 'ticketPrice', r.ticket_price,
      'maxPlayers', r.max_players, 'memberCount', r.member_count, 'seriesLength', r.series_length,
      'gamesPlayed', r.games_played, 'hostName', pr.display_name, 'hostAvatar', pr.avatar_key,
      'gameStatus', g.status, 'gameNo', g.game_no,
      'isMember', exists (select 1 from public.room_members m where m.room_id = r.id and m.user_id = auth.uid()))
      order by r.created_at desc), '[]'::jsonb)
    from public.rooms r
    left join public.profiles pr on pr.id = r.host_id
    left join public.games g on g.id = r.current_game_id
   where r.visibility = 'public' and r.status = 'open'
     and r.member_count < r.max_players
     and r.created_at > now() - interval '1 day';
$$;

create or replace function public.get_my_rooms(p_limit int default 30)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by (x ->> 'joinedAt') desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', r.id, 'code', r.code, 'title', r.title, 'kind', r.kind, 'status', r.status,
      'isHost', r.host_id = auth.uid(), 'gamesPlayed', r.games_played, 'totalGames', r.total_games,
      'memberCount', r.member_count, 'joinedAt', m.joined_at,
      'gameStatus', (select status from public.games where id = r.current_game_id),
      'myWon', coalesce((select sum(amount) from public.prize_winners w
                          where w.room_id = r.id and w.user_id = auth.uid()), 0)
    ) as x
    from public.room_members m join public.rooms r on r.id = m.room_id
    where m.user_id = auth.uid()
    order by m.joined_at desc
    limit least(greatest(p_limit, 1), 50)
  ) s;
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.games enable row level security;
alter table public.game_secrets enable row level security;
alter table public.tickets enable row level security;
alter table public.game_prizes enable row level security;
alter table public.prize_winners enable row level security;
alter table public.claim_attempts enable row level security;

create or replace function public.is_room_member(p_room uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.room_members where room_id = p_room and user_id = auth.uid());
$$;

create policy "rooms visible" on public.rooms for select to authenticated
  using (visibility = 'public' or public.is_room_member(id) or public.is_admin());
create policy "members see members" on public.room_members for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());
create policy "members see games" on public.games for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());
-- game_secrets: RLS on, no policy → unreadable to every client role.
create policy "own tickets" on public.tickets for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "members see prizes" on public.game_prizes for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.games g where g.id = game_id and public.is_room_member(g.room_id)));
create policy "members see winners" on public.prize_winners for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());
create policy "own claims" on public.claim_attempts for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke all on public.rooms, public.room_members, public.games, public.game_secrets, public.tickets,
  public.game_prizes, public.prize_winners, public.claim_attempts from anon;
revoke insert, update, delete, truncate on public.rooms, public.room_members, public.games, public.tickets,
  public.game_prizes, public.prize_winners, public.claim_attempts from authenticated;
revoke all on public.game_secrets from authenticated;

-- ─── Function privileges ──────────────────────────────────────────────────────
do $$
declare
  f record;
begin
  -- Internal helpers and the cron entry points: no client may call them.
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (p.proname like '\_%' or p.proname in ('advance_due_games', 'cleanup_stale_rooms'))
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end;
$$;

revoke execute on function
  public.create_room(text, public.room_kind, public.room_visibility, int, numeric, int, int, jsonb),
  public.join_room_by_code(text),
  public.join_public_room(uuid),
  public.leave_room(uuid),
  public.end_room(uuid),
  public.play_again(uuid),
  public.set_my_tickets(uuid, int),
  public.set_game_prizes(uuid, jsonb),
  public.start_game(uuid),
  public.claim_prize(uuid, public.prize_type),
  public.nudge_game(uuid),
  public.get_room_state(uuid),
  public.get_game_results(uuid),
  public.get_room_standings(uuid),
  public.list_public_rooms(),
  public.get_my_rooms(int),
  public.is_room_member(uuid)
  from public, anon;

grant execute on function
  public.create_room(text, public.room_kind, public.room_visibility, int, numeric, int, int, jsonb),
  public.join_room_by_code(text),
  public.join_public_room(uuid),
  public.leave_room(uuid),
  public.end_room(uuid),
  public.play_again(uuid),
  public.set_my_tickets(uuid, int),
  public.set_game_prizes(uuid, jsonb),
  public.start_game(uuid),
  public.claim_prize(uuid, public.prize_type),
  public.nudge_game(uuid),
  public.get_room_state(uuid),
  public.get_game_results(uuid),
  public.get_room_standings(uuid),
  public.list_public_rooms(),
  public.get_my_rooms(int),
  public.is_room_member(uuid)
  to authenticated;
