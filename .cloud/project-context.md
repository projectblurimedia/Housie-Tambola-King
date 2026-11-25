# Project Context (living memory)

_Last updated: 2026-11-19_

## Product
**Housie Tambola King** — online Housie/Tambola for India (English + Telugu). Package `com.housietambolaking.app`. (Note: "King" titles exist on Play Store — check the listing name is accepted before publishing.)

### Core (owner's spec, 2026-11-17)
- Home = **Create Room** / **Join Room**. Rooms are **public or private**, **Normal** (one game, play again) or **Series** (N games; next lobby opens automatically for all).
- Host customises everything: max players, ticket price, speed, prizes — Fast 3/5/7, Lines 1–3 (default all), Columns Left/Center/Right = column groups 1–3/4–6/7–9 (default all), Full Housie (always).
- **No real money, no payments.** Rooms are Free, play Coins (no money value, 2026-11-25), or casual ₹ amounts for scoring. Pot = tickets × price; prize amounts must equal the pot each game (auto-split by template proportions; host can edit).
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
- Third rule **Auto** (claim_mode 'fair'): app strikes, server awards same-number winners.
- Claim rules: **Normal** (default; 10 s "check your tickets", same-number wins shared, then the announcement) or **Fastest finger** (first claim wins alone). Fair play removed.
- Auto hint (called numbers glow; never auto-marked). Prizes per game only (no prize choice at creation).
- Step 3 = prizes set → everyone "ready" → host starts (no auto start). Late claimers share during a check. Check rounds end early when all checked; check time can be "until all ready" (0). Final check after number 90.
- Host can edit room settings in the lobby (visible to all). Normal rule has a check time (default 10 s); the claim replaces the number header with a sound.
- Native modules added after the last APK (expo-audio, expo-screen-orientation, expo-navigation-bar) are loaded only if requireOptionalNativeModule finds them — a plain require crashes the app.
- Room chat (host option, default on; per-player mute). **Voice chat pending**: needs a provider (LiveKit/Agora, owner's account) + a native build.
- Voice, sounds and ticket style live only in Profile. Caller Mode is landscape (real rotation needs expo-screen-orientation → next build; current APK draws it rotated).
- Wins on the same number show on one card; prize sounds (fast/line/column/full house; full house wins). Sounds need expo-audio → only in the next APK build; the current APK falls back to haptics.
- Players choose ticket colour + strike colour; tickets use round number chips.
- **Late claim** (Normal rule, 2026-11-19): host sets 0–90 numbers (− 0 +, new rooms default 2; 0 = off). During a check, a player who finished the prize on an earlier number and claims within that many numbers wins it instead of the later finisher (`set_late_claim`, migration 20261128000001).
- Opening: no native splash logo — the coded opening scene shows from the first frame (JS part is live via OTA; the blank native splash needs the next APK build). Winner card: shiny gold frame with a sweeping glint, radial glow + turning light rays like the opening, "CONGRATULATIONS!" when you won.
- Create Room / lobby settings: the rule's options sit in one dropdown (Time to check − + with 0 = until all ready = default, Late claim − + default 2, Auto hint). Header icon uses the same shiny crown as the opening.
- Performance pass (2026-11-19): broadcasts coalesce into one jittered room refetch per phone (ready / check lists patched from the event); live tickets no longer redraw on the 0.5 s countdown; backup poll 5 s when realtime is down, 15–20 s when up; all Supabase performance-advisor warnings fixed (FK indexes, RLS initplan), claim_attempts pruned daily.
- Crash reporting (2026-11-19): app JS crashes / screen crashes / unhandled rejections → `report_crash` → admin web "Crashes" (kept 30 days). Native crashes: Play Console Android vitals.
- Privacy Policy + Terms: https://housie-tambola-king-admin.vercel.app/privacy.html and /terms.html (admin-web/public); contact projectblurimedia@gmail.com (owner's choice).
- Large phone font sizes (2026-11-21, same as NearbyU): `src/utils/fontScaleCap.ts` (imported first in index.ts) caps text at 1.15×; text inside fixed-size shapes uses `maxFontSizeMultiplier={FIXED_SHAPE_SCALE}` (=1) — ticket numbers (also sized to their circle), balls, 1–90 board, avatars, PIN digits, steppers. New fixed-size text must do the same. Grids of % tiles use space-between + rowGap (no fixed column gap).
- 2026-11-21 round: host's claim header shows "Continue game" after checking (not "Checked" again); login balls 7/31/65 with smoother Poppins numerals; profile cached on the phone (no "Namaste, !"); winner names on a solid plate; speech engine warmed up on open and first number never cut by Speech.stop; "CALLED n/90" small pill; caller speed in Create + Edit; series games editable (`set_series_length`, migration 20261201000001 — applied 2026-11-23); ledger "1." + stretched columns; prize setup keeps the host's amounts, Full Housie takes the balance, whole-rupee Auto split, pot meter.
- Game screen = one Play page: tickets → called board → prizes (still to win / already won); tabs are only Play + Standings. Host has Dismiss room / End room under the room tabs (Play tab). Opening balls: Luckiest Guy, one line inside the face (no "6" for 65). Home refetches My rooms on focus; the room screen invalidates it when status / game changes.
- 2026-11-23 round (migration 20261202000001 — applied 2026-11-23): chat from join time only + join/leave lines; request_pause; past players see room history (`_can_view_room`, My rooms lists left rooms → RoomHistory screen); clean-up after `app_settings.room_retention_days` (admin Settings, default 30, nightly `purge_old_rooms`), "Deletes in N days" on My rooms; `hide_room` (Remove from My rooms). App: game side panel "‹" (chat, pause / ask to pause, caller voice EN / TE / both — `settingsStore.callLanguage`); chat = half-height sheet opening at the newest message; winner card closes only with ✕; game-by-game shows won + net; dismiss room full width on the Play tab only; ended room: view chat, quit, remove; voice test speaks a sentence; waiting ball "READY"; share = https link …/join/CODE (admin-web/public/join.html → housietambolaking://join/CODE → auto join).
- Game-by-game shows **net only** (+ green / − red) per game and in total. My rooms cards: no delete date / trash; inside an ended room: Room chat + Delete tiles and "deletes itself in N days" (no Quit once ended). Chat sheet: drag handle — swipe up full screen, down half / close.
- Caller voice: numbers queue (no mid-word cut-off; skip ahead only when 2 are waiting); after 6 s of quiet a short "Number" / "నంబర్" lead-in absorbs the audio wake-up (game start, after resume); no silent warm-up utterance. In-game voice = English or Telugu only (EN+TE only in Caller Mode). Pause requests: host banner (live store + get_room_state.pauseRequests, migration 20261203000001). "Reconnecting" only after 5 s with no live connection or messages; the channel is rebuilt after errors. Dismiss / End button is last on the Play tab. Room-name placeholder rotates (Family / Friends / Office / Kitty Party / Diwali Housie).
- Game screen: floating Room chat (bottom-left) and Pause/Resume or Ask to pause (bottom-right); no side panel. Caller voice (on/off, English or Telugu, voice) lives in the game settings sheet. Chat is an in-screen panel that fades (not a pop-up), so tickets above stay tappable; back button closes it. Status colours: Live green, You left red, ended grey, lobby purple. Hint colour defaults to purple (store v4 moves old pink once).
- 2026-11-25 round (migrations 20261204000001 + 20261204000002, applied): **play coins** (profiles.coins, 1000 each, coin_ledger; rooms.stake_mode free / coins / amount; triggers pay on ticket insert, refund on lobby delete / cancelled game, pay prizes on settle; admin_adjust_coins in admin web); rooms.max_tickets (1–10, default 3) + compact ticket picker; tickets = best of 40 (avg 1.2 shared numbers per pair vs ~2.5 random; no empty columns); ready step pops a details card with I'm ready + "tell the host" (tell_host → player_issue); host accepts / declines join requests from a strip in the game; watchers see who's playing; chat: bottom-up list, typing, ✓/✓✓ seen, long-press info + delete for everyone, header drag follows the finger; English numbers spoken as words ("thirty"); no Telugu voice → English; no system alerts (ConfirmModal everywhere); minimal pot strip + completed card. **Not built (owner decision / law): buying coins, real-money wallet** — see the 2026-11-25 chat guidance.
- 2026-11-25 polish: Create Room "Play for" = compact tiles Free / Coins / **₹ Amount** (score only); "Max tickets" (per player, up to 10); auto hint defaults to **Until next number** (two preview cards). Coins drawn as a gold coin with the app's crown (`components/CoinIcon.tsx`, CoinAmount); in sentences "N coins". Home header coin pill = dark glass + gold edge. Profile no longer shows a coins card / history (removed). Home title full width (coin pill sits beside the greeting); profile card: rays + crowned gold-ringed photo + 2 stats (no amount-won tile); coin = minted gold coin with an embossed crown (no jewels); Home coins = small pill under the photo (1.2K style); Profile = cover card + colour-tiled settings sections + games / prizes / coins stats; How to play = 8-step timeline for the current rules.
- **Party games** (2026-11-25, migration 20261205000001_party_games): Home "Party games" cards → details (rules, rounds 3–20, create, join by code, your games) → live game. **Find Seeta** (classic Ram/Seeta points, 15 Ramayana roles) and **Show** (pass colour cards round a circular table, SHOW race, last gets 0). Points only. Codes share the Housie join link (Join Room falls back to party codes). pg_cron `party-tick` every 1 s + `party-cleanup` hourly.
- Pull-to-refresh = NearbyU's PullToRefresh (`components/PullToRefresh.tsx`) on Home + Join Room. Profile: Sound & voice ends with Call numbers aloud → Caller voice; Language & look = gradient choice tiles; ready-made ticket looks removed.
- Secondary: Caller Mode. (Solo vs bots removed 2026-11-18.)

### Accounts
**Mobile + 4-digit PIN (owner, 2026-11-19):** register = name + mobile + PIN + confirm PIN (`phone_register`); login = mobile + PIN (`pin_login`, 5 wrong → 15 min lock). PINs are bcrypt hashes in `player_pins` (no client access). Old no-PIN accounts set a PIN once via register. Old `phone_login` dropped. **Forgot PIN: pending** (owner will add SMS OTP later).
Admin web: mobile + password (temporary), admin 7093054784.

## Status
| Area | State |
|---|---|
| DB (26 migrations, latest 20261205000001_party_games) | **Applied** to Supabase project `lpquvqgguvwfmualfkkl` (ap-south-1); pg_cron clock running |
| Edge Function send-sms-hook | Written; not deployed (phone OTP optional; guests use anonymous sign-in) |
| App | typecheck clean, 24 unit tests; EAS project @projectblurimedia/housie-tambola-king; latest preview APK versionCode 5 (2026-11-19: PIN login, expo-audio, screen-orientation, blank native splash, new icon) via EAS (local keystore in app/credentials/, gitignored — back it up) |
| Admin web | Live: https://housie-tambola-king-admin.vercel.app (Vercel account projectblurimedia@gmail.com) |
| GitHub | https://github.com/projectblurimedia/Housie-Tambola-King (`main`) |
| E2E `scripts/smoke-test.mjs` | **Passes live** against the hosted project (2026-11-23, incl. chat history, pause request, room history, clean-up) |

All accounts for this project belong to projectblurimedia@gmail.com (owner's rule). This PC's default Vercel/GitHub logins are NearbyU's — use `--global-config C:/Users/MANIKANTA/.vercel-projectblurimedia` for Vercel and the `projectblurimedia@` remote URL for git.

Removed in the 2026-11-17 redesign (never shipped): coins/wallet, daily bonus, Razorpay, public auto-scheduled tiers, global leaderboard.

## Google Play (started 2026-11-20)
- Full guide + copy-paste texts: `docs/store-listing/listing.md`; icon 512 + feature graphic in the same folder.
- Account deletion page: https://housie-tambola-king-admin.vercel.app/delete-account.html
- Review logins: live accounts "Play Review 1" and "Play Review 2" (numbers + PIN with the owner, not in git).
- Play AAB = GitHub Actions workflow **android-aab** (Run workflow, or push tag `android-aab-*`) → artifact housie-aab-N; signed with the upload key from repo secrets (6 secrets); OTA channel production. First AAB: versionCode 6, run 44759035473 (2026-11-20). EAS free builds are shared with NearbyU and ran out; local Windows builds fail on the 260-char path limit. Bump app.json versionCode before each new AAB. Play installs listen on the **production** OTA channel → publish every update to `production` and `preview`.
- expo-audio background playback off + FOREGROUND_SERVICE_MEDIA_PLAYBACK blocked (APK versionCode 5 still has it; the first AAB does not).
- Content rating: simulated gambling = Yes (bingo with pretend ₹), real-money gambling = No; target audience 18+.

## Before public launch
- App logo = owner's artwork (app/assets/logo.png; icon/splash/adaptive made from it). New launcher icon + splash need the next APK build.
- Forgot PIN → SMS OTP reset (pending, owner).

## Pending from owner
Fast2SMS key (for Forgot PIN / OTP later).
