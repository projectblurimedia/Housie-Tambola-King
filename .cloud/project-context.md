# Project Context (living memory)

_Last updated: 2026-11-17_

## Product
**Housie Tambola King** — online Housie/Tambola for India (English + Telugu). Package `com.housietambolaking.app`. (Note: "King" titles exist on Play Store — check the listing name is accepted before publishing.)

### Core (owner's spec, 2026-11-17)
- Home = **Create Room** / **Join Room**. Rooms are **public or private**, **Normal** (one game, play again) or **Series** (N games; next lobby opens automatically for all).
- Host customises everything: max players, ticket price, speed, prizes — Fast 3/5/7, Lines 1–3 (default all), Columns Left/Center/Right = column groups 1–3/4–6/7–9 (default all), Full Housie (always).
- **Casual ₹ amounts only, no real money, no wallet/coins, no payments.** Pot = tickets × price; prize amounts must equal the pot each game (auto-split by template proportions; host can edit).
- Every game each player picks 1–4 tickets. Start needs ≥2 players with tickets.
- Numbers spoken aloud on every phone. Players **tap to strike**; completing a prize auto-claims. First wins; same called number = split equally.
- Animated winner announcement on all phones: name, prize, winning numbers, amount/split.
- Standings per room/series saved: wins, won, spent, net, every win listed.
- Secondary: Solo vs bots (offline), Caller Mode (printable tickets).

### Accounts
Name entry → guest (Supabase anonymous, name in metadata) → play instantly. Optional phone OTP (Fast2SMS) to keep the account.

## Status
| Area | State |
|---|---|
| DB (5 migrations) | **Applied** to Supabase project `lpquvqgguvwfmualfkkl` (ap-south-1); pg_cron clock running |
| Edge Function send-sms-hook | Written; not deployed (phone OTP optional; guests use anonymous sign-in) |
| App | typecheck clean, 23 unit tests, expo-doctor 20/20; EAS project @projectblurimedia/housie-tambola-king; preview APK via EAS (local keystore in app/credentials/, gitignored — back it up) |
| Admin web | Live: https://housie-tambola-king-admin.vercel.app (Vercel account projectblurimedia@gmail.com) |
| GitHub | https://github.com/projectblurimedia/Housie-Tambola-King (`main`) |
| E2E `scripts/smoke-test.mjs` | Needs "Allow anonymous sign-ins" ON in Supabase Auth settings |

All accounts for this project belong to projectblurimedia@gmail.com (owner's rule). This PC's default Vercel/GitHub logins are NearbyU's — use `--global-config C:/Users/MANIKANTA/.vercel-projectblurimedia` for Vercel and the `projectblurimedia@` remote URL for git.

Removed in the 2026-11-17 redesign (never shipped): coins/wallet, daily bonus, Razorpay, public auto-scheduled tiers, global leaderboard.

## Pending from owner
Supabase project URL + anon key + access token + DB password; Fast2SMS key (optional — guests work without SMS); privacy/terms URLs, support email.
