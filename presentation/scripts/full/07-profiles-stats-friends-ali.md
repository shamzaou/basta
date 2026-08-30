# 07 · Profiles, Statistics & Friends — Ali (slides 29–31, about 2.5 minutes)

> Plain English. This is your own work — user data, history and statistics.

---

## Slide 29 — Section divider

Thank you, Nour. I'm Ali again. I worked on the user data — the profile information, the match history and the statistics. This section covers the user-management module and the stats-dashboard module, seen from the user's side.

---

## Slide 30 — Player profile and stats dashboard

Every finished game is saved: Pong against a player, Pong against the AI, and Tic-Tac-Toe. Each game creates one row in the **MatchHistory** table.

The profile page is the **user dashboard**. It shows three numbers.

**Games played** — the number of matches.

**Win rate** — wins divided by games, as a percentage. It is also drawn as a pie chart: green for wins, red for losses.

**Best score** — the win with the biggest difference, for example 3–0 is better than 3–2.

Below, the **recent matches**: a badge with the game type — PONG or TICTACTOE — the opponent, the score, the result, and the date.

On the right, the **friends** panel with a "Find Users" button. Every friend has a small dot: green means online, grey means offline.

The second screenshot is the **Settings** page. Here the user can change the display name, the e-mail and the avatar, switch two-factor authentication on or off — only for password accounts, a 42 account has no switch — and use the GDPR tools: Download my data, Anonymize, and Delete account. Salim will explain the GDPR tools.

---

## Slide 31 — Friends, match history and user data

Some details.

**User information.** We use a custom Django user model. The **e-mail** is the login. The **username** is unique. The **display name** is optional — it is a label shown to other users, and it must be unique: two users cannot have the same display name, even with different capital letters. The **avatar** is uploaded from the browser; if there is no avatar, we show a default picture. We check the file type — PNG, JPEG, GIF or WebP — and the size, maximum two megabytes. The model also has the 2FA flag and the 42 link.

**Friends.** The "Find Users" page lists every active user with an Add or Remove button. Only active accounts are shown, so anonymized accounts disappear from the list. The friends panel on the profile shows the friends' names, avatars and their **online status**. The browser sends a small "heartbeat" request every minute. If a friend was seen in the last two minutes, the dot is green. When a user logs out, the dot becomes grey at once. This is only a status — we do not have online play.

**Match history.** One row per game. The profile shows the last five. The API gives the last ten. The JSON export gives the full list.

**Statistics.** The numbers are computed on the server in the profile endpoint. The pie chart is an SVG that we draw by hand — no chart library.

One design decision: **tournament games are kept separate**. Tournament players are nicknames, not accounts, so we cannot add a tournament match to a user's personal record. The tournament has its own score table.

Now Salim will present GDPR and accessibility.

---

## If they ask you a question

- *"How do you handle duplicate usernames or e-mails?"* — "Both are unique in the database, and we compare them case-insensitively. A duplicate gives a clear error message at registration. The display name is also unique, compared case-insensitively — the server answers 'Display name already taken'."
- *"How does the online status work?"* — "The browser calls `/api/auth/heartbeat/` every minute while you are logged in. The server stores the time. A friend is online if the time is less than two minutes ago. Logout clears it. It is only a status, for example in two browsers on one computer — the games are not played online."
- *"How is the avatar stored?"* — "The browser sends it as base64 in a JSON PUT. The server decodes it, checks it with Pillow, and saves it as a file. An API endpoint serves it, with the default picture as fallback."
- *"Where does the win rate come from?"* — "`GET /api/auth/profile/` counts the MatchHistory rows on the server: wins divided by total, excluding tournament games."
- *"Can a user see another user's stats?"* — "Only their own profile in this version. A public profile page is a possible improvement."
