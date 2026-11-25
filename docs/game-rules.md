# Game rules (as implemented)

## Rooms
- **Create** or **Join** (6-letter code). **Public** rooms are listed for anyone; **Private** need the code.
- **Joining needs the host to accept.** The player waits on a "waiting for host" screen; the host sees requests in the Players tab. Accepted during a running game → watches it and plays from the next game.
- **Normal**: one game; the host can tap *Play Again* for another round with the same people.
- **Series**: games back to back; the next lobby opens automatically. Number of games is off by default (no limit — host taps **End series**); when switched on, 2–50 games.
- Host sets max players (2–100). Numbers only start when **at least 2 players** (host + 1) have tickets.
- If the host leaves, the room passes to the next member; the host can end the room any time.

## Lobby steps (every game)
1. **Players** — people join; the host taps **Next: take tickets** once at least 2 players are in.
2. **Tickets** — everyone picks their tickets; the host's **Next: set prizes & play** unlocks when every player has tickets.
3. **Prizes & ready** — the host sets this game's prizes and amounts; every player with tickets taps **I'm ready for this game**; once everyone is ready the host taps **Start the game** (the host can still edit the prizes until then). Anyone not ready is listed for the host, who can remove them.
A series' next game starts again at step 1.

## Tickets & pot (casual ₹ — no real money)
- Before **every** game each player chooses **1–4 tickets**, confirmed once — it can't be changed for that game (no re-rolling tickets).
- Pot = tickets taken × ticket price.
- Prizes are **not** chosen at room creation. Before every game the host opens the prize setup (step 3): every Fast 3/5/7, line and column has its own switch (Full Housie always on) and an amount; amounts must add up exactly to the pot. Auto split suggests amounts.

## Ticket
3 rows × 9 columns, 15 numbers: **5 per row and 5 per column group** (columns 1–3, 4–6, 7–9). Column 1 = 1–9, column 2 = 10–19 … column 9 = 80–90.

## Prizes (host turns each on/off; Full Housie always on)
| Prize | Pattern |
|---|---|
| Fast 3 / Fast 5 / Fast 7 | any 3 / 5 / 7 numbers struck |
| First / Second / Third Line | all numbers of that row |
| Left / Center / Right Column | all numbers in columns 1–3 / 4–6 / 7–9 |
| Full Housie | all 15 numbers |

