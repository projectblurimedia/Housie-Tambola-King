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

## Realtime
Private channel `room:<roomId>` (members only, receive-only). Events: `call {gameId, n, index, nextCallAt}`, `prize {gameId, prize, amount, callIndex, winners[{userId, name, avatarKey, ticketSerial, numbers}]}`, `prize_settled {gameId, prize, each, winners, amount, callIndex, winnerList[…, amount]}` (check rooms announce on this), `claim_check {gameId, prize, callIndex, winners, deadline, round, earlier}` (`earlier` = a late claim replaced the previous winners), `speed {seconds}`, `paused {gameId, paused}`, `phase {gameId, phase}`, `chat {id, userId, name, avatarKey, body, at}`, `ready {gameId, userIds}`, `check_ack {gameId, round, userIds}`, `final_check {gameId, deadline, round}`, `room_settings`, `lobby {gameId, ticketCount, playerCount, pot}`, `members {memberCount, joined?}`, `state {gameId, gameNo, status}`, `game {gameId, gameNo}` (next lobby opened), `room_ended {reason}`.

## Admin RPCs (`role = admin`)
`admin_dashboard`, `admin_list_players`, `admin_get_player`, `admin_set_ban`, `admin_set_role`, `admin_list_rooms`, `admin_end_room`. `app_settings` is edited directly under admin-only RLS (audit-logged).

## Edge Functions
| Function | Auth | Purpose |
|---|---|---|
| `send-sms-hook` | Standard-Webhooks signature | Supabase Auth OTP → Fast2SMS |
