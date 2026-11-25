-- Owner's requests of 2026-11-25.
--   * Tickets: the host sets the max tickets per player (1–10, default 3). A player's tickets
--     share as few numbers as possible, and numbers spread evenly over the ticket (no empty
--     columns, few crowded ones): each ticket is the best of 40 generated candidates.
--   * Chat: read receipts (chat_reads), "typing…" (broadcast only), delete for everyone.
--   * Coins (play only — no money): every player has coins (1000 to start). A room's stake is
--     'free' (no price), 'coins' (tickets cost coins, prizes pay coins) or 'amount' (casual ₹
--     numbers for scoring, as before — no money moves). Coins move by triggers on tickets /
--     games / prize_winners, so the game functions themselves are unchanged.

-- ─── Ticket limit + low-overlap, well-spread tickets ─────────────────────────
alter table public.rooms add column if not exists max_tickets int not null default 3 check (max_tickets between 1 and 10);
-- Rooms already open keep their old limit of 4.
update public.rooms set max_tickets = 4 where status = 'open' and max_tickets = 3;

/**
 * Score a ticket against the numbers this player already holds in the game: overlap counts
 * most, then empty columns and columns with all three rows filled (lopsided tickets).
 */
create or replace function public._ticket_score(p_cells smallint[], p_used smallint[])
returns int
language sql immutable set search_path = ''
as $$
  select
    10 * (select count(*) from unnest(p_cells) n where n > 0 and n = any (p_used))
    + 4 * (select count(*) from generate_series(1, 9) c
            where (p_cells[c] > 0)::int + (p_cells[9 + c] > 0)::int + (p_cells[18 + c] > 0)::int = 0)
    + 2 * (select count(*) from generate_series(1, 9) c
            where (p_cells[c] > 0)::int + (p_cells[9 + c] > 0)::int + (p_cells[18 + c] > 0)::int = 3)
$$;

/** Best of 40 valid tickets for a player who already holds p_used in this game. */
create or replace function public._pick_ticket(p_used smallint[])
returns smallint[]
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_best smallint[];
  v_best_score int := 2147483647;
  v_cand smallint[];
  v_score int;
  i int;
begin
  for i in 1..40 loop
    v_cand := public._generate_ticket();
    v_score := public._ticket_score(v_cand, coalesce(p_used, '{}'));
    if v_score < v_best_score then
      v_best := v_cand;
      v_best_score := v_score;
      exit when v_score = 0;
    end if;
  end loop;
  return v_best;
end;
$$;

create or replace function public.set_my_tickets(p_game uuid, p_count int)
returns setof public.tickets
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  g public.games;
  v_max int;
  v_have int;
  v_max_serial int;
  v_used smallint[] := '{}';
  v_cells smallint[];
  i int;
begin
  select * into g from public.games where id = p_game for update;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0001';
  end if;
  select max_tickets into v_max from public.rooms where id = g.room_id;
  if p_count is null or p_count < 1 or p_count > coalesce(v_max, 3) then
    raise exception 'INVALID_TICKET_COUNT' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.room_members where room_id = g.room_id and user_id = v_uid) then
    raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  if g.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001';
  end if;
  if g.phase <> 'tickets' then
    raise exception 'TICKETS_NOT_OPEN' using errcode = 'P0001';
  end if;
  select count(*) into v_have from public.tickets where game_id = p_game and user_id = v_uid;
  if v_have > 0 then
    raise exception 'TICKETS_ALREADY_CHOSEN' using errcode = 'P0001';
  end if;

  select coalesce(max(serial), 0) into v_max_serial from public.tickets where game_id = p_game;
  for i in 1..p_count loop
    v_cells := public._pick_ticket(v_used);
    v_used := v_used || array(select n from unnest(v_cells) n where n > 0);
    insert into public.tickets (game_id, user_id, serial, cells)
    values (p_game, v_uid, v_max_serial + i, v_cells);
  end loop;
  perform public._recount_game(p_game);
  return query select * from public.tickets where game_id = p_game and user_id = v_uid order by serial;
