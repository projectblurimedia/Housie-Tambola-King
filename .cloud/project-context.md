# Project Context (living memory)

_Last updated: 2026-11-18_

## Product
**Housie Tambola King** — online Housie/Tambola for India (English + Telugu). Package `com.housietambolaking.app`. (Note: "King" titles exist on Play Store — check the listing name is accepted before publishing.)

### Core (owner's spec, 2026-11-17)
- Home = **Create Room** / **Join Room**. Rooms are **public or private**, **Normal** (one game, play again) or **Series** (N games; next lobby opens automatically for all).
- Host customises everything: max players, ticket price, speed, prizes — Fast 3/5/7, Lines 1–3 (default all), Columns Left/Center/Right = column groups 1–3/4–6/7–9 (default all), Full Housie (always).
- **Casual ₹ amounts only, no real money, no wallet/coins, no payments.** Pot = tickets × price; prize amounts must equal the pot each game (auto-split by template proportions; host can edit).
- Every game each player picks 1–4 tickets, confirmed once (no changes that game). Start needs ≥2 players with tickets.
- Joining needs host approval; accepted mid-game = watch now, play next game.
- Prizes chosen at creation without amounts; host sets prize set + amounts before every game.
- Series: unlimited by default (host ends it) or a fixed 2–50.
- Tickets: 5 per row AND 5 per column group.
- Claim rule per room: fastest finger or fair play (server awards same-number completions); optional auto-mark. 8 s pause after a win. Host can pause/resume, change speed, remove players. Default speed 3 s.
- Print tickets removed (owner).
- Caller voice: numbers only; Telugu spelled in Telugu words; per-language voice picker.
- **Never run eas build / eas update without the owner's explicit OK.**
- Numbers spoken aloud on every phone. Players **tap to strike**; completing a prize auto-claims. First wins; same called number = split equally.
- Animated winner announcement on all phones: name, prize, winning numbers, amount/split.
- Standings per room/series saved: wins, won, spent, net, every win listed.
- Lobby steps every game: players join → host "Next" → everyone takes tickets → host "Next" (all have tickets) → set prizes & play.
- Claim rules: **Normal** (default; 10 s "check your tickets", same-number wins shared, then the announcement) or **Fastest finger** (first claim wins alone). Fair play removed.
- Auto hint (called numbers glow; never auto-marked). Prizes per game only (no prize choice at creation).
- Step 3 = prizes set → everyone "ready" → host starts (no auto start). Late claimers share during a check. Check rounds end early when all checked; check time can be "until all ready" (0). Final check after number 90.
- Host can edit room settings in the lobby (visible to all). Normal rule has a check time (default 10 s); the claim replaces the number header with a sound.
- Native modules added after the last APK (expo-audio, expo-screen-orientation, expo-navigation-bar) are loaded only if requireOptionalNativeModule finds them — a plain require crashes the app.
- Room chat (host option, default on; per-player mute). **Voice chat pending**: needs a provider (LiveKit/Agora, owner's account) + a native build.
- Voice, sounds and ticket style live only in Profile. Caller Mode is landscape (real rotation needs expo-screen-orientation → next build; current APK draws it rotated).
- Wins on the same number show on one card; prize sounds (fast/line/column/full house; full house wins). Sounds need expo-audio → only in the next APK build; the current APK falls back to haptics.
- Players choose ticket colour + strike colour; tickets use round number chips.
- Secondary: Caller Mode. (Solo vs bots removed 2026-11-18.)

### Accounts
**Testing phase (owner, 2026-11-18):** name + mobile number → logged in directly, **no OTP** (`phone_login` RPC, migration 20261118000001). Same number = same account. No guest/anonymous mode. Must be replaced by real SMS OTP before public launch (anyone can sign in as any number today).
Admin web: mobile + password (temporary), admin 7093054784.

## Status
| Area | State |
|---|---|
| DB (13 migrations, latest 20261124000001_host_start_late_share_ledger) | **Applied** to Supabase project `lpquvqgguvwfmualfkkl` (ap-south-1); pg_cron clock running |
| Edge Function send-sms-hook | Written; not deployed (phone OTP optional; guests use anonymous sign-in) |
| App | typecheck clean, 23 unit tests, expo-doctor 20/20; EAS project @projectblurimedia/housie-tambola-king; preview APK via EAS (local keystore in app/credentials/, gitignored — back it up) |
| Admin web | Live: https://housie-tambola-king-admin.vercel.app (Vercel account projectblurimedia@gmail.com) |
| GitHub | https://github.com/projectblurimedia/Housie-Tambola-King (`main`) |
| E2E `scripts/smoke-test.mjs` | **Passes live** against the hosted project (2026-11-18) |

All accounts for this project belong to projectblurimedia@gmail.com (owner's rule). This PC's default Vercel/GitHub logins are NearbyU's — use `--global-config C:/Users/MANIKANTA/.vercel-projectblurimedia` for Vercel and the `projectblurimedia@` remote URL for git.

Removed in the 2026-11-17 redesign (never shipped): coins/wallet, daily bonus, Razorpay, public auto-scheduled tiers, global leaderboard.

## Pending from owner
Fast2SMS key (to add real OTP), privacy/terms URLs, support email.
