# 07 · Profiles, Statistics & Friends — Ali (slides 29–31, about 2.5 minutes)

## Slide 29 — Section divider
- "I worked on the user data and the statistics — this is what the user sees."

## Slide 30 — Player profile and stats dashboard (screenshots)
- Every finished game is saved: Pong vs player, Pong vs AI, Tic-Tac-Toe local or online.
- Profile page = the **user dashboard**:
  - **Games played**, **win rate** (pie chart), **best score** (the win with the biggest margin).
  - **Recent matches**: game type badge (PONG / TICTACTOE), opponent, score, result, date.
  - **Friends** panel + "Find Users" button.
- Settings page: display name, e-mail, avatar upload, 2FA switch, Download my data, Anonymize, Delete account.

## Slide 31 — Friends, match history and user data
- **User model**: e-mail is the login, unique username, optional display name, avatar (default picture, max 2 MB, image type checked), 2FA flag, 42 link.
- **Friends**: add / remove from the "Find Users" list (only active users shown); friends panel shows names and avatars.
- **Match history**: one row per game; last 5 on the profile, last 10 via API, everything in the JSON export.
- **Statistics**: win rate = wins / games; SVG pie chart drawn by hand (no chart library).
- Tournament games are kept separate — tournament players are nicknames, not accounts.

## Be ready for
- Duplicate usernames / e-mails? Both unique (case-insensitive); duplicates give a clear error. Display name is not unique on purpose (only a label).
- Where do the numbers come from? `GET /api/auth/profile/` — computed from MatchHistory on the server.
- Online status of friends? Not implemented — we show name and avatar; known limitation.
- Hand over to Salim: GDPR and accessibility.