end;
$$;

create or replace function public.set_max_tickets(p_room uuid, p_max int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found or r.host_id is distinct from v_uid or r.status <> 'open' then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if p_max is null or p_max not between 1 and 10 then
    raise exception 'INVALID_TICKET_COUNT' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.games where id = r.current_game_id and status <> 'lobby') then
    raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001';
  end if;
  if r.max_tickets = p_max then
    return;
  end if;
  update public.rooms set max_tickets = p_max where id = p_room;
  perform public._broadcast(p_room, 'room_settings', jsonb_build_object('roomId', p_room));
end;
$$;

-- ─── Chat: read receipts, typing, delete for everyone ────────────────────────
alter table public.chat_messages add column if not exists deleted_at timestamptz;

create table if not exists public.chat_reads (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_id bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
alter table public.chat_reads enable row level security;
revoke all on public.chat_reads from anon, authenticated;
create index if not exists chat_reads_user_idx on public.chat_reads (user_id);

create or replace function public.mark_chat_read(p_room uuid, p_last_id bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  v_now bigint;
begin
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = v_uid) then
    return;
  end if;
  insert into public.chat_reads (room_id, user_id, last_read_id) values (p_room, v_uid, coalesce(p_last_id, 0))
  on conflict (room_id, user_id) do update
    set last_read_id = greatest(public.chat_reads.last_read_id, excluded.last_read_id), updated_at = now()
  returning last_read_id into v_now;
  perform public._broadcast(p_room, 'chat_read', jsonb_build_object('userId', v_uid, 'lastReadId', v_now));
end;
$$;

create or replace function public.get_chat_reads(p_room uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = v_uid) and not public.is_admin() then
    raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('userId', user_id, 'lastReadId', last_read_id, 'at', updated_at))
                     from public.chat_reads where room_id = p_room), '[]'::jsonb);
end;
$$;

/** "X is typing…" — sent only over the room's live channel, nothing stored. */
create or replace function public.chat_typing(p_room uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  pr public.profiles;
begin
  if not exists (select 1 from public.room_members m join public.rooms r on r.id = m.room_id
                  where m.room_id = p_room and m.user_id = v_uid and r.chat_enabled and r.status = 'open') then
    return;
  end if;
  select * into pr from public.profiles where id = v_uid;
  perform public._broadcast(p_room, 'typing', jsonb_build_object('userId', v_uid, 'name', pr.display_name, 'avatarKey', pr.avatar_key));
end;
$$;

/** Delete my message for everyone (it shows as "This message was deleted"). */
create or replace function public.delete_chat_message(p_id bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  m public.chat_messages;
begin
  select * into m from public.chat_messages where id = p_id;
  if not found or m.user_id <> v_uid or m.kind <> 'user' then
    raise exception 'NOT_YOUR_MESSAGE' using errcode = 'P0001';
  end if;
  update public.chat_messages set deleted_at = now() where id = p_id and deleted_at is null;
  perform public._broadcast(m.room_id, 'chat_deleted', jsonb_build_object('id', p_id));
end;
$$;

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
                                        'avatarKey', pr.avatar_key,
                                        'body', case when c.deleted_at is null then c.body end,
                                        'deleted', c.deleted_at is not null,
                                        'kind', c.kind, 'at', c.created_at) as msg
          from public.chat_messages c join public.profiles pr on pr.id = c.user_id
         where c.room_id = p_room and c.created_at >= v_since
         order by c.id desc
         limit 80
      ) x), '[]'::jsonb);
end;
$$;

-- ─── Coins (play only) ────────────────────────────────────────────────────────
alter table public.profiles add column if not exists coins numeric(14, 2) not null default 1000 check (coins >= 0);
alter table public.rooms add column if not exists stake_mode text not null default 'amount'
  check (stake_mode in ('free', 'coins', 'amount'));
