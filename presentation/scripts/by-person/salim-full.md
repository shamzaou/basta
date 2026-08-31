# Salim — speaking script (full)

You present **3 section(s)**, total ≈ **9.5 min** of speaking time. They come in this order during the talk:

| Order | Your section | Slides | Time |
|---|---|---|---|
| 03 | Selected Modules & Design | 12–17 | 3.5 min |
| 05 | Games & Graphics | 22–25 | 3.5 min |
| 08 | GDPR & Accessibility | 32–34 | 2.5 min |

Other people speak between your sections — wait for the hand-over, then take the clicker. The `full/` wording is to rehearse, not to read aloud on the day; keep the `points/` version in your hand.



---
---

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

**User Management.** *Standard user management* — Major — registration, login, profiles, avatars, friends, statistics, match history, and tournaments played under nicknames. *Remote authentication* — Major — OAuth 2.0 with the 42 Intra: a signed `state`, authorize, callback, state check and server-side code exchange, then a JWT.

**Gameplay.** *Add another game with user history and matchmaking* — Major — Tic-Tac-Toe, played locally on one device. Every game is recorded in the user's history, and matchmaking is the tournament system: round-robin pairings, a next-match announcement and tiebreaker rounds.

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

From then on the SPA talks to Django's REST API: accounts, presence, match history, tournaments — that is where matchmaking lives. Django talks to PostgreSQL only through the ORM.

Two external services: the 42 API for OAuth, and Gmail SMTP for the 2FA codes.

Docker Compose defines the two services, the private network and the database volume. `make up` starts everything.

---

## Slide 16 — Database and API design

The schema is defined with Django models, grouped into three apps.

`userapp` holds the custom **User** — e-mail is the login field, plus a 2FA flag, the avatar, a friends many-to-many, and the last-activity timestamp for GDPR — and **MatchHistory**: game type, opponent, result, score, date.

`gameapp` is small: it holds the `index` view that server-renders the requested page. Both games run in the browser and post their results to `MatchHistory`; its old Game, Player and Score models are legacy.

`tournaments` holds **Tournament**, **Player** — a nickname unique inside its tournament — and **Match** with scores, winner and a tiebreaker flag.

On the right, the API. Authentication: register, login, logout, verify-otp, token refresh. 42 OAuth: redirect_uri and get-token. Profile, friends and users — the friends list carries an online flag fed by a heartbeat endpoint. Save-match and match-history for the games. The GDPR trio: export, anonymize, delete. And the tournament API.

---

## Slide 17 — UI / UX design

The interface is built around clarity and feedback, with a retro arcade look — one colour scheme, one layout on every page.

The SPA router swaps views without reloads and keeps the browser history working, so Back and deep links behave. Flexbox and Grid with media queries adapt the pages down to phones. Buttons react on hover, loading states are shown during API calls, and errors are displayed clearly.

We sketched wireframes and the gameplay and tournament flows before implementing — you can see them on the right.

Now Nasser will take you through authentication and security.

---

## If they ask

- *"Why is Tic-Tac-Toe a module?"* — It has the three things the module asks for: a game distinct from Pong, per-user history, and matchmaking — the tournament system pairs players, announces the next match and creates tiebreakers. Neither game is played online; that is a project decision, the remote-players module is not selected. We show it in section 05.
- *"Why Gunicorn on 443 without nginx?"* — The subject says: ask whether nginx is truly necessary. For one Django app it is not; Gunicorn can terminate TLS directly, which is one container less.
- *"Why a vanilla-JS SPA?"* — The subject forbids front-end frameworks beyond the Bootstrap toolkit module; we wrote the router and views ourselves.


---
---

# 05 · Games & Graphics — Salim (slides 22–25, about 3.5 minutes)

---

## Slide 22 — Section divider

Thanks, Nasser. Back to me for the games: the 3D Pong with its AI opponent — that's the Graphics and AI modules — and Tic-Tac-Toe, the "another game" module.

---

## Slide 23 — 3D Pong and the AI opponent

When you open Pong you choose a mode. **Player vs Player** — two people on one keyboard, W/S and the arrow keys, or on a touch screen by dragging on your half of the canvas. **Player vs AI** — the right paddle is driven by our PongAI.

