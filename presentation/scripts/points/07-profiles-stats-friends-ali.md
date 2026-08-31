# 07 · Profiles, Statistics & Friends — Ali (slides 27–29, about 2.5 minutes)

## Slide 27 — Section divider
- "I worked on the user data and the statistics — this is what the user sees."

## Slide 28 — Player profile and stats dashboard (screenshots)
- Every finished game is saved: Pong vs player, Pong vs AI, Tic-Tac-Toe.
- Profile page = the **user dashboard**:
  - **Games played**, **win rate** (pie chart), **best score** (the win with the biggest margin).
  - **Recent matches**: game type badge (PONG / TICTACTOE), opponent, score, result, date.
  - **Friends** panel (green dot = online, grey = offline) + "Find Users" button.
- Settings page: display name (unique), e-mail, avatar upload, 2FA switch (password accounts only), Download my data, Anonymize, Delete account.

## Slide 29 — Friends, match history and user data
- **User model**: e-mail is the login, unique username, optional display name (unique, case-insensitive), avatar (default picture, max 2 MB, image type checked), 2FA flag, 42 link.
- **Friends**: add / remove from the "Find Users" list (only active users shown); friends panel shows names, avatars and **online status** — the browser sends a heartbeat every minute, online = seen in the last 2 minutes, logout = offline at once.
- **Match history**: one row per game; last 5 on the profile, last 10 via API, everything in the JSON export.
- **Statistics**: win rate = wins / games; SVG pie chart drawn by hand (no chart library).
- Tournament games are kept separate — tournament players are nicknames, not accounts.

## Be ready for
- Duplicate usernames / e-mails? Both unique (case-insensitive); duplicates give a clear error. Display name is unique too (case-insensitive) — "Display name already taken".
- Where do the numbers come from? `GET /api/auth/profile/` — computed from MatchHistory on the server.
- Online status of friends? Yes — heartbeat `POST /api/auth/heartbeat/` every minute; online = seen within 2 minutes; logout sets offline. Status only — there is no online play.
- Hand over to Nasser: GDPR and accessibility.
