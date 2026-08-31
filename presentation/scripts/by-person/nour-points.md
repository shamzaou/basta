# Nour — speaking script (points)

You present **2 section(s)**, total ≈ **~3.5 min** of speaking time, in this order during the talk:

| Order | Your section | Slides | Time |
|---|---|---|---|
| 01 | Introduction | 3–5 | 1.5 min |
| 06 | Tournaments | 24–26 | 2 min |

Bullet points only — what to cover on each of your slides. Print this and hold it. Other people speak between your sections.



---
---

# 01 · Introduction — Nour (slides 3–5, about 1.5 minutes)

## Slide 3 — Section divider
- Say hello. Say your name. Say: "I present the introduction."

## Slide 4 — Project Overview
- Ft_transcendence = our capstone project at 42 Abu Dhabi.
- It is a website for games.
- Main game: **Pong in 3D**.
- Second game: **Tic-Tac-Toe** — two players on one computer. Every game is saved in the player's history.
- Also: accounts, login with 42, 2FA by e-mail, profile with statistics, friends (with online status), tournaments, GDPR tools.
- Technology: **Django** (Python) backend, **PostgreSQL** database, **Bootstrap** + JavaScript frontend, **Three.js** for 3D.
- Runs in **Docker** with HTTPS.
- The site is a Single Page Application: the server sends the first page, then JavaScript changes the views.

## Slide 5 — Project Objectives
- Six goals from the start:
  1. A working game platform — Pong + Tic-Tac-Toe.
  2. Secure login — e-mail/password, 42 login, 2FA, JWT.
  3. User profiles — name, avatar, friends, statistics, match history.
  4. Tournament mode — 3 to 8 players, everyone plays everyone.
  5. Security and GDPR — protection from attacks; export, anonymize, delete data.
  6. Team work — Agile, Git branches, code review.
- Finish: "Now Ali will explain how we organised the work."


---
---

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
