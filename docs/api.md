# API (Supabase RPCs & Edge Functions)

All calls go through `supabase-js` with the user's JWT. Errors are raised as a bare code in `error.message` (e.g. `ROOM_FULL`); the app maps codes via `app/src/localization/*.json → errors.*`.

## Login (`anon`)
| RPC | Args | Returns | Errors |
|---|---|---|---|
| `phone_login` | `p_phone, p_name` | `{email, password}` one-time credentials → `signInWithPassword` | `INVALID_PHONE`, `INVALID_DISPLAY_NAME`, `ACCOUNT_BANNED` |

Testing phase only: no proof of owning the number. Replace with SMS OTP before launch.

## Player RPCs (`authenticated`)
| RPC | Args | Returns | Errors |
|---|---|---|---|
| `get_me` | – | profile + stats | `PROFILE_NOT_FOUND` |
| `update_my_profile` | `p_display_name?, p_avatar_key?, p_language?` | `get_me` | `INVALID_DISPLAY_NAME`, `INVALID_AVATAR` |
| `delete_my_account` | – | – | – |
| `create_room` | `p_title, p_kind (normal/series), p_visibility (public/private), p_max_players, p_ticket_price, p_call_interval_seconds, p_series_length, p_prizes {prize: ₹}` | `{roomId, code}` | `INVALID_PRIZES`, `INVALID_TICKET_PRICE`, `INVALID_MAX_PLAYERS`, `INVALID_SERIES_LENGTH`, `TOO_MANY_OPEN_ROOMS` |
| `join_room_by_code` | `p_code` | `{roomId, status: member/pending}` (host must accept) | `ROOM_NOT_FOUND`, `ROOM_FULL`, `ROOM_ENDED` |
| `join_public_room` | `p_room` | same | same |
| `my_join_status` | `p_room` | `{status: member/pending/rejected/none, title, code, hostName}` | – |
| `respond_join_request` | `p_room, p_user, p_accept` (host) | – | `NOT_HOST`, `REQUEST_NOT_FOUND`, `ROOM_FULL` |
| `leave_room` / `end_room` / `play_again` | `p_room` | – | `NOT_HOST`, `ROOM_STILL_PLAYING` |
| `set_my_tickets` | `p_game, p_count (1–4)`, once per game | my tickets | `INVALID_TICKET_COUNT`, `TICKETS_ALREADY_CHOSEN`, `GAME_ALREADY_STARTED`, `NOT_IN_ROOM` |
| `set_game_prizes` | `p_game, p_amounts {prize: ₹}` (host) — the keys ARE this game's prize set (Full Housie required); becomes the room default | – | `PRIZES_MUST_EQUAL_POT`, `INVALID_PRIZES`, `NOT_HOST` |
| `start_game` | `p_game` (host) | – | `NEED_TWO_PLAYERS`, `NOT_HOST` |
| `set_game_paused` | `p_game, p_paused` (host) | – | `NOT_HOST`, `GAME_NOT_RUNNING` |
| `set_call_speed` | `p_room, p_seconds (3–20)` (host) | – | `NOT_HOST`, `INVALID_SPEED` |
| `remove_member` | `p_room, p_user` (host) | – | `NOT_HOST`, `CANNOT_REMOVE_SELF` |
| `claim_prize` | `p_ticket, p_prize` | `{result: won/shared/already_claimed/already_yours/not_complete}` | `GAME_NOT_RUNNING`, `TOO_MANY_CLAIMS` |
| `nudge_game` | `p_game` | – (advances only if a call is overdue) | – |
| `get_room_state` | `p_room` | room + current game + prizes + my tickets + members + previousGameId + serverTime | `NOT_IN_ROOM` |
| `get_game_results` | `p_game` | prizes with winners, numbers, amounts + per-player tickets/spent/won/net | `NOT_IN_ROOM` |
| `get_room_standings` | `p_room` | per player: games, tickets, spent, wins, won, net, list | `NOT_IN_ROOM` |
| `list_public_rooms` / `get_my_rooms` | – | summaries | – |
| `register_push_token` | `p_token, p_platform` | – | `INVALID_PUSH_TOKEN` |

## Realtime
Private channel `room:<roomId>` (members only, receive-only). Events: `call {gameId, n, index, nextCallAt}`, `prize {gameId, prize, amount, callIndex, winners[{userId, name, avatarKey, ticketSerial, numbers}]}`, `prize_settled {gameId, prize, each, winners}`, `lobby {gameId, ticketCount, playerCount, pot}`, `members {memberCount, joined?}`, `state {gameId, gameNo, status}`, `game {gameId, gameNo}` (next lobby opened), `room_ended {reason}`.

## Admin RPCs (`role = admin`)
`admin_dashboard`, `admin_list_players`, `admin_get_player`, `admin_set_ban`, `admin_set_role`, `admin_list_rooms`, `admin_end_room`. `app_settings` is edited directly under admin-only RLS (audit-logged).

## Edge Functions
| Function | Auth | Purpose |
|---|---|---|
| `send-sms-hook` | Standard-Webhooks signature | Supabase Auth OTP → Fast2SMS |