The game runs in a Three.js scene: a perspective camera above a lit table, and a spinning textured ball. First to three points wins; the HUD shows the score, the player names and the winner; Space pauses.

When a game ends, the result is posted to `/api/auth/save-match/` with the JWT, so it lands in the player's history and statistics — Ali's section.

---

## Slide 24 — Inside the graphics and the AI

**The scene.** A `PerspectiveCamera` with a 75-degree field of view looks down at the table from above and behind. Lighting is an ambient light plus a spot light, so the Phong materials show specular highlights on the glossy table. The paddles are emissive cyan, the net is a thin box, and the table has neon edge lines built from `EdgesGeometry`. The ball's magenta stripes are painted on an HTML canvas at start-up and used as a `CanvasTexture` — that's why it visibly spins. The renderer is antialiased, and the HUD is DOM elements composited over the canvas.

**The physics.** The bounce angle depends on where the ball hits the paddle — centre goes straight, the edges send it up to 45 degrees. Every hit speeds the ball up five percent, up to a cap. Hitting off-centre also adds spin, which bends the trajectory and rotates the mesh. Walls clamp the ball inside and reflect it — that clamp fixed a bug where the ball used to glide along the wall. The canvas keeps a 4:3 ratio when the window resizes.

**The AI — three rules from the subject.**

*Rule one: it may only look once per second.* Every thousand milliseconds the AI takes a snapshot of the ball's position and velocity. Between snapshots it acts only on its last decision, like a person who glanced at the ball a moment ago.

*Rule two: it must anticipate.* From the snapshot it extrapolates where the ball will cross its paddle line, and it folds the path at the walls — so wall bounces are anticipated, not discovered late. Then it adds a prediction error scaled by an accuracy of 0.8, and one decision in ten gets a deliberately big mistake. That is what makes it beatable.

*Rule three: it must simulate keyboard input.* The decision becomes a held ArrowUp or ArrowDown key, fed into the same `InputHandler` a human uses — so the AI paddle moves at exactly human speed and obeys the same bounds. It cannot teleport. Every five seconds the live score tunes its judgement: two points ahead, accuracy drops to 0.6 and mistakes rise to fifteen percent; two points behind, accuracy goes up to 0.9 and mistakes down to five. Only its judgement changes, never its speed.

And no A\*, which the subject forbids: A\* searches a graph, and Pong has no graph — this is kinematic prediction.

---

## Slide 25 — Tic-Tac-Toe: the second game, history and matchmaking

The "add another game" module asks for three things: a game distinct from Pong, user history tracking, and a matchmaking system.

**The game.** Tic-Tac-Toe is turn-based, the opposite of Pong. Two players share one device; X and O alternate on the three-by-three board. Win lines and draws are detected in the browser, a move on an occupied cell or after the game is over is ignored, and "Reset game" starts over. Like Pong, it is local by design — there is no online play anywhere in the project.

**User history.** When a game ends, the result is posted to `/api/auth/save-match/` with the JWT, and the server stores one `MatchHistory` row — game type TICTACTOE, win, loss or draw, and the date. It shows up in the profile's recent matches, in the win-rate chart and in the JSON export, exactly like a Pong game.

**Matchmaking.** Our matchmaking is the tournament system. A tournament of three to eight players is scheduled as a round-robin, the page announces the next pairing — "Next match: A versus B" — and if the leaders finish tied, the server creates tiebreaker matches until one winner remains. Nour presents it in the next section.

Now Nour will present the tournament system.

---

## If they ask

- *"Why is Tic-Tac-Toe not played online?"* — A project decision: no online play at all, for either game — the remote-players module is not selected. We did prototype a queue-based online mode and removed it again to keep the project consistent. The module asks for history and matchmaking; the tournament system is our matchmaking.
- *"Where is the matchmaking?"* — The tournament: the server schedules every pairing, announces who plays next and creates tiebreakers. Nour shows it next.
- *"Where does the Tic-Tac-Toe result go?"* — `POST /api/auth/save-match/` with the JWT, same endpoint as Pong; one MatchHistory row for the logged-in user.
- *"Can the AI lose?"* — Yes: the one-second blind window plus prediction error and random mistakes, at human paddle speed. In a first-to-three game either side can win.
- *"Does the AI adapt to the faster ball?"* — Yes, because it reads the current velocity at every snapshot.
- *"Is the AI on the server?"* — No, in the browser inside the render loop; only the final result goes to the server.
- *"Are Pong scores trusted from the client?"* — Yes — a listed limitation; server-authoritative Pong is a next step.


