# Architecture

```
 app/ (Expo RN)            admin-web/ (Vite React)
      │  supabase-js (anon key + user JWT)      │
      ▼                                          ▼
 ┌──────────────────────── Supabase ────────────────────────┐
 │ Auth: phone OTP (Send-SMS hook → Edge Fn → Fast2SMS)     │
 │       anonymous guests → link phone later                │
 │ Postgres: tables (RLS, no client writes)                 │
 │           RPCs (SECURITY DEFINER) = the whole game API   │
 │           pg_cron every 1 s → advance_due_games()        │
 │ Realtime: private broadcast topic room:<id>              │
 │           (sent only by the DB via realtime.send)        │
 │ Edge Functions: send-sms-hook (OTP via Fast2SMS)         │
 └──────────────────────────────────────────────────────────┘
```

## Why no Express server (unlike NearbyU)
Live games need websockets and a reliable 1-second clock; Vercel serverless can't hold either. Supabase gives Realtime + pg_cron + Postgres functions in one place, so the game logic lives next to the data and runs in single transactions (no race between "number called" and "prize claimed").

## Game engine (server) — see docs/game-rules.md
- `rooms` (normal/series, public/private) → `games` (one per round: lobby → running → finished) → `tickets` (1–4 per player per game).
- At start: `game_secrets.draw_order` = CSPRNG shuffle of 1–90; unreadable to every client.
- Clock: pg_cron every second → `advance_due_games()` → `_advance_game` (row lock `FOR UPDATE SKIP LOCKED`, so cron + client `nudge_game` never double-call).
- Tick: settle prizes won on the previous number → finish if Full Housie settled / 90 called → else call next number, broadcast `call`.
- Finishing a series game opens the next game's lobby (`_new_game`); the last one ends the room.
- Claims: the app claims when the player's strikes complete a prize; `claim_prize` locks the game row and verifies against called numbers. First claim wins; same completion number + claim before the next call = split (`claim_window_call`).
- Amounts are casual ₹: pot = tickets × price; `_auto_split` matches prize amounts to the pot unless the host's custom amounts already equal it. No wallet / no real money.

## Ticket format (shared contract)
`cells smallint[27]`, row-major 3×9, 0 = blank; 5 numbers per row; column ranges 1–9, 10–19 … 80–90; ascending down a column. Implemented twice and kept identical: SQL `_generate_ticket/_prize_numbers/_prize_completed_at` and `app/src/game/engine/ticket.ts` (unit-tested).

## App structure (same conventions as NearbyU)
```
app/src/
  screens/     composition only (auth, home, room, solo, caller, profile)
  components/  shared UI (TicketView, NumberBall, WinnerOverlay, Confetti, PrizeList, ui.tsx…)
  hooks/       data + behaviour (useRoom = state + realtime + backup clock)
  services/    every Supabase call (one file per area) + error normalization
  game/engine/ pure TS rules (ticket, pot split, solo bots, spoken calls) — vitest
  state/       zustand stores (settings, strikes, winner queue, caller board, toast, session)
  localization/ en.json + te.json (parity-tested), errorMessages.ts
```
`useRoom`: one `get_room_state` fetch, then applies broadcasts to the React Query cache; refetches on (re)subscribe, on foreground, and on a slow poll; nudges the server clock if a number is >2.5 s overdue. `prize` broadcasts feed the global `WinnerOverlay` queue so every phone shows the announcement.

## Security model
- No client has INSERT/UPDATE/DELETE on room/game tables. Profiles expose only public columns via column grants.
- Internal functions (`_*`, cron entry points) have EXECUTE revoked from `anon`/`authenticated`.
- Realtime topics are private; RLS on `realtime.messages` allows SELECT for game members only and no INSERT — clients can't spoof calls/winners.
- Admin: `profiles.role = 'admin'`; every admin RPC calls `_require_admin()`; config tables writable only via admin RLS policies; changes audit-logged by triggers.
