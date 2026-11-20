# Google Play — Housie Tambola King (`com.housietambolaking.app`)

Everything Play Console asks for, in order. Same process as NearbyU (2026-11-20).

Graphics in this folder (`node docs/store-listing/build.js` remakes them):
- `housie-icon-512.png` — app icon (512×512)
- `housie-feature-1024x500.png` — feature graphic (1024×500)

Public pages (live):
- Privacy policy: https://housie-tambola-king-admin.vercel.app/privacy.html
- Terms: https://housie-tambola-king-admin.vercel.app/terms.html
- Account deletion: https://housie-tambola-king-admin.vercel.app/delete-account.html

Review logins for Google's reviewers: two live accounts ("Play Review 1" and "Play Review 2"). Their numbers and PIN are kept out of git — the owner has them.

---

## Order of work

1. **Create app** (below).
2. **Finish setting up your app → View tasks**: App content forms + store settings + store listing. No file needed.
3. **Internal testing**: upload the AAB, choose *Use Google-generated key*, install from Play on your phone.
4. **Closed testing**: India, the same testers list, release from library → *Send for review*. 12+ testers opted in for 14 days in a row.
5. **Apply for production** after the 14 days.

---

## 1. Create app

| Field | Answer |
|---|---|
| App name | `Housie Tambola King` |
| Default language | English (India) – en-IN |
| App or game | **Game** |
| Free or paid | **Free** |
| Declarations | Tick both (Developer Program Policies, US export laws) |

The package name comes from the first AAB upload: `com.housietambolaking.app`.

## 2. App content (Policy → App content)

| Item | Answer |
|---|---|
| Privacy policy | `https://housie-tambola-king-admin.vercel.app/privacy.html` |
| App access | **All or some functionality is restricted** → add instructions (below) |
| Ads | **No, my app does not contain ads** |
| Content rating | Questionnaire (below) |
| Target audience | **18 and over** only. "Could your store listing unintentionally appeal to children?" → **No** |
| News app | No |
| Government app | No |
| Financial features | "My app doesn't provide any financial features" |
| Health | No health features |
| Advertising ID | **No** (no ads, no advertising SDK) |
| Data safety | Form (below) |
| Account deletion | `https://housie-tambola-king-admin.vercel.app/delete-account.html` |

### App access — instructions for reviewers
- **Name:** Review account
- **Username / phone:** *(Play Review 1 number)*
- **Password / PIN:** *(review PIN)*
- **Any other information:**
  ```
  Open the app → "Login" tab → mobile <Play Review 1 number> → PIN <review PIN>.
  A game needs 2 players. On a second device log in with <Play Review 2 number> and the same PIN.
  Player 1: Create Room → Create. Player 2: Join Room → enter the room code shown in the lobby; Player 1 accepts the request.
  Host taps Next → both pick tickets → host taps Next → sets prizes → both tap Ready → host taps Start.
  Numbers are called automatically; tap called numbers on your ticket to strike them.
  Ticket prices and prizes are casual numbers for fun only — the app has no real money, payments or wallet.
  ```

### Content rating questionnaire
- **Email:** projectblurimedia@gmail.com
- **Category:** **Game** (if asked for a type: casual / board / puzzle-style game).

| Question is about… | Answer |
|---|---|
| Violence, blood, fear | No |
| Sexual content, nudity | No |
| Bad language | No |
| Drugs, alcohol, tobacco | No |
| **Real-money gambling** (wagering real money) | **No** |
| **Simulated gambling** (games of chance without real money, e.g. bingo) | **Yes** — Housie is bingo with pretend ₹ prizes |
| Users can interact / communicate | **Yes** (room chat) |
| Shares the user's location | No |
| Users can buy digital goods / in-app purchases | No |
| Unrestricted web access | No |

Then Save → Calculate rating → Apply rating. A teen / 12+ style rating with "Simulated gambling, Users interact" is expected.

### Data safety

**Part 1**

| Question | Answer |
|---|---|
| Collects or shares required user data types? | **Yes** |
| Encrypted in transit? | **Yes** (all https) |
| Account creation methods | **Username and password** (mobile number + 4-digit PIN) |
| Delete account URL | `https://housie-tambola-king-admin.vercel.app/delete-account.html` |
| Delete some data without deleting the account? | **No** |
| Independent security review (MASA)? | No |