alter table public.tickets add column if not exists paid_coins numeric(14, 2) not null default 0;

create table if not exists public.coin_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta numeric(14, 2) not null,
  reason text not null check (reason in ('welcome', 'ticket', 'refund', 'prize', 'admin')),
  room_id uuid references public.rooms (id) on delete set null,
  game_id uuid references public.games (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.coin_ledger enable row level security;
revoke all on public.coin_ledger from anon, authenticated;
create index if not exists coin_ledger_user_idx on public.coin_ledger (user_id, created_at desc);
create index if not exists coin_ledger_room_idx on public.coin_ledger (room_id);
create index if not exists coin_ledger_game_idx on public.coin_ledger (game_id);

-- Buying a ticket in a coins room takes its price first (all tickets or none).
create or replace function public._ticket_pay_coins()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_mode text;
  v_price numeric;
  v_room uuid;
begin
  select r.stake_mode, g.ticket_price, g.room_id into v_mode, v_price, v_room
    from public.games g join public.rooms r on r.id = g.room_id where g.id = new.game_id;
  if v_mode = 'coins' and v_price > 0 then
    update public.profiles set coins = coins - v_price where id = new.user_id and coins >= v_price;
    if not found then
      raise exception 'NOT_ENOUGH_COINS' using errcode = 'P0001';
    end if;
    new.paid_coins := v_price;
    insert into public.coin_ledger (user_id, delta, reason, room_id, game_id) values (new.user_id, -v_price, 'ticket', v_room, new.game_id);
  end if;
  return new;
end;
$$;
drop trigger if exists tickets_pay_coins on public.tickets;
create trigger tickets_pay_coins before insert on public.tickets for each row execute function public._ticket_pay_coins();

-- A ticket removed while its game is still in the lobby (left / removed) gives the coins back.
create or replace function public._ticket_refund_coins()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_status text;
  v_room uuid;
begin
  if old.paid_coins <= 0 then
    return old;
  end if;
  select status, room_id into v_status, v_room from public.games where id = old.game_id;
  if v_status = 'lobby' then
    update public.profiles set coins = coins + old.paid_coins where id = old.user_id;
    if found then
      insert into public.coin_ledger (user_id, delta, reason, room_id, game_id) values (old.user_id, old.paid_coins, 'refund', v_room, old.game_id);
    end if;
  end if;
  return old;
end;
$$;
drop trigger if exists tickets_refund_coins on public.tickets;
create trigger tickets_refund_coins before delete on public.tickets for each row execute function public._ticket_refund_coins();

-- A cancelled game (room dismissed / ended early) gives every ticket's coins back.
create or replace function public._game_cancel_refund()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  t record;
begin
  if new.status = 'cancelled' and old.status in ('lobby', 'running') then
    for t in select user_id, sum(paid_coins) as coins from public.tickets
              where game_id = new.id and paid_coins > 0 group by user_id loop
      update public.profiles set coins = coins + t.coins where id = t.user_id;
      insert into public.coin_ledger (user_id, delta, reason, room_id, game_id, note)
      values (t.user_id, t.coins, 'refund', new.room_id, new.id, 'game cancelled');
    end loop;
    update public.tickets set paid_coins = 0 where game_id = new.id and paid_coins > 0;
  end if;
  return null;
end;
$$;
drop trigger if exists games_cancel_refund on public.games;
create trigger games_cancel_refund after update of status on public.games for each row execute function public._game_cancel_refund();

-- Prizes in a coins room pay out when they're settled (the amount is set).
create or replace function public._prize_pay_coins()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_delta numeric := coalesce(new.amount, 0) - coalesce(old.amount, 0);
begin
  if v_delta <> 0 and exists (select 1 from public.rooms where id = new.room_id and stake_mode = 'coins') then
    update public.profiles set coins = greatest(0, coins + v_delta) where id = new.user_id;
    insert into public.coin_ledger (user_id, delta, reason, room_id, game_id) values (new.user_id, v_delta, 'prize', new.room_id, new.game_id);
  end if;
  return null;
end;
$$;
drop trigger if exists prize_winners_pay_coins on public.prize_winners;
create trigger prize_winners_pay_coins after update of amount on public.prize_winners for each row execute function public._prize_pay_coins();

/** Host, lobby, before anyone has tickets: Free (no price), Coins, or ₹ amount (just for scoring). */
create or replace function public.set_stake_mode(p_room uuid, p_mode text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
  r public.rooms;
  g public.games;
  v_price numeric;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found or r.host_id is distinct from v_uid or r.status <> 'open' then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;
  if p_mode not in ('free', 'coins', 'amount') then
    raise exception 'INVALID_STAKE_MODE' using errcode = 'P0001';
  end if;
  select * into g from public.games where id = r.current_game_id for update;
  if g.id is null or g.status <> 'lobby' then
    raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001';
  end if;
  if r.stake_mode = p_mode then
    return;
  end if;
  if exists (select 1 from public.tickets where game_id = g.id) then
    raise exception 'PRICE_LOCKED' using errcode = 'P0001';
  end if;
  -- Free has no price; coins are whole numbers.
  v_price := case when p_mode = 'free' then 0 when p_mode = 'coins' then round(r.ticket_price) else r.ticket_price end;
  update public.rooms set stake_mode = p_mode, ticket_price = v_price where id = p_room;
  update public.games set ticket_price = v_price where id = g.id;
  perform public._recount_game(g.id);
  perform public._broadcast(p_room, 'room_settings', jsonb_build_object('roomId', p_room));
end;
$$;

create or replace function public.get_my_coin_ledger(p_limit int default 50)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 'delta', l.delta, 'reason', l.reason, 'note', l.note,
                                        'roomTitle', r.title, 'at', l.created_at) order by l.id desc)
      from (select * from public.coin_ledger where user_id = v_uid order by id desc
             limit least(greatest(coalesce(p_limit, 50), 1), 200)) l
      left join public.rooms r on r.id = l.room_id), '[]'::jsonb);
