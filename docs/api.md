# API (Supabase RPCs & Edge Functions)

All calls go through `supabase-js` with the user's JWT. Errors are raised as a bare code in `error.message` (e.g. `ROOM_FULL`); the app maps codes via `app/src/localization/*.json → errors.*`.

## Login (`anon`)
| RPC | Args | Returns | Errors |
|---|---|---|---|

Testing phase only: no proof of owning the number. Replace with SMS OTP before launch.

## Player RPCs (`authenticated`)
| RPC | Args | Returns | Errors |
|---|---|---|---|
| `get_me` | – | profile + stats | `PROFILE_NOT_FOUND` |
| `update_my_profile` | `p_display_name?, p_avatar_key? (a1…a50), p_language?` | `get_me` | `INVALID_DISPLAY_NAME`, `INVALID_AVATAR` |
| `delete_my_account` | – | – | – |
| `phone_register` | `p_phone, p_name, p_pin (4 digits)` (anon) — new account, or sets the PIN of an old no-PIN account | `{email, password}` one-time sign-in credentials | `INVALID_PHONE`, `INVALID_DISPLAY_NAME`, `INVALID_PIN`, `PHONE_TAKEN`, `ACCOUNT_BANNED` |
| `pin_login` | `p_phone, p_pin` (anon) | `{email, password}` or `{error: WRONG_PIN, attemptsLeft}` / `{error: PIN_LOCKED, lockedUntil}` / `{error: ACCOUNT_NOT_FOUND}` / `{error: PIN_NOT_SET}` (5 wrong → 15 min lock) | `INVALID_PHONE`, `INVALID_PIN`, `ACCOUNT_BANNED` |
| `report_crash` | `p_message, p_stack?, p_fatal?, p_source (js/boundary/promise), p_screen?, p_app_version?, p_update_id?, p_platform?, p_os_version?` (anon + authenticated; 20/h per player) | – | – |
| `admin_list_crashes` | `p_limit, p_offset` (admin) | `{total, last24h, rows[]}` | `NOT_ADMIN` |
| `create_room` | `p_title, p_kind (normal/series), p_visibility (public/private), p_max_players, p_ticket_price, p_call_interval_seconds, p_series_length, p_prizes {prize: ₹}, p_claim_mode ('fastest' | 'fair' = Auto), p_auto_mark (= auto hint), p_check_claims (true = Normal rule, false = Fastest finger), p_chat_enabled (default true), p_check_seconds (5–60, default 10)` | `{roomId, code}` | `INVALID_PRIZES`, `INVALID_TICKET_PRICE`, `INVALID_MAX_PLAYERS`, `INVALID_SERIES_LENGTH`, `TOO_MANY_OPEN_ROOMS` |
| `join_room_by_code` | `p_code` | `{roomId, status: member/pending}` (host must accept) | `ROOM_NOT_FOUND`, `ROOM_FULL`, `ROOM_ENDED` |
| `join_public_room` | `p_room` | same | same |
| `my_join_status` | `p_room` | `{status: member/pending/rejected/none, title, code, hostName}` | – |
| `respond_join_request` | `p_room, p_user, p_accept` (host) | – | `NOT_HOST`, `REQUEST_NOT_FOUND`, `ROOM_FULL` |
| `leave_room` / `end_room` / `play_again` | `p_room` | – | `NOT_HOST`, `ROOM_STILL_PLAYING` |
| `open_tickets` | `p_game` (host) — lobby step 1 → 2 | – | `NOT_HOST`, `NEED_TWO_PLAYERS`, `GAME_ALREADY_STARTED` |
| `set_my_tickets` | `p_game, p_count (1–4)`, once per game, only after `open_tickets` | my tickets | `INVALID_TICKET_COUNT`, `TICKETS_ALREADY_CHOSEN`, `TICKETS_NOT_OPEN`, `GAME_ALREADY_STARTED`, `NOT_IN_ROOM` |
| `set_game_prizes` | `p_game, p_amounts {prize: ₹}` (host) — the keys ARE this game's prize set (Full Housie required); becomes the room default | – | `PRIZES_MUST_EQUAL_POT`, `INVALID_PRIZES`, `NOT_HOST` |
| `start_game` | `p_game` (host; ready step, everyone ready) | – | `NOT_ALL_READY`, `NOT_HOST`, `GAME_ALREADY_STARTED` |
| `set_game_paused` | `p_game, p_paused` (host) | – | `NOT_HOST`, `GAME_NOT_RUNNING` |
| `set_call_speed` | `p_room, p_seconds (1–20)` (host) | – | `NOT_HOST`, `INVALID_SPEED` |
| `remove_member` | `p_room, p_user` (host) | – | `NOT_HOST`, `CANNOT_REMOVE_SELF` |
| `claim_prize` | `p_ticket, p_prize` | `{result: won/shared/too_late/already_claimed/already_yours/not_complete}` | `GAME_NOT_RUNNING`, `TOO_MANY_CLAIMS` |
| `update_room_settings` | `p_room, p_title, p_visibility, p_max_players, p_ticket_price, p_check_claims, p_check_seconds, p_auto_mark, p_chat_enabled, p_claim_mode?` (host, lobby only; broadcasts `room_settings`) | – | `NOT_HOST`, `GAME_ALREADY_STARTED`, `PRICE_LOCKED`, `INVALID_MAX_PLAYERS`, `INVALID_TICKET_PRICE` |
| `open_ready` | `p_game` (host, tickets step; after `set_game_prizes`) — step 3 | – | `NOT_HOST`, `TICKETS_NOT_OPEN`, `NEED_TWO_PLAYERS` |
| `set_ready` | `p_game` — the host can start once every ticket holder is ready | – | `NOT_READY_STEP`, `NO_TICKETS` |
| `check_done` | `p_game` — "checked" in the current check round | – | `NO_TICKETS` |
| `end_check` | `p_game` (host) — stop waiting for the check | – | `NOT_HOST` |
| `set_hint_mode` | `p_room, p_mode ('next'/'struck')` (host) | – | `NOT_HOST`, `INVALID_HINT_MODE` |
| `set_series_length` | `p_room, p_len (0 = no limit, else 2–50 and ≥ the game in the lobby)` (host, series rooms, lobby only; broadcasts `room_settings`) | – | `NOT_HOST`, `NOT_A_SERIES`, `GAME_ALREADY_STARTED`, `INVALID_SERIES_LENGTH` |
| `request_pause` | `p_game` (member; running, not paused; once per 30 s) — broadcasts `pause_request {gameId, userId, name}` for the host | – | `NOT_IN_ROOM`, `GAME_NOT_RUNNING`, `PAUSE_ASKED_RECENTLY` |
| `hide_room` | `p_room` — remove an ended / left room from My rooms (hidden_rooms) | – | `ROOM_STILL_OPEN` |
| `get_chat` | `p_room` — messages since I (last) joined, with `kind` user / join / leave (join/leave lines are written by a trigger on room_members) | messages | `NOT_IN_ROOM` |
| `set_stake_mode` | `p_room, p_mode (free / coins / amount)` (host, lobby, before tickets) | – | `NOT_HOST`, `INVALID_STAKE_MODE`, `GAME_ALREADY_STARTED`, `PRICE_LOCKED` |
| `set_max_tickets` | `p_room, p_max (1–10)` (host, lobby) | – | `NOT_HOST`, `INVALID_TICKET_COUNT`, `GAME_ALREADY_STARTED` |
| `set_my_tickets` | `p_game, p_count (1..rooms.max_tickets)` — each ticket = best of 40 (fewest numbers shared with my other tickets, no empty columns); coins rooms take ticket_price coins per ticket | tickets | `INVALID_TICKET_COUNT`, `NOT_ENOUGH_COINS`, … |
| `tell_host` | `p_room, p_text` (member; 1 per 15 s) — broadcast `player_issue` to the host | – | `NOT_IN_ROOM`, `INVALID_MESSAGE`, `CHAT_TOO_FAST` |
| `mark_chat_read` / `get_chat_reads` | `p_room, p_last_id` / `p_room` — read receipts (broadcast `chat_read`) | – / `[{userId, lastReadId}]` | `NOT_IN_ROOM` |
| `chat_typing` | `p_room` — broadcast `typing` (nothing stored) | – | – |
| `delete_chat_message` | `p_id` (own message) — broadcast `chat_deleted` | – | `NOT_YOUR_MESSAGE` |
| `get_my_coin_ledger` | `p_limit` | `[{delta, reason, roomTitle, at}]` | – |
| `admin_adjust_coins` | `p_user, p_delta, p_note` (admin; never below 0; audit-logged) | new balance | `NOT_ENOUGH_COINS`, `INVALID_AMOUNT` |
| `set_late_claim` | `p_room, p_calls (0–90; 0 = off)` (host, not while a game is running; broadcasts `room_settings`) — Normal rule "Late claim" | – | `NOT_HOST`, `INVALID_LATE_CLAIM`, `GAME_ALREADY_STARTED` |
| `send_chat` | `p_room, p_body (1–200 chars)` | message `{id, userId, name, avatarKey, body, at}` (also broadcast `chat`) | `CHAT_OFF`, `CHAT_TOO_FAST` (5 per 10 s), `INVALID_MESSAGE`, `NOT_IN_ROOM` |
| `get_chat` | `p_room` | last 50 messages, oldest first | `NOT_IN_ROOM` |
| `nudge_game` | `p_game` | – (advances only if a call is overdue) | – |
| `get_room_state` | `p_room` | room + current game + prizes + my tickets + members + previousGameId + serverTime | `NOT_IN_ROOM` |
| `get_game_results` | `p_game` | prizes with winners, numbers, amounts + per-player tickets/spent/won/net | `NOT_IN_ROOM` |
| `get_room_standings` | `p_room` | per player: games, tickets, spent, wins, won, net, list | `NOT_IN_ROOM` |
| `get_room_ledger` | `p_room` | finished games: `{gameNo, pot, rows[{userId, tickets, spent, won, net}]}` | `NOT_IN_ROOM` |
| `list_public_rooms` / `get_my_rooms` | – | summaries | – |
| `register_push_token` | `p_token, p_platform` | – | `INVALID_PUSH_TOKEN` |