## Room options
- **Claim rule** — two options:
  - **Normal** (default): when someone claims, the number header on every phone is replaced (with a sound) by "X claimed Fast 5 — check your tickets" and a countdown (the host's check time, − / + in 5 s steps up to 60 s; 0 = **until everyone is ready**, the default for new rooms). Players can strike numbers they missed meanwhile. A player whose ticket had the prize complete on an earlier number (claimed late) still shares it during the check; **I have it too!** strikes the winning numbers and claims and an **I have it too!** button. Anyone whose ticket completed the same prize on the same number joins the win (split equally). Then the winner is announced (7 s pause).
    - **Late claim** (Normal only; host sets 0–90 numbers with − / +, new rooms default to 2 (0 = off), `rooms.late_claim_calls`). With K > 0, during the check a player whose ticket completed the prize on an **earlier** number than the current winner's, and who claims within K numbers of completing it, **takes the prize** (the later finisher loses it; others who finished on that same earlier number still share). Finished earlier but more than K numbers before the claim → too late. Example, K = 1: A completes Fast 5 on the 20th number and doesn't claim; on the 21st B completes and claims; A claims during the check → A wins alone. Works for every prize. With 0 the old behaviour stays: a late earlier finisher shares.
  - During a check every player taps **I have it too!** (claims only what their own strikes complete — nothing is struck for them; if their ticket has it but numbers aren't struck yet they're asked to strike them first; other prizes completed on the same or an earlier number are claimed too) or **Checked**; the check ends early once everyone has, and the host sees who hasn't (can remove them or continue).
  - **Fastest finger**: the first claim wins it alone — no sharing.
  - **Auto**: the app strikes every called number itself (no hints, no tapping); the server awards each prize to everyone who completed it on the same number (shared).
- **Last check**: after number 90 the game doesn't end at once — everyone gets a final check to claim (≥15 s, or until all ready).
  (Fair play was removed on 2026-11-18; old fair rooms became Normal.)
- **Room settings**: everyone sees them in the lobby; the host can edit them (name, rule, check time, price, max players, public/private, auto hint, chat) until the game starts — the ticket price only until tickets are taken.
- **Auto hint** (off by default; not used with Auto) has two kinds: *Until the next number* (only the newest number glows) or *Until struck* (every called number glows until struck). Off = no rings at all. (in the player's hint colour); players still tap to strike. Nothing is marked automatically.
- **Room chat** (host's choice, on by default): floating chat button; each player can mute anyone for themselves. Voice chat is planned (needs a voice provider + a new app build).
- Default calling speed 3 s (set in game, 1–10 s). During a game the host has an on-screen **pause/play** button and can change the speed in settings; every phone gets a message when the speed changes or the game is paused/resumed. Voice, sounds and ticket style (ready-made looks, ticket / strike / hint colours) are set only in Profile.
- Numbers pause for 8 s after a prize is won (7 s after a checked claim) so everyone sees the winner announcement.
- The host can remove a player from the room.

## Calling, striking, winning
- Numbers 1–90 in a secure random order fixed on the server at start; every phone speaks each number.
- Players **tap called numbers to strike them**; tapping a number not called yet just wiggles (no message).
- The moment a player's strikes complete a prize, the app claims it; the server verifies against the numbers it called.
- **First claim wins.** Anyone else who completed the same prize on the **same called number** and claims before the next number is called **shares it equally**.
- Every phone shows the winner announcement: name, prize, the winning numbers, amount (or "each" when split). Prizes won on the same number (e.g. Third Line + Full Housie) appear together on one card.
- Each kind of prize has its own sound (fast / line / column / Full Housie); when several are won together one sound plays — Full Housie's if it is one of them.
- Game ends when Full Housie is settled or all 90 numbers are called; prizes nobody claimed are *unclaimed*.

## Phone settings
Vibration is off by default (Profile or the in-game gear turns it on). The in-game gear also has prize sounds and strike sound; the host also sets the calling speed there.

## Standings
Players are their phone number: leaving and rejoining a room continues their totals. The Standings tab also shows a game-by-game table (each player's +/− per game, "–" if they didn't play) with totals.

Saved per room: games played, tickets (₹ spent), wins, ₹ won, net, and every win (game no., prize, numbers).

## Party games (points only, no coins or money)
**Find Seeta** (3–15 players): each round roles are dealt at random from Ram, Seeta, Lakshmana 800, Bharatha 700, Shatrughna 600, Anjaneya 500, Sugreeva 450, Vibhishana 400, Jambavantha 350, Angada 300, Nala 250, Neela 200, Dasaratha 150, Janaka 100, Guha 50 (first n roles). Ram is revealed and guesses Seeta within 60 s (else a random guess). Right → Ram 1000, Seeta 0; wrong → Seeta 1000, Ram 0. Others always get their role's points.

**Show** (3–10 players): n colours × 4 cards, shuffled, 4 each (nobody starts with four of a kind). Each turn (20 s, else a random card) everyone picks one card; when all have picked, every picked card goes to the next seat at once (into the slot the receiver gave away). Four of one colour → SHOW; then everyone has 8 s to tap SHOW. Points by tap order: (n−1−place)×100, so the last one gets 0, as does anyone who never tapped.

Both: host picks 3–20 rounds; 9 s reveal between rounds; join by code / link without approval; host starts with 3+; fewer than 3 players left ends the game; host can play again.

**Show categories**: the host picks Colours (default), Fruits, Animals, Flowers, Sweets, Vehicles, or their own category (3–10 items with an emoji each, saved on their phone); card n of the deal shows item n.

**Snakes & Ladders** (2–6): classic board — ladders 1→38, 4→14, 9→31, 21→42, 28→84, 36→44, 51→67, 71→91, 80→100; snakes 16→6, 47→26, 49→11, 56→53, 62→19, 64→60, 87→24, 93→73, 95→75, 98→78. A 1–6 die; over 100 = stay; a 6 rolls again (max 3 in a row); first to 100 wins. 20 s per turn, then the server rolls.

**Ashta Chamma** (2–4): 5×5 board, 4 pawns each, 4 tamarind seeds: n up = n, none up = 8. A pawn comes in on its start square only with 4 (Chamma) or 8 (Ashta). Pawns go round the outer ring anticlockwise; only after its player has cut an opponent may a pawn enter the inner ring (clockwise) and the centre — until then it keeps circling. Safe (✕): the four start squares and the centre. Landing on an opponent elsewhere sends it home. 4, 8 or a cut throws again. All 4 pawns in the centre wins. 20 s to throw / move, then the server does it (furthest pawn that can move).

**Party coins**: the host may set an entry (0–10,000 play coins). Everyone pays it when the game starts; the winner takes the pot (winners / a team split it equally; card games: top score, ties split). The host ending a game mid-play refunds everyone; a player who leaves forfeits their entry.

**3 chances (board games)**: every time the server has to play a turn for someone (20 s passed) they lose a chance; on the 3rd they are out. The last player (or team) left wins.

**Ashta Chamma options** (at create): pawns start outside (enter on 4 / 8) or all on their start square; inner safe squares = the 4 inner corners or the 4 inner squares straight in from each start (start squares and the centre are always safe); teams (exactly 4 players, opposite sides together, no cutting a partner, the team wins when both are home); cut needed before the inner ring (on by default).
