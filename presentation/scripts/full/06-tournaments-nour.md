# 06 · Tournaments — Nour (slides 26–28, about 2 minutes)

> Simple English. Short sentences. You built this part — you know it best.

---

## Slide 26 — Section divider

Thank you, Salim. I am Nour again. I made the tournament system. I will show you how it works.

---

## Slide 27 — Tournament screenshots

On the left, you create a tournament. First, you must be logged in. You choose the number of players: **from three to eight**.

Then you type a **nickname** for each player. Every nickname must be different. An empty name is not allowed. A very long name is not allowed.

On the right, this is the tournament page.

At the top, you see the players and their score.

Below, you see the list of matches. In a tournament, every player plays against every other player **one time**. We call this **round-robin**.

Every match has a button: **"Start Match"**. This button opens the 3D Pong game. The two nicknames are shown on the screen.

The page also shows the **next match**, so the players know who plays now.

When all matches are finished, the page shows the **winner**.

---

## Slide 28 — Tournament flow

Here is the full flow in six steps.

**Step one — Create.** A logged-in user gives a name and chooses the number of players.

**Step two — Register.** Every player writes a nickname.

**Step three — Schedule.** The server creates all the matches. Every pair plays one time.

**Step four — Play.** "Start Match" opens Pong. Two players, one keyboard. The nicknames are on the screen.

**Step five — Score.** When the game ends, the score goes to the server. The table updates. The next match is announced.

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
