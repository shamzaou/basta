# Ali — speaking script (points)

You present **3 section(s)**, total ≈ **6.5 min** of speaking time. They come in this order during the talk:

| Order | Your section | Slides | Time |
|---|---|---|---|
| 02 | Software Development Life Cycle | 7–11 | 2.5 min |
| 07 | Profiles, Statistics & Friends | 29–31 | 2.5 min |
| 10 | Team & Conclusion | 40–43 | 1.5 min |

Bullet points only — what to cover on each of your slides. Print this and hold it. Other people speak between your sections.



---
---

# 02 · Software Development Life Cycle — Ali (slides 7–11, about 2.5 minutes)

## Slide 7 — Section divider
- Introduce yourself; you cover *how* the team worked.

## Slide 8 — Chosen SDLC model: Agile (iterative & incremental)
- We chose **Agile** — short cycles, one working feature per cycle.
- Why: 4 people, learning project, requirements changed while we learned.
- Four ideas:
  1. **Iterative** — features one by one: authentication, Pong, tournaments, profiles.
  2. **Incremental** — after every merge the app still runs and can be tested.
  3. **Flexibility** — we changed plans when we understood more.
  4. **Collaboration** — daily check-ins, pair work on hard parts, review of every merge.
- Evidence: 86 commits (Feb–Apr 2025), 15 pull requests from feature branches, plus the 2026 pre-evaluation sweeps.

## Slide 9 — Phases and iterations
- No formal sprints, but every feature went through the same 6 phases:
  1. Planning → 2. Design (models, endpoints, wireframes) → 3. Implementation (own branch)
  → 4. Developer testing → 5. Integration & review (pull request, merge to master) → 6. System testing.

## Slide 10 — Team collaboration and version control
- **Git + GitHub** — every change tracked.
- **Feature branches** — OAuth, tournaments, profile-page… isolated from master.
- **Code reviews** — every branch reviewed in a pull request (15 PRs).
- **Communication** — WhatsApp group + meetings on campus.

## Slide 11 — Gantt chart
- Phases: planning & setup → core frontend → core backend → features → testing & integration → deployment.
- Shows durations, dependencies and milestones.
- Hand over: "Salim will now present the modules we selected and the design."


---
---

# 07 · Profiles, Statistics & Friends — Ali (slides 29–31, about 2.5 minutes)

## Slide 29 — Section divider
- "I worked on the user data and the statistics — this is what the user sees."

## Slide 30 — Player profile and stats dashboard (screenshots)
- Every finished game is saved: Pong vs player, Pong vs AI, Tic-Tac-Toe.
- Profile page = the **user dashboard**:
  - **Games played**, **win rate** (pie chart), **best score** (the win with the biggest margin).
  - **Recent matches**: game type badge (PONG / TICTACTOE), opponent, score, result, date.
  - **Friends** panel (green dot = online, grey = offline) + "Find Users" button.
- Settings page: display name (unique), e-mail, avatar upload, 2FA switch (password accounts only), Download my data, Anonymize, Delete account.

## Slide 31 — Friends, match history and user data
- **User model**: e-mail is the login, unique username, optional display name (unique, case-insensitive), avatar (default picture, max 2 MB, image type checked), 2FA flag, 42 link.
- **Friends**: add / remove from the "Find Users" list (only active users shown); friends panel shows names, avatars and **online status** — the browser sends a heartbeat every minute, online = seen in the last 2 minutes, logout = offline at once.
- **Match history**: one row per game; last 5 on the profile, last 10 via API, everything in the JSON export.
- **Statistics**: win rate = wins / games; SVG pie chart drawn by hand (no chart library).
- Tournament games are kept separate — tournament players are nicknames, not accounts.

## Be ready for
- Duplicate usernames / e-mails? Both unique (case-insensitive); duplicates give a clear error. Display name is unique too (case-insensitive) — "Display name already taken".
- Where do the numbers come from? `GET /api/auth/profile/` — computed from MatchHistory on the server.
- Online status of friends? Yes — heartbeat `POST /api/auth/heartbeat/` every minute; online = seen within 2 minutes; logout sets offline. Status only — there is no online play.
- Hand over to Salim: GDPR and accessibility.


---
---

# 10 · Team & Conclusion — Ali (slides 40–43, about 1.5 minutes)

## Slide 40 — Section divider

## Slide 41 — Contribution of each member
- Everyone owned modules end-to-end (backend + frontend + tests) and reviewed the others' pull requests.
- **Salim** — Graphics (3D Pong, Three.js, physics); Gameplay (Tic-Tac-Toe + match history + tournament matchmaking); Cybersecurity & GDPR (anonymize, export, delete, retention, privacy policy).
- **Nasser** — Authentication (register/login/sessions); Remote authentication (42 OAuth); 2FA + JWT (e-mail codes, SimpleJWT, auto-refresh).
- **Ali (me)** — User history & statistics (match history, dashboard, win-rate chart); user information (username, avatar, display name, e-mail, friends); Database module (PostgreSQL, models, migrations).
- **Nour** — Mandatory part (tournament system, round-robin, tiebreakers); Front end (SPA + Bootstrap module); Backend framework module (Django project, REST API).

## Slide 42 — Conclusion
- All selected modules satisfied: **7 Major + 6 Minor = 10** (7 needed).
- What we learned: full-stack with Django + JS SPA + Three.js + PostgreSQL in Docker; game logic; deployment; security.
- Agile + feature branches kept 4 people productive.
- Solid base for the future: remote play, chat, richer AI.
- Pre-evaluation audit: green test suite, root-caused fixes.

## Slide 43 — Thank you
- "Thank you. We are happy to answer questions and show the demo."