## Party games (`authenticated`, points only)
Find Seeta (3–15 players), Show (3–10), Snakes & Ladders (2–6) and Ashta Chamma (2–4). Board games are one game (rounds = 1). Entry coins are paid by everyone at `start_party` (`PLAYER_LOW_COINS` if anyone is short; Ashta Chamma teams need 4: `TEAMS_NEED_4`), the winners split the pot, `end_party` mid-game refunds. Board games: 3 server-played turns = out; `start_party` raises `NEED_MORE_PLAYERS` below the minimum and `NOT_ENOUGH_ITEMS` for a custom Show category with fewer items than players. Roles / hands are in `party_secrets` (no client access); each player reads only their own.

| RPC | Args | Returns | Errors |
|---|---|---|---|
| `create_party` | `p_kind, p_rounds (3–20; board games 1), p_entry (0–10,000 coins), p_options (Snakes & Ladders: {board 0–14: easy 0–4, medium 5–9, hard 10–14; theme 0–8 board design; icons true/false pictures in squares}; Ashta Chamma: {start enter·board, safe corners·straight, teams, needCut})` | `{id, code}` | `INVALID_PARTY_KIND`, `INVALID_ROUNDS`, `INVALID_ENTRY`, `NOT_ENOUGH_COINS`, `TOO_MANY_OPEN_PARTIES` (3) |
| `join_party_by_code` | `p_code` | party id (no approval; lobby only) | `PARTY_NOT_FOUND`, `PARTY_STARTED`, `PARTY_FULL` |
| `get_party_state` | `p_game` | `{game{…, phase, turnNo, state, deadline}, players[{…, score, active, picked}], me{role, hand, pick}, serverNow}` | `NOT_A_MEMBER` |
| `get_my_parties` | – | my open / finished party games | – |
| `start_party` / `play_party_again` / `end_party` | `p_game` | – (host) | `NOT_HOST`, `NEED_3_PLAYERS`, `PARTY_STARTED` |
| `leave_party` / `remove_party_player` | `p_game` (+ `p_user`) | – (mid-game: inactive; < 3 left ends the game) | `NOT_HOST` |
| `seeta_guess` | `p_game, p_target` | – (Ram only; reveals all roles + scores) | `NOT_RAM`, `NOT_NOW`, `INVALID_TARGET` |
| `show_pick` | `p_game, p_index (0–3)` | – (all picked → every card passes to the next seat) | `NOT_NOW`, `INVALID_CARD` |
| `show_call` | `p_game` | – (first needs 4 of a colour; then everyone races) | `NOT_A_SHOW`, `NOT_NOW` |
| `set_party_options` | `p_game, p_category ('colors'·'fruits'·'animals'·'flowers'·'sweets'·'vehicles'·'custom'), p_items [{e, n}] (custom: 3–10), p_title` | – (Show, host, lobby) | `INVALID_CATEGORY`, `NOT_HOST`, `NOT_NOW` |
| `snakes_roll` | `p_game` | – (your turn; die 1–6, ladders / snakes, 6 = again) | `NOT_YOUR_TURN`, `NOT_NOW` |
| `chamma_throw` | `p_game` | – (4 seeds; none up = 8) | `NOT_YOUR_TURN`, `NOT_NOW` |
| `chamma_move` | `p_game, p_pawn (0–3)` | – | `INVALID_PAWN`, `INVALID_MOVE`, `NOT_YOUR_TURN` |
| `send_party_chat` / `get_party_chat` | `p_game` (+ `p_body` 1–200) | message / last 80 since I joined (broadcast `chat` on party:<id>) | `INVALID_MESSAGE`, `CHAT_TOO_FAST`, `NOT_A_MEMBER` |
| `party_nudge` | `p_game` | – (acts on a passed deadline; pg_cron `party-tick` does too) | – |