**Part 2 — tick these data types**

| Group | Tick |
|---|---|
| Personal info | Name, Phone number, User IDs |
| Messages | Other in-app messages (room chat) |
| App activity | App interactions (rooms, tickets, claims, wins) |
| App info and performance | Crash logs, Diagnostics |
| Device or other IDs | Device or other IDs (push-notification token) |

Leave everything else unticked (location, financial, photos, audio, contacts, files, health…).

**Part 3 — for each ticked type:** Collected **Yes**, Shared **No**, Processed ephemerally **No**.

| Data type | Required / optional | Purposes |
|---|---|---|
| Name | Required | App functionality, Account management |
| Phone number | Required | App functionality, Account management |
| User IDs | Required | App functionality, Account management |
| Other in-app messages | Optional | App functionality |
| App interactions | Required | App functionality |
| Crash logs | Required | Analytics |
| Diagnostics | Required | Analytics |
| Device or other IDs | Optional | App functionality |

Supabase (database), Expo (updates, push) and Google are service providers — not "sharing".

## 3. Store settings (Grow users → Store presence → Store settings)
- **Category:** Game → **Board**
- **Tags:** Bingo, Board, Casual, Multiplayer, Family (pick what's offered, up to 5)
- **Email:** projectblurimedia@gmail.com
- **Website / phone:** leave empty (optional)

## 4. Main store listing

**App name:** `Housie Tambola King`

**Short description** (79 / 80):
```
Play Housie (Tambola) live with family & friends. Just for fun – no real money.
```

**Full description:**
```
Housie Tambola King brings the classic Housie (Tambola) game to your phone — play live with family and friends, wherever they are.

• Create a room in seconds — private with a code, or public for anyone.
• Normal games or a Series of games back to back, with standings for every player.
• Pick 1 to 4 tickets each game. Numbers are called out loud automatically.
• Tap called numbers to strike them — complete a prize and it's claimed for you.
• Fast 5, Lines, Columns and Full Housie, with fair "check your tickets" rounds and shared wins on the same number.
• Late claim, auto hints, pause and speed control for the host.
• Room chat, colourful tickets, winner celebrations for everyone in the room.
• Caller Mode: use your phone as the number caller for a game at home.
• Available in English and Telugu, with a Telugu number caller.

Just for fun: ticket prices and prizes in the app are casual numbers to keep score between friends. The app has no real money, payments or wallet.
```

**App icon:** `housie-icon-512.png` · **Feature graphic:** `housie-feature-1024x500.png`

**Phone screenshots** (2–8; 4–6 recommended, taken on your phone): Home · Create Room · Lobby with tickets · Live game (called number + tickets) · Winner celebration · Standings.

Video, tablet, Chromebook, XR: leave empty.

## 5. Internal testing
1. Testing → **Internal testing** → **Testers** → tick your existing email list (the NearbyU testers list works — lists are shared across your apps) → Save.
2. **Releases → Create new release** → App signing: **Use Google-generated key**.
3. Upload the **.aab** → Release notes:
   ```
   <en-IN>
   First test release of Housie Tambola King.
   </en-IN>
   ```
4. Next → Save → **Start rollout to Internal testing**. Open the "Join on the web" link on your phone and install.

## 6. Closed testing (the 14-day rule)
1. Closed testing → **Manage track** → Countries: **India** → Save.
2. **Testers** → tick the same email list → Feedback email `projectblurimedia@gmail.com` → Save.
3. **Create new release** → **Add from library** → the uploaded bundle → release notes `Housie Tambola King closed test – live Housie rooms with friends.` → Next → Save.
4. **Publishing overview → Send changes for review** (Google: about 1–3 days).
5. After approval: Testers tab → copy the **join link** → send to all testers. Each opens it with the Gmail on the list → **Become a tester** → install from Play → open the app (register with their own number and a PIN).
6. 12+ testers must stay opted in for **14 days in a row**. This is a separate count from NearbyU, so testers must join this app's link too.

## 7. Production
After 14 days: **Apply for production** → answer the questions about the test (what testers did, what you fixed) → after approval, create the production release from the same bundle.

## Updates after launch
- Small fixes (screens, text, logic) go out as over-the-air updates. Play builds listen on the **production** channel, so each update is published to both `production` and `preview`.
- Native changes (permissions, icon, new native modules) need a new AAB uploaded as a new release.
