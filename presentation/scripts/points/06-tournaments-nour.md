# 06 · Tournaments — Nour (slides 24–26, about 2 minutes)

## Slide 24 — Section divider
- "I made the tournament system. I will show it now."

## Slide 25 — Tournament screenshots
- Left picture: create a tournament. Choose the number of players: **3 to 8**.
- Type a **nickname** for each player. Your own display name is filled in for player 1. Nicknames must be different. Empty names are not allowed.
- Right picture: the tournament page.
  - List of players with their score.
  - List of matches. Every pair plays **one time** (round-robin).
  - Button **"Start Match"** opens the 3D Pong game.
  - "Next match" text tells who plays next.
  - At the end: the **winner** is shown.

## Slide 26 — Tournament flow (6 steps)
1. **Create** — a logged-in user gives a name and the number of players.
2. **Register** — every player writes a nickname.
3. **Schedule** — the server makes all the matches.
4. **Play** — "Start Match" opens Pong; two players, one keyboard; nicknames on the screen.
5. **Score** — the result goes to the server; the table updates; "next match" is announced. This is the **matchmaking** of our project: the server decides who plays next.
6. **Winner** — if two players have the same score, the system creates **tiebreaker** matches until one winner.

- Three extra cards:
  - Nicknames are only for one tournament → same person can play many tournaments.
  - Safe: login needed, CSRF token, nicknames shown as text (no HTML), score must be a number ≥ 0, no tie in a match.
  - Refresh the page → you stay in the same tournament.
- Finish: "Now Ali will show the player profile."
