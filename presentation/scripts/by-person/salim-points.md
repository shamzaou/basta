# Salim — speaking script (points)

You present **3 section(s)**, total ≈ **9.5 min** of speaking time. They come in this order during the talk:

| Order | Your section | Slides | Time |
|---|---|---|---|
| 03 | Selected Modules & Design | 12–17 | 3.5 min |
| 05 | Games & Graphics | 22–25 | 3.5 min |
| 08 | GDPR & Accessibility | 32–34 | 2.5 min |

Bullet points only — what to cover on each of your slides. Print this and hold it. Other people speak between your sections.



---
---

# 03 · Selected Modules & Design — Salim (slides 12–17, about 3.5 minutes)

## Slide 12 — Section divider

## Slide 13 — Selected modules (the key slide for the evaluators)
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

## Slide 14 — Technology stack
- Backend: Python 3.11, Django 4.2, DRF, SimpleJWT, python-decouple (`.env`).
- Server: Gunicorn with TLS on 443 (self-signed cert), WhiteNoise for hashed static files.
- DB: PostgreSQL 13 in its own container, ORM + migrations.
- Frontend: vanilla JS SPA, HTML5/CSS3, Bootstrap 4.5.
- 3D: Three.js r128 (WebGL); canvas-generated textures.
- DevOps: Docker Compose, Makefile, GitHub PRs.
- Justification: the subject fixes Django / Bootstrap / PostgreSQL / Three.js for these modules.

## Slide 15 — System architecture
- Monolith, clear frontend/backend split, two containers (web, db).
- Browser → one server-rendered page → SPA takes over.
- Gunicorn (3 workers) terminates HTTPS on 443, runs Django; WhiteNoise serves static files.
- Django REST API: accounts, presence, match history, tournaments (= matchmaking); PostgreSQL only via ORM.
- External: 42 API (OAuth), Gmail SMTP (2FA codes).

## Slide 16 — Database and API design
- Three apps:
  - `userapp`: **User** (custom, e-mail login, 2FA flag, avatar, friends M2M, last activity), **MatchHistory**.
  - `gameapp`: the SSR `index` view; both games run in the browser and post results to **MatchHistory** (legacy Game / Player / Score models).
  - `tournaments`: **Tournament**, **Player** (nickname per tournament), **Match**.
- API groups: auth (register/login/logout/verify-otp/token refresh), 42 OAuth (redirect_uri/get-token), profile & friends (+ online status), heartbeat, save-match/match-history, GDPR (export/anonymize/delete), `/tournaments/api/…`.

## Slide 17 — UI / UX design
- Clarity, one colour scheme (retro arcade), immediate feedback, app-like SPA.
- SPA router keeps browser history working; responsive with Flexbox/Grid + media queries.
- Loading states and clear errors; wireframes and flow sketches before coding.
- Hand over to Nasser for authentication and security.


---
---

# 05 · Games & Graphics — Salim (slides 22–25, about 3.5 minutes)

## Slide 22 — Section divider

## Slide 23 — 3D Pong and the AI opponent (screenshots)
- Mode select: Player vs Player (one keyboard W/S vs ↑/↓, or touch — drag on your half) or Player vs AI.
- First to 3 points; HUD shows score, names, winner; Space pauses.
- Results posted to `/api/auth/save-match/` with the JWT → profile stats.

## Slide 24 — Inside the graphics and the AI
- **Scene**: PerspectiveCamera 75° above the table; ambient + spot light; Phong materials (specular highlights); emissive cyan paddles; ball texture painted on an HTML canvas → `CanvasTexture`; neon edge lines; antialiasing; DOM HUD over the canvas.
- **Physics**: bounce angle from hit offset (±45°); +5 % speed per hit (capped); spin bends the path and rotates the mesh; wall clamp + reflect; 4:3 canvas on resize.
- **AI rule 1 — once per second**: snapshot of ball position + velocity every 1000 ms; acts on the last decision in between.
- **AI rule 2 — predict with errors**: extrapolate to the paddle plane, fold at the walls (bounces anticipated); add a prediction error (accuracy 0.8) and a 10 % "big mistake".
- **AI rule 3 — simulated keyboard**: decision = hold ArrowUp/ArrowDown in the same InputHandler as a human → identical paddle speed. Every 5 s the score tunes judgement: 2 ahead → accuracy 0.6 / mistakes 15 %; 2 behind → 0.9 / 5 %.
- **No A\***: Pong has no graph to search; it's kinematic prediction.

## Slide 25 — Tic-Tac-Toe: the second game, history and matchmaking (the "another game" module)
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


---
---

# 08 · GDPR & Accessibility — Salim (slides 32–34, about 2.5 minutes)

## Slide 32 — Section divider

## Slide 33 — GDPR compliance (Minor module: anonymization, local data management, deletion)
- **Anonymization** — "Anonymize My Account": username/e-mail → `anon_<token>`, avatar deleted, display name cleared, 42 link removed, friends cleared, password unusable, account disabled, logged out. Non-personal stats stay. Works for 42 accounts (next 42 login creates a fresh account).
- **Local data management** — "Download my data": JSON with profile, statistics, full match history (+ avatar as base64); edit display name / e-mail / avatar in Settings.
- **Account deletion** — hard delete with cascade (match history, friend links, tokens), after confirmation.
- **Retention** — `delete_inactive_users`: warn at 5 months, delete at 6; `last_activity` via middleware (`make gdpr-cleanup`).
- **Information** — privacy policy on the About page (data collected, use, retention, rights).

## Slide 34 — Browser compatibility and SSR (2 Minor modules) + responsive (feature)
- **Browser compatibility**: primary Chrome/Edge, additional **Firefox**. Standard APIs only (ES modules, fetch, localStorage, History API, Grid/Flexbox, WebGL 1). Fixes made for Firefox: ISO-8601 dates, pointer events, font fallbacks. Tested manually in both + headless-Chrome walkthrough.
- **SSR**: Django `index` view renders the *requested* page — active section, nav in the right login state, `<title>` + meta description, and for logged-in users the **profile data** (username, stats, recent matches) already in the HTML. SPA hydrates and takes over. View-source shows real content → faster first paint, SEO.
- **Responsive** (feature, not a claimed module): breakpoints 1100 / 920 / 768 / 480, hamburger menu, fluid canvas, touch controls.

## Be ready for
- "The module says anonymization" → yes, implemented; deletion also exists (stricter).
- Is the cron installed? The crontab file exists; the command runs via `make gdpr-cleanup-run` — say it honestly.
- Why not Next/Nuxt for SSR? Subject forbids front-end frameworks; Django templates are the sanctioned server renderer.
- Hand over to Nasser: testing and evolution.
