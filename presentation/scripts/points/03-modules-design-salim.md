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
