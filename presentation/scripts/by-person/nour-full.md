# Nour — speaking script (full)

You present **2 section(s)**, total ≈ **~3.5 min** of speaking time, in this order during the talk:

| Order | Your section | Slides | Time |
|---|---|---|---|
| 01 | Introduction | 3–5 | 1.5 min |
| 06 | Tournaments | 24–26 | 2 min |

Other people speak between your sections — wait for the hand-over, then take the clicker. The `full/` wording is to rehearse, not to read aloud; keep the `points/` version in your hand.



---
---

# 01 · Introduction — Nour (slides 3–5, about 1.5 minutes)

> Simple English. Short sentences. Speak slowly. It is OK to look at the slide.

---

## Slide 3 — Section divider

Hello everyone. My name is Nour. I am one of the four members of the team.
I will start with the introduction of our project.

---

## Slide 4 — Project Overview

Our project is called **Ft_transcendence**. It is the capstone project of 42 Abu Dhabi.

It is a website for games.

The main game is **Pong**. But it is not the old flat Pong — it is **Pong in 3D**. You can play with a friend on one keyboard, or you can play against the computer.

We also have a **second game**: **Tic-Tac-Toe**. Two players play on one computer. Every game is saved in the player's history.

Around the games, the website has everything a real platform needs:
- You can create an account, or you can log in with your **42 account**.
- You can turn on **two-factor authentication**. Then you get a code by e-mail when you log in.
- Every player has a **profile** with statistics and a list of all the matches.
- You can add **friends**, and you can see if a friend is online.
- You can create **tournaments**.
- And you can control your data: download it, make it anonymous, or delete your account. This is for **GDPR**.

Now the technology. The backend is **Django**. This is a Python framework. The database is **PostgreSQL**. The frontend uses **Bootstrap** and JavaScript. The 3D game uses **Three.js**.

Everything runs in **Docker**, and the site uses **HTTPS**.

One more thing. The site is a **Single Page Application**. This means: the server sends the first page, and after that, JavaScript changes the page. The browser does not reload.

---

## Slide 5 — Project Objectives

At the beginning, we set six goals.

**One** — a working game platform. Pong in 3D, and Tic-Tac-Toe.

**Two** — secure login. E-mail and password, login with 42, two-factor authentication, and JWT tokens.

**Three** — user profiles. A display name, an avatar, friends, statistics, and match history.

**Four** — tournament mode. Three to eight players. Everyone plays against everyone. At the end, one winner.

**Five** — security and GDPR. Protection against attacks like SQL injection and XSS. And users can export, anonymize, or delete their data.

**Six** — team work. We used Agile, Git branches, and code review.

That is the introduction. Now **Ali** will explain how we organised the work.

---

## If they ask you a question

- *"What is a Single Page Application?"* — "The server sends one HTML page. Then JavaScript changes the content. The page does not reload."
- *"Why Django?"* — "The subject asks for Django for the backend module. It is also a strong framework with security built in."
- *"Where does the 3D come from?"* — "Three.js. It uses WebGL in the browser. Salim will explain it later."
- If you do not know: "Good question. My teammate will answer this in a later section." Then look at Salim or Nasser.


---
---

# 06 · Tournaments — Nour (slides 24–26, about 2 minutes)

> Simple English. Short sentences. You built this part — you know it best.

---

## Slide 24 — Section divider

Thank you, Salim. I am Nour again. I made the tournament system. I will show you how it works.

---

## Slide 25 — Tournament screenshots

On the left, you create a tournament. First, you must be logged in. You choose the number of players: **from three to eight**.

Then you type a **nickname** for each player. Your own display name is already filled in for the first player. Every nickname must be different. An empty name is not allowed. A very long name is not allowed.

On the right, this is the tournament page.

At the top, you see the players and their score.

Below, you see the list of matches. In a tournament, every player plays against every other player **one time**. We call this **round-robin**.

Every match has a button: **"Start Match"**. This button opens the 3D Pong game. The two nicknames are shown on the screen.

The page also shows the **next match**, so the players know who plays now.

When all matches are finished, the page shows the **winner**.

---

## Slide 26 — Tournament flow

Here is the full flow in six steps.

**Step one — Create.** A logged-in user gives a name and chooses the number of players.

**Step two — Register.** Every player writes a nickname.

**Step three — Schedule.** The server creates all the matches. Every pair plays one time.

**Step four — Play.** "Start Match" opens Pong. Two players, one keyboard. The nicknames are on the screen.

**Step five — Score.** When the game ends, the score goes to the server. The table updates. The next match is announced. This is the **matchmaking** of our project: the server decides who plays next, and it tells the players.

**Step six — Winner.** If two players have the same score at the end, the system creates extra matches. We call them **tiebreaker** matches. It continues until there is one winner.

Three more things.

The nicknames belong to **one tournament**. So the same person can play in many tournaments, with a different nickname each time. This is the "users across tournaments" part of the user-management module.

The tournament is **safe**. You need to be logged in. Every request has the CSRF token. Nicknames are shown as text, so nobody can put HTML or scripts in them. A score must be a number, zero or more. And a Pong match cannot end with the same score for both players.

And if you **refresh** the page, you come back to the same tournament. The tournament ID is saved in the browser.

That is the tournament system. Now **Ali** will show the player profile and the statistics.

---

## If they ask you a question

- *"How do you create the matches?"* — "It is a round-robin. For every pair of players, the server creates one match. With 4 players, this is 6 matches."
- *"What happens with a tie at the end?"* — "The system creates tiebreaker matches between the players with the same score. It repeats until one player wins."
- *"Why nicknames and not accounts?"* — "A tournament is played on one computer. The players are often not registered. So we use nicknames. The subject asks for a display name for tournaments — this is our alias."
- *"Are tournament games in the player statistics?"* — "No. The players are nicknames, not accounts. So we keep the tournament scores in the tournament table."
- If you do not know: "Good question. Salim or Nasser can add more details." Then look at them.