Private channel `party:<id>` (members only): `players`, `picked {userId}`, `move {userId, …}`, `throw {userId, throw, seeds}`, `turn {userId}`, `round {roundNo}`, `turn {turn}`, `show {userId, first}`, `reveal`, `finished`, `lobby`, `closed`.

## Realtime
Private channel `room:<roomId>` (members only, receive-only). Events: `call {gameId, n, index, nextCallAt}`, `prize {gameId, prize, amount, callIndex, winners[{userId, name, avatarKey, ticketSerial, numbers}]}`, `prize_settled {gameId, prize, each, winners, amount, callIndex, winnerList[…, amount]}` (check rooms announce on this), `claim_check {gameId, prize, callIndex, winners, deadline, round, earlier}` (`earlier` = a late claim replaced the previous winners), `speed {seconds}`, `paused {gameId, paused}`, `phase {gameId, phase}`, `chat {id, userId, name, avatarKey, body, at}`, `ready {gameId, userIds}`, `check_ack {gameId, round, userIds}`, `final_check {gameId, deadline, round}`, `room_settings`, `lobby {gameId, ticketCount, playerCount, pot}`, `members {memberCount, joined?}`, `state {gameId, gameNo, status}`, `game {gameId, gameNo}` (next lobby opened), `room_ended {reason}`.

## Admin RPCs (`role = admin`)
`admin_dashboard`, `admin_list_players`, `admin_get_player`, `admin_set_ban`, `admin_set_role`, `admin_list_rooms`, `admin_end_room`. `app_settings` is edited directly under admin-only RLS (audit-logged).

## Edge Functions
| Function | Auth | Purpose |
|---|---|---|
| `send-sms-hook` | Standard-Webhooks signature | Supabase Auth OTP → Fast2SMS |
