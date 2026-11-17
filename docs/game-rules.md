# Game rules (as implemented)

## Rooms
- **Create** or **Join** (6-letter code). **Public** rooms are listed for anyone; **Private** need the code.
- **Normal**: one game; the host can tap *Play Again* for another round with the same people.
- **Series**: N games (2–50) back to back. When a game ends, the next game's lobby opens automatically for everyone.
- Host sets max players (2–100). Numbers only start when **at least 2 players** (host + 1) have tickets.
- If the host leaves, the room passes to the next member; the host can end the room any time.

## Tickets & pot (casual ₹ — no real money)
- Before **every** game each player chooses **1–4 tickets** (changeable until the start).
- Pot = tickets taken × ticket price.
- Prize amounts: the host's template amounts at creation set the proportions. In each lobby the amounts are auto-split to equal the pot (paise rounded down, remainder to Full Housie). The host can edit them; they must add up exactly to the pot.

## Ticket
3 rows × 9 columns, 15 numbers, 5 per row. Column 1 = 1–9, column 2 = 10–19 … column 9 = 80–90.

## Prizes (host turns each on/off; Full Housie always on)
| Prize | Pattern |
|---|---|
| Fast 3 / Fast 5 / Fast 7 | any 3 / 5 / 7 numbers struck |
| First / Second / Third Line | all numbers of that row |
| Left / Center / Right Column | all numbers in columns 1–3 / 4–6 / 7–9 |
| Full Housie | all 15 numbers |

## Calling, striking, winning
- Numbers 1–90 in a secure random order fixed on the server at start; every phone speaks each number.
- Players **tap called numbers to strike them** (uncalled numbers can't be struck).
- The moment a player's strikes complete a prize, the app claims it; the server verifies against the numbers it called.
- **First claim wins.** Anyone else who completed the same prize on the **same called number** and claims before the next number is called **shares it equally**.
- Every phone shows the winner announcement: name, prize, the winning numbers, amount (or "each" when split).
- Game ends when Full Housie is settled or all 90 numbers are called; prizes nobody claimed are *unclaimed*.

## Standings
Saved per room: games played, tickets (₹ spent), wins, ₹ won, net, and every win (game no., prize, numbers).