end;
$$;

/** Admin: give or take coins (never below 0); audit-logged. */
create or replace function public.admin_adjust_coins(p_user uuid, p_delta numeric, p_note text default null)
returns numeric
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := public._require_admin();
  v_now numeric;
begin
  if p_delta is null or p_delta = 0 or abs(p_delta) > 1000000 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;
  update public.profiles set coins = coins + p_delta where id = p_user and coins + p_delta >= 0 returning coins into v_now;
  if not found then
    raise exception 'NOT_ENOUGH_COINS' using errcode = 'P0001';
  end if;
  insert into public.coin_ledger (user_id, delta, reason, note) values (p_user, p_delta, 'admin', left(p_note, 200));
  insert into public.audit_log (actor_id, action, target, details)
  values (v_admin, 'coins.adjust', p_user::text, jsonb_build_object('delta', p_delta, 'note', p_note));
  return v_now;
end;
$$;

create or replace function public.get_me()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  select jsonb_build_object(
    'id', p.id,
    'displayName', p.display_name,
    'avatarKey', p.avatar_key,
    'phone', p.phone,
    'isGuest', p.is_guest,
    'language', p.language,
    'role', p.role,
    'isBanned', p.is_banned,
    'bannedReason', p.banned_reason,
    'gamesPlayed', p.games_played,
    'prizesWon', p.prizes_won,
    'amountWon', p.amount_won,
    'coins', p.coins,
    'createdAt', p.created_at
  ) into v
  from public.profiles p
  where p.id = v_uid;
  if v is null then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;
  return v;
end;
$$;

-- Everyone starts with 1000 coins: one "welcome" line in their history.
insert into public.coin_ledger (user_id, delta, reason, note)
select p.id, 1000, 'welcome', 'Welcome coins'
  from public.profiles p
 where not exists (select 1 from public.coin_ledger l where l.user_id = p.id and l.reason = 'welcome');

