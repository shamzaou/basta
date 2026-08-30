# 03 · Selected Modules & Design — Salim (slides 12–17, about 3.5 minutes)

---

## Slide 12 — Section divider

Thanks, Ali. I'm Salim. I'll present the modules we selected — this is the slide the evaluation is graded on — and then the design of the system.

---

## Slide 13 — Selected modules

The subject requires seven major modules for 100 %. Two minors count as one major.

We selected **seven Major and six Minor modules — ten major-equivalents**.

Let me go through them by category.

**Web.** *Use a framework as backend* — Major — Django 4.2 with Django REST Framework, three apps: `userapp`, `gameapp`, `tournaments`. *Front-end toolkit* — Minor — Bootstrap 4.5 with our custom CSS and a vanilla-JavaScript SPA router. *Database* — Minor — PostgreSQL 13, accessed only through the Django ORM and migrations.

**User Management.** *Standard user management* — Major — registration, login, profiles, avatars, friends, statistics, match history, and tournaments played under nicknames. *Remote authentication* — Major — OAuth 2.0 with the 42 Intra: authorize, callback, server-side code exchange, then a JWT.

**Gameplay.** *Add another game with user history and matchmaking* — Major — Tic-Tac-Toe, playable locally or online. The matchmaking queue pairs players by win rate, the game is turn-based on the server, and history is recorded for both players.

**AI-Algo.** *AI opponent* — Major — our PongAI looks at the game once per second, predicts where the ball will arrive including wall bounces, and presses simulated arrow keys at the same speed as a human. No A\*. *Stats dashboards* — Minor — profile cards, a win-rate chart, match history, the tournament scoreboard, and a JSON export.

**Cybersecurity.** *GDPR* — Minor — anonymization, data export, editing your data, account deletion, and cleanup of inactive accounts. *2FA and JWT* — Major — an e-mailed one-time code on login, and SimpleJWT access and refresh tokens.

**Graphics.** *Advanced 3D techniques* — Major — Three.js: perspective camera, lights, Phong materials, a textured spinning ball.

**Accessibility.** *Expanding browser compatibility* — Minor — only standard web APIs, tested in Chrome, Edge and Firefox. *Server-side rendering* — Minor — Django pre-renders the requested page, the title and meta tags, and the profile data; the SPA hydrates it.

What we did **not** select: support on all devices — the site is responsive and has touch controls, but we keep that as a feature, not a claimed module — remote players, live chat, microservices and multiple languages.

Every module gets its own slide in the next sections.

---

## Slide 14 — Technology stack

Our stack, briefly. Most of it is fixed by the subject for the modules we chose — Django, Bootstrap, PostgreSQL, Three.js — and the rest follows from those choices.

Backend: Python 3.11, Django 4.2, Django REST Framework, SimpleJWT, and python-decouple to read configuration from a `.env` file.

Server: Gunicorn terminates TLS itself on port 443 with a self-signed certificate — there is no nginx — and WhiteNoise serves hashed static files.

Database: PostgreSQL 13 in its own container.

Frontend: a vanilla-JavaScript single page application with HTML5, CSS3 and Bootstrap 4.5.

3D: Three.js release 128 on WebGL; the ball texture is generated on an HTML canvas.

DevOps: Docker Compose, a Makefile, and GitHub pull requests.

---

## Slide 15 — System architecture

The application is a monolith with a clear separation between frontend and backend, running in two containers.

The browser requests a page. Gunicorn — three workers — accepts the HTTPS connection on port 443 and runs Django. Django renders the first page on the server; then the JavaScript SPA takes over navigation.

From then on the SPA talks to Django's REST API: accounts, games, Tic-Tac-Toe matchmaking, tournaments. Django talks to PostgreSQL only through the ORM.

Two external services: the 42 API for OAuth, and Gmail SMTP for the 2FA codes.

Docker Compose defines the two services, the private network and the database volume. `make up` starts everything.

---

## Slide 16 — Database and API design

The schema is defined with Django models, grouped into three apps.

`userapp` holds the custom **User** — e-mail is the login field, plus a 2FA flag, the avatar, a friends many-to-many, and the last-activity timestamp for GDPR — and **MatchHistory**: game type, opponent, result, score, date.

`gameapp` holds the online Tic-Tac-Toe: **TicTacToeQueue** — one row per waiting player with their rating — and **TicTacToeMatch** — both players, the nine-cell board, whose turn it is, status and winner.

`tournaments` holds **Tournament**, **Player** — a nickname unique inside its tournament — and **Match** with scores, winner and a tiebreaker flag.

On the right, the API. Authentication: register, login, logout, verify-otp, token refresh. 42 OAuth: redirect_uri and get-token. Profile, friends and users. Save-match and match-history for the games. The GDPR trio: export, anonymize, delete. The `/api/game/ttt/` endpoints for matchmaking and online play. And the tournament API.

---

## Slide 17 — UI / UX design

The interface is built around clarity and feedback, with a retro arcade look — one colour scheme, one layout on every page.

The SPA router swaps views without reloads and keeps the browser history working, so Back and deep links behave. Flexbox and Grid with media queries adapt the pages down to phones. Buttons react on hover, loading states are shown during API calls, and errors are displayed clearly.

We sketched wireframes and the gameplay and tournament flows before implementing — you can see them on the right.

Now Nasser will take you through authentication and security.

---

## If they ask

- *"Why is Tic-Tac-Toe a module now?"* — It has the three things the module asks for: a game distinct from Pong, per-user history, and a matchmaking system with fair pairing. We show it in section 05.
- *"Why Gunicorn on 443 without nginx?"* — The subject says: ask whether nginx is truly necessary. For one Django app it is not; Gunicorn can terminate TLS directly, which is one container less.
- *"Why a vanilla-JS SPA?"* — The subject forbids front-end frameworks beyond the Bootstrap toolkit module; we wrote the router and views ourselves.
