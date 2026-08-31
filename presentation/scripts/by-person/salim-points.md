# Salim — speaking script (points)

You present **2 section(s)**, total ≈ **~6.5 min** of speaking time, in this order during the talk:

| Order | Your section | Slides | Time |
|---|---|---|---|
| 03 | Selected Modules & Design | 11–15 | 3.5 min |
| 05 | Games & Graphics | 20–23 | 3.5 min |

Bullet points only — what to cover on each of your slides. Print this and hold it. Other people speak between your sections.



---
---

# 03 · Selected Modules & Design — Salim (slides 11–15, about 3.5 minutes)

## Slide 11 — Section divider

## Slide 12 — Selected modules (the key slide for the evaluators)
- **7 Major + 6 Minor = 10 major-equivalents**; 7 required for 100 %.
- Walk down the table by category:
  - **Web**: Django backend (Major) · Bootstrap toolkit (Minor) · PostgreSQL (Minor).
  - **User Management**: standard user management (Major) · remote authentication = 42 OAuth with a signed `state` (Major).
  - **Gameplay**: another game with history + matchmaking = Tic-Tac-Toe (local) + match history + tournament matchmaking (Major).
  - **AI-Algo**: AI opponent (Major) · stats dashboards (Minor).
  - **Cybersecurity**: GDPR — anonymize / export / delete (Minor) · 2FA + JWT (Major).
  - **Graphics**: advanced 3D with Three.js (Major).
  - **Accessibility**: browser compatibility (Minor) · SSR (Minor).
- Not selected: support on all devices (responsive layout stays as a feature), remote players, live chat, microservices, multiple languages.
- Every module has its own slide later.

## Slide 13 — System architecture
- Monolith, clear frontend/backend split, two containers (web, db).
- Browser → one server-rendered page → SPA takes over.
- Gunicorn (3 workers) terminates HTTPS on 443, runs Django; WhiteNoise serves static files.
- Django REST API: accounts, presence, match history, tournaments (= matchmaking); PostgreSQL only via ORM.
- External: 42 API (OAuth), Gmail SMTP (2FA codes).

## Slide 14 — Database and API design
- Three apps:
  - `userapp`: **User** (custom, e-mail login, 2FA flag, avatar, friends M2M, last activity), **MatchHistory**.
  - `gameapp`: the SSR `index` view; both games run in the browser and post results to **MatchHistory** (legacy Game / Player / Score models).
  - `tournaments`: **Tournament**, **Player** (nickname per tournament), **Match**.
- API groups: auth (register/login/logout/verify-otp/token refresh), 42 OAuth (redirect_uri/get-token), profile & friends (+ online status), heartbeat, save-match/match-history, GDPR (export/anonymize/delete), `/tournaments/api/…`.

## Slide 15 — UI / UX design
- Clarity, one colour scheme (retro arcade), immediate feedback, app-like SPA.
- SPA router keeps browser history working; responsive with Flexbox/Grid + media queries.
- Loading states and clear errors; wireframes and flow sketches before coding.
- Hand over to Nasser for authentication and security.


---
---

# 05 · Games & Graphics — Salim (slides 20–23, about 3.5 minutes)

## Slide 20 — Section divider

## Slide 21 — 3D Pong and the AI opponent (screenshots)
- Mode select: Player vs Player (one keyboard W/S vs ↑/↓, or touch — drag on your half) or Player vs AI.
- First to 3 points; HUD shows score, names, winner; Space pauses.
- Results posted to `/api/auth/save-match/` with the JWT → profile stats.

## Slide 22 — Inside the graphics and the AI
- **Scene**: PerspectiveCamera 75° above the table; ambient + spot light; Phong materials (specular highlights); emissive cyan paddles; ball texture painted on an HTML canvas → `CanvasTexture`; neon edge lines; antialiasing; DOM HUD over the canvas.
- **Physics**: bounce angle from hit offset (±45°); +5 % speed per hit (capped); spin bends the path and rotates the mesh; wall clamp + reflect; 4:3 canvas on resize.
- **AI rule 1 — once per second**: snapshot of ball position + velocity every 1000 ms; acts on the last decision in between.
- **AI rule 2 — predict with errors**: extrapolate to the paddle plane, fold at the walls (bounces anticipated); add a prediction error (accuracy 0.8) and a 10 % "big mistake".
- **AI rule 3 — simulated keyboard**: decision = hold ArrowUp/ArrowDown in the same InputHandler as a human → identical paddle speed. Every 5 s the score tunes judgement: 2 ahead → accuracy 0.6 / mistakes 15 %; 2 behind → 0.9 / 5 %.
- **No A\***: Pong has no graph to search; it's kinematic prediction.

## Slide 23 — Tic-Tac-Toe: the second game, history and matchmaking (the "another game" module)
- **A game distinct from Pong**: turn-based, two players on one device; X and O alternate; win lines / draw detected in the browser; illegal moves ignored; "Reset game".
- **User history**: result posted to `/api/auth/save-match/` with the JWT → one `MatchHistory` row (TICTACTOE, WIN/LOSS/DRAW) → profile, win-rate chart, JSON export.
- **Matchmaking = the tournament system**: round-robin pairings, "Next match: A vs B" announced, tiebreaker rounds until one winner (Nour's section).
- **Not online**: both games run on one device by design — the "remote players" module is not selected.

## Be ready for
- Why is there no online Tic-Tac-Toe? Project decision: no online play at all. The module asks for history + matchmaking, and the tournament system is our matchmaking. (An online queue was prototyped and removed.)
- Where is the matchmaking then? Tournament: the server schedules every pairing and announces who plays next.
- Does the AI see bounces? Yes — the prediction folds the path at ±2.9 (the wall).
- Can the AI lose? Yes — 1 s blind window + error + mistakes; it plays at human paddle speed.
- Hand over to Nour: tournaments.