create or replace function public._welcome_coins()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.coin_ledger (user_id, delta, reason, note) values (new.id, new.coins, 'welcome', 'Welcome coins');
  return null;
end;
$$;
drop trigger if exists profiles_welcome_coins on public.profiles;
create trigger profiles_welcome_coins after insert on public.profiles for each row execute function public._welcome_coins();

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
      'totalGames', r.total_games, 'gamesPlayed', r.games_played, 'memberCount', r.member_count,
      'claimMode', r.claim_mode, 'autoMark', r.auto_mark, 'checkClaims', r.check_claims, 'chatEnabled', r.chat_enabled, 'checkSeconds', r.check_seconds, 'hintMode', r.hint_mode, 'lateClaimCalls', r.late_claim_calls, 'stakeMode', r.stake_mode, 'maxTickets', r.max_tickets),
    'game', case when g.id is null then null else jsonb_build_object(
      'id', g.id, 'gameNo', g.game_no, 'status', g.status, 'phase', g.phase, 'ticketPrice', g.ticket_price, 'pot', g.pot,
      'prizesCustom', g.prizes_custom, 'ticketCount', g.ticket_count, 'playerCount', g.player_count,
      'calledNumbers', g.called_numbers, 'lastCalledAt', g.last_called_at, 'nextCallAt', g.next_call_at,
      'paused', g.paused, 'startedAt', g.started_at, 'finishedAt', g.finished_at,
      'checkOpen', g.check_open, 'checkRound', g.check_round, 'finalCheck', g.final_check) end,
    'readyUserIds', coalesce((select jsonb_agg(gr.user_id) from public.game_ready gr where gr.game_id = g.id), '[]'::jsonb),
    'checkedUserIds', coalesce((select jsonb_agg(a.user_id) from public.check_acks a
                                 where a.game_id = g.id and a.round = g.check_round and g.check_open), '[]'::jsonb),
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
       where m.room_id = p_room), '[]'::jsonb),
    'pauseRequests', case when g.id is null or g.status <> 'running' or g.paused then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('userId', pq.user_id, 'name', pr.display_name, 'at', pq.created_at) order by pq.created_at)
        from public.pause_requests pq join public.profiles pr on pr.id = pq.user_id
       where pq.game_id = g.id and pq.created_at > now() - interval '60 seconds'), '[]'::jsonb) end,
    'joinRequests', case when r.host_id = v_uid then coalesce((
      select jsonb_agg(jsonb_build_object('userId', pr.id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
                                          'requestedAt', q.created_at) order by q.created_at)
        from public.room_join_requests q join public.profiles pr on pr.id = q.user_id
       where q.room_id = p_room and q.status = 'pending'), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

-- ─── Privileges ───────────────────────────────────────────────────────────────
revoke execute on function public._ticket_score(smallint[], smallint[]), public._pick_ticket(smallint[]),
  public._ticket_pay_coins(), public._ticket_refund_coins(), public._game_cancel_refund(), public._prize_pay_coins(),
  public._welcome_coins()
  from public, anon, authenticated;
revoke execute on function public.set_max_tickets(uuid, int), public.mark_chat_read(uuid, bigint), public.get_chat_reads(uuid),
  public.chat_typing(uuid), public.delete_chat_message(bigint), public.set_stake_mode(uuid, text),
  public.get_my_coin_ledger(int), public.admin_adjust_coins(uuid, numeric, text)
  from public, anon;
grant execute on function public.set_max_tickets(uuid, int), public.mark_chat_read(uuid, bigint), public.get_chat_reads(uuid),
  public.chat_typing(uuid), public.delete_chat_message(bigint), public.set_stake_mode(uuid, text),
  public.get_my_coin_ledger(int), public.admin_adjust_coins(uuid, numeric, text)
  to authenticated;
