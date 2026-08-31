# 03 · Selected Modules & Design — Salim (slides 11–15, about 3.5 minutes)

---

## Slide 11 — Section divider

Thanks, Ali. I'm Salim. I'll present the modules we selected — this is the slide the evaluation is graded on — and then the design of the system.

---

## Slide 12 — Selected modules

The subject requires seven major modules for 100 %. Two minors count as one major.

We selected **seven Major and six Minor modules — ten major-equivalents**.

Let me go through them by category.

**Web.** *Use a framework as backend* — Major — Django 4.2 with Django REST Framework, three apps: `userapp`, `gameapp`, `tournaments`. *Front-end toolkit* — Minor — Bootstrap 4.5 with our custom CSS and a vanilla-JavaScript SPA router. *Database* — Minor — PostgreSQL 13, accessed only through the Django ORM and migrations.

**User Management.** *Standard user management* — Major — registration, login, profiles, avatars, friends, statistics, match history, and tournaments played under nicknames. *Remote authentication* — Major — OAuth 2.0 with the 42 Intra: a signed `state`, authorize, callback, state check and server-side code exchange, then a JWT.

**Gameplay.** *Add another game with user history and matchmaking* — Major — Tic-Tac-Toe, played locally on one device. Every game is recorded in the user's history, and matchmaking is the tournament system: round-robin pairings, a next-match announcement and tiebreaker rounds.

**AI-Algo.** *AI opponent* — Major — our PongAI looks at the game once per second, predicts where the ball will arrive including wall bounces, and presses simulated arrow keys at the same speed as a human. No A\*. *Stats dashboards* — Minor — profile cards, a win-rate chart, match history, the tournament scoreboard, and a JSON export.

**Cybersecurity.** *GDPR* — Minor — anonymization, data export, editing your data, account deletion, and cleanup of inactive accounts. *2FA and JWT* — Major — an e-mailed one-time code on login, and SimpleJWT access and refresh tokens.

**Graphics.** *Advanced 3D techniques* — Major — Three.js: perspective camera, lights, Phong materials, a textured spinning ball.

**Accessibility.** *Expanding browser compatibility* — Minor — only standard web APIs, tested in Chrome, Edge and Firefox. *Server-side rendering* — Minor — Django pre-renders the requested page, the title and meta tags, and the profile data; the SPA hydrates it.

What we did **not** select: support on all devices — the site is responsive and has touch controls, but we keep that as a feature, not a claimed module — remote players, live chat, microservices and multiple languages.

Every module gets its own slide in the next sections.

---

## Slide 13 — System architecture

The application is a monolith with a clear separation between frontend and backend, running in two containers.

The browser requests a page. Gunicorn — three workers — accepts the HTTPS connection on port 443 and runs Django. Django renders the first page on the server; then the JavaScript SPA takes over navigation.

From then on the SPA talks to Django's REST API: accounts, presence, match history, tournaments — that is where matchmaking lives. Django talks to PostgreSQL only through the ORM.

Two external services: the 42 API for OAuth, and Gmail SMTP for the 2FA codes.

Docker Compose defines the two services, the private network and the database volume. `make up` starts everything.

---

## Slide 14 — Database and API design

The schema is defined with Django models, grouped into three apps.

`userapp` holds the custom **User** — e-mail is the login field, plus a 2FA flag, the avatar, a friends many-to-many, and the last-activity timestamp for GDPR — and **MatchHistory**: game type, opponent, result, score, date.

`gameapp` is small: it holds the `index` view that server-renders the requested page. Both games run in the browser and post their results to `MatchHistory`; its old Game, Player and Score models are legacy.

`tournaments` holds **Tournament**, **Player** — a nickname unique inside its tournament — and **Match** with scores, winner and a tiebreaker flag.

On the right, the API. Authentication: register, login, logout, verify-otp, token refresh. 42 OAuth: redirect_uri and get-token. Profile, friends and users — the friends list carries an online flag fed by a heartbeat endpoint. Save-match and match-history for the games. The GDPR trio: export, anonymize, delete. And the tournament API.

---

## Slide 15 — UI / UX design

The interface is built around clarity and feedback, with a retro arcade look — one colour scheme, one layout on every page.

The SPA router swaps views without reloads and keeps the browser history working, so Back and deep links behave. Flexbox and Grid with media queries adapt the pages down to phones. Buttons react on hover, loading states are shown during API calls, and errors are displayed clearly.

We sketched wireframes and the gameplay and tournament flows before implementing — you can see them on the right.

Now Nasser will take you through authentication and security.

---

## If they ask

- *"Why is Tic-Tac-Toe a module?"* — It has the three things the module asks for: a game distinct from Pong, per-user history, and matchmaking — the tournament system pairs players, announces the next match and creates tiebreakers. Neither game is played online; that is a project decision, the remote-players module is not selected. We show it in section 05.
- *"Why Gunicorn on 443 without nginx?"* — The subject says: ask whether nginx is truly necessary. For one Django app it is not; Gunicorn can terminate TLS directly, which is one container less.
- *"Why a vanilla-JS SPA?"* — The subject forbids front-end frameworks beyond the Bootstrap toolkit module; we wrote the router and views ourselves.
