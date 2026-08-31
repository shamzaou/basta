# Ali — speaking script (points)

You present **3 section(s)**, total ≈ **~6.5 min** of speaking time, in this order during the talk:

| Order | Your section | Slides | Time |
|---|---|---|---|
| 02 | Software Development Life Cycle | 6–10 | 2.5 min |
| 07 | Profiles, Statistics & Friends | 27–29 | 2.5 min |
| 09 | Team & Conclusion | 33–36 | 1.5 min |

Bullet points only — what to cover on each of your slides. Print this and hold it. Other people speak between your sections.



---
---

# 02 · Software Development Life Cycle — Ali (slides 6–10, about 2.5 minutes)

## Slide 6 — Section divider
- Introduce yourself; you cover *how* the team worked.

## Slide 7 — Chosen SDLC model: Agile (iterative & incremental)
- We chose **Agile** — short cycles, one working feature per cycle.
- Why: 4 people, learning project, requirements changed while we learned.
- Four ideas:
  1. **Iterative** — features one by one: authentication, Pong, tournaments, profiles.
  2. **Incremental** — after every merge the app still runs and can be tested.
  3. **Flexibility** — we changed plans when we understood more.
  4. **Collaboration** — daily check-ins, pair work on hard parts, review of every merge.
- Evidence: 86 commits (Feb–Apr 2025), 15 pull requests from feature branches, plus the 2026 pre-evaluation sweeps.

## Slide 8 — Phases and iterations
- No formal sprints, but every feature went through the same 6 phases:
  1. Planning → 2. Design (models, endpoints, wireframes) → 3. Implementation (own branch)
  → 4. Developer testing → 5. Integration & review (pull request, merge to master) → 6. System testing.

## Slide 8 — Challenges and lessons learned
- **We aimed for microservices** — the DevOps module — but the containers could not communicate / coordinate well, and wiring them together ate our time.
- **We chose a modular monolith instead** — one Django backend, three clean apps (userapp, gameapp, tournaments): same separation of concerns, and it actually runs. A working monolith beats a half-built microservices setup.
- **We lost some work on GitHub** — early on we edited the same files without branches, so merges overwrote each other.
- **Lesson learned** — one branch per feature, pull before you push, merge only through a reviewed pull request. After that we never lost work again.

## Slide 10 — Gantt chart
- Phases: planning & setup → core frontend → core backend → features → testing & integration → deployment.
- Shows durations, dependencies and milestones.
- Hand over: "Salim will now present the modules we selected and the design."


---
---

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


---
---

# 09 · Team & Conclusion — Ali (slides 33–36, about 1.5 minutes)

## Slide 33 — Section divider

## Slide 34 — Contribution of each member
- Everyone owned modules end-to-end (backend + frontend + tests) and reviewed the others' pull requests.
- **Salim** — Graphics (3D Pong, Three.js, physics); Gameplay (Tic-Tac-Toe + match history + tournament matchmaking); Cybersecurity & GDPR (anonymize, export, delete, retention, privacy policy).
- **Nasser** — Authentication (register/login/sessions); Remote authentication (42 OAuth); 2FA + JWT (e-mail codes, SimpleJWT, auto-refresh).
- **Ali (me)** — User history & statistics (match history, dashboard, win-rate chart); user information (username, avatar, display name, e-mail, friends); Database module (PostgreSQL, models, migrations).
- **Nour** — Mandatory part (tournament system, round-robin, tiebreakers); Front end (SPA + Bootstrap module); Backend framework module (Django project, REST API).

## Slide 35 — Conclusion
- All selected modules satisfied: **7 Major + 6 Minor = 10** (7 needed).
- What we learned: full-stack with Django + JS SPA + Three.js + PostgreSQL in Docker; game logic; deployment; security.
- Agile + feature branches kept 4 people productive.
- Solid base for the future: remote play, chat, richer AI.
- Pre-evaluation audit: green test suite, root-caused fixes.

## Slide 36 — Thank you
- "Thank you. We are happy to answer questions and show the demo."
