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
3. **Prizes & play** — the host sets this game's prizes and amounts, then the numbers start.
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
  - **Normal** (default): when someone claims, every phone shows "X claimed Fast 5 — check your tickets" with a 10 s countdown and an **I have it too!** button. Anyone whose ticket completed the same prize on the same number joins the win (split equally). Then the winner is announced (7 s pause).
  - **Fastest finger**: the first claim wins it alone — no sharing.
  (Fair play was removed on 2026-11-18; old fair rooms became Normal.)
- **Auto hint**: called numbers glow on tickets (in the player's hint colour); players still tap to strike. Nothing is marked automatically.
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

## Standings
Saved per room: games played, tickets (₹ spent), wins, ₹ won, net, and every win (game no., prize, numbers).