---
---

# 08 · GDPR & Accessibility — Salim (slides 32–34, about 2.5 minutes)

---

## Slide 32 — Section divider

Thanks, Ali. Two short topics from me: the GDPR minor module, and the two accessibility minors — browser compatibility and server-side rendering.

---

## Slide 33 — GDPR compliance

The module title lists three things: anonymization, local data management and account deletion. We have all three, plus retention.

**Anonymization.** "Anonymize My Account" in Settings strips every personal identifier: the username and e-mail become `anon_` plus a random token, the avatar file is deleted, the display name is cleared, the 42 link is removed, the friends lists are cleared, the password is made unusable and the account is disabled and logged out. The non-personal game statistics stay in the database — that is the point of anonymization versus deletion. It works for 42 accounts too: because the 42 e-mail and intra id are removed, the next 42 login creates a fresh account.

**Local data management.** "Download my data" returns a JSON file with the profile, the statistics and the full match history; the SPA adds the avatar as base64. Users can view and edit their display name, e-mail and avatar in Settings.

**Account deletion.** A hard delete after confirmation. The user row goes, and the database cascades: match history, friend links and tokens.

**Retention.** A management command, `delete_inactive_users`, warns by e-mail after five months of inactivity and deletes after six. A middleware stamps `last_activity` at most every fifteen minutes so it doesn't cost a write per request. It runs with `make gdpr-cleanup`.

And information: the privacy policy on the About page lists the data we collect, why, how long, and the user's rights.

---

## Slide 34 — Browser compatibility and server-side rendering

**Expanding browser compatibility.** Our primary browser is Chrome, with Edge as the same engine. The additional browser is **Firefox**. The application uses only standard web APIs — ES modules, `fetch`, `localStorage`, the History API, CSS Grid and Flexbox, WebGL 1 — with no vendor prefixes and no polyfills. We did hit Firefox-specific issues and fixed them: match dates are now ISO-8601 so `new Date()` parses them in Firefox, input uses pointer events instead of separate mouse and touch events, and fonts have fallbacks. Testing was manual in both browsers, plus an automated headless-Chrome walkthrough of every page.

**Server-side rendering.** Every URL is answered by Django's `index` view, which renders the *requested* page as complete HTML: the right section is already active, the navigation reflects whether you are logged in, the `<title>` and meta description are set per page, and for a logged-in user the profile — username, statistics, recent matches — is rendered into the HTML on the server before any JavaScript runs. Then the SPA hydrates and takes over routing. If you view-source `/profile` while logged in, you see real content, not an empty `div`. That gives a faster first paint and crawlable public pages.

**Responsive layout** is on the slide because people will ask: breakpoints at 1100, 920, 768 and 480 pixels, a hamburger menu, a fluid game canvas and touch controls. We kept it as a feature; "support on all devices" is not a module we claim.

Nasser closes with testing and evolution.

---

## If they ask

- *"Anonymize or delete — which one satisfies the module?"* — Both exist; anonymization is what the title names, deletion is the stricter "right to be forgotten".
- *"Is the cleanup cron running in the container?"* — Honestly: the crontab file is provided and the command works, but cron is not installed in the image; retention is enforced when `make gdpr-cleanup-run` is executed. That's a listed limitation.
- *"Is consent collected?"* — Registration implies acceptance; the policy is public. An explicit checkbox and cookie notice would be the improvement; we only use first-party functional cookies.
- *"Why not a real SSR framework?"* — The subject forbids front-end frameworks beyond the toolkit; Django's template engine is the sanctioned server renderer, and it now renders page state, not just a shell.
- *"What breaks on old browsers?"* — ES modules and `aspect-ratio` on IE or very old Safari — out of scope.
