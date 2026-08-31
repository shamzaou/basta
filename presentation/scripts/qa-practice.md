# Practice Q&A (detailed) — FAST_PONG staff evaluation

Rehearse out loud. Each question tags the **section / slides** and the person most likely to answer, but any evaluator can ask anyone — read everyone's. Answers are written long on purpose so you understand the *why*; on the day, say the first two sentences and stop unless they push.

**Golden rules**
- Justify every choice — the subject grades your decisions, not just that it works.
- If you don't know: "I didn't build that part, <name> did and can explain it precisely." Never guess.
- Demo kit: `make up` → https://localhost · `make test` (54 tests) · two browser profiles · console e-mail backend for 2FA · a 2nd throwaway account for GDPR.

**Stack in one breath:** Django 4.2 + Django REST Framework + SimpleJWT, PostgreSQL 13, vanilla-JS single-page app with Bootstrap, Three.js Pong, Gunicorn serving HTTPS on 443 with WhiteNoise, all in Docker Compose (two services: `web`, `db`).

---

## Whole project / mandatory part — anyone (title slides 1–5)

**Q. How do you reach 100%? List the modules and the arithmetic.**
A. Two minor modules equal one major, and 7 major-equivalents = 100%. We have **7 Major** — Django backend, standard user management, remote authentication (42 OAuth), "add another game with history and matchmaking", AI opponent, 2FA + JWT, advanced 3D — and **6 Minor** — Bootstrap toolkit, PostgreSQL, user/game stats dashboards, GDPR, expanded browser compatibility, SSR. That is 7 + 6×0.5 = **10 major-equivalents**, comfortably over the 7 required, which gives us margin if an evaluator is strict on one module. We did **not** take: support-on-all-devices, remote players, live chat, microservices, multiple languages (an all-devices minor and a languages minor were prototyped and removed once we finalised the list).

**Q. Prove it's a single-page application and that Back/Forward work.**
A. There is one server-rendered HTML page (`templates/frontend/index.html`) holding every "page" as a hidden `div`. `static/frontend/js/script.js` is the router: `showPage(id)` hides the others and shows one, and it drives `history.pushState`/listens to `popstate`, so the URL changes and the browser Back/Forward buttons move between views with no network reload. Demo: log in, go Home → Profile → Tournament, press Back twice — you land back on Home, no full reload (Network tab shows only API calls, not document loads).

**Q. Show there are no unhandled errors or warnings in the console.**
A. Open DevTools → Console and click through every page and both games — it stays clean. We enforce this with an automated headless-Chrome walkthrough of every page (desktop + phone viewport) that fails if any console error appears; the last run was 0. If a warning ever shows, it's from a CDN (Bootstrap/Three.js) and not our code.

**Q. Where do credentials live? Prove nothing sensitive is in git.**
A. Everything — the Django secret key, DB password, Gmail app password, 42 client id/secret, JWT/state secrets — is in `.env`, and `.env` is the first line of `.gitignore`. `docker-compose.yml` no longer hard-codes the DB password; it substitutes `${DB_NAME}/${DB_USER}/${DB_PASSWORD}` from `.env` (`docker-compose config` shows the resolved value, but the file in git has only the variable names). Proof: `git log --all -- .env` returns nothing. python-decouple reads `.env` at container start, so a change needs a restart.

**Q. One command to launch, and what runs?**
A. `make up` (wrapping `docker-compose up`); `make build` first for a clean image. Two containers on a private bridge network: `db` (postgres:13, data on a named volume so it survives restarts) and `web`, whose entrypoint waits for the DB, runs `migrate`, `createcachetable` (the shared 2FA cache) and `collectstatic`, then starts Gunicorn with 3 workers and TLS on 443 using the self-signed `localhost.pem`.

**Q. Is HTTPS enforced everywhere?**
A. Yes. Gunicorn terminates TLS directly on 443 — there's no HTTP listener and nothing on port 80. All fetches are same-origin HTTPS; we use no WebSockets, so there's no `ws://` to worry about (the subject's "use wss not ws" doesn't apply because we have no realtime sockets).

**Q. How many tests, split how, and what do they actually assert?**
A. **54** via `make test` (`docker-compose exec web python manage.py test`): **userapp 41, tournaments 10, gameapp 3**. Examples: the 2FA cache is not per-process; a slow e-mail backend proves login returns before the mail is sent; the tournament tie-breaker creates a second round when leaders tie again; `add_players` rejects blank/duplicate/over-long nicknames; `get_token` refuses a forged/missing OAuth `state` and never calls 42; anonymizing a 42 account then re-logging-in with 42 creates a fresh account; a JWT-only request (no session cookie) is accepted on `/profile/`; the SSR view puts the username and title into the HTML for a logged-in request.

---

## Nour — 01 Introduction (slides 3–5) & 06 Tournaments (24–26)

**Q. (Intro, slide 4) Describe the project in a few sentences.**
A. FAST_PONG is a web platform, built as the 42 Abu Dhabi capstone, whose main game is Pong — but in 3D, playable with a friend on one keyboard or against a computer opponent. Around it there's a second game (Tic-Tac-Toe), a tournament system, secure accounts (email/password, 42 login, optional two-factor), player profiles with statistics and a friends list, and GDPR data tools. It's a single-page app served by Django and PostgreSQL, running in Docker.

**Q. (Intro) Why Django, and why is that a *choice* worth points?**
A. The Web "framework as backend" major module *requires* Django, so choosing it makes that module count. Beyond the requirement, it hands us a lot for free that we'd otherwise build (and be graded on) ourselves: session and user auth, the ORM which parameterises every query so we're immune to SQL injection, automatic template escaping and CSRF middleware for XSS/CSRF, and a migration system so the schema is versioned. That let us spend our time on the actual features — games, tournaments, OAuth — instead of plumbing.

**Q. (Intro) What's the request path from the browser to the database?**
A. The browser makes an HTTPS request to Gunicorn on 443; Gunicorn hands it to one of 3 Django workers; Django's middleware runs (security, sessions, CSRF, auth); the URL router sends `/api/...` to a view; the view uses the ORM, which issues a parameterised SQL query to PostgreSQL over the private Docker network; the JSON comes back the same way. Static files (JS/CSS) are served by WhiteNoise from the hashed `staticfiles/` manifest.

**Q. (Tournaments, slide 25) Walk through creating and playing a tournament.**
A. A logged-in user opens Tournament, chooses 3–8 participants, and enters an alias per player — player 1 is pre-filled with the creator's own (unique) display name. The backend creates the tournament and, in `tournaments/views.py add_players`, generates a **round-robin** using `itertools.combinations` — every pair plays exactly once. The view shows the table of matches, highlights and names the **next match** ("Next match: A vs B"), and each row has a *Start Match* button that launches the Pong game for those two aliases. When the game ends the score is posted back, the winner is recorded, the table updates, and the next pairing is announced.

**Q. (Tournaments) The subject wants a "matchmaking system that announces the next fight" — where is it?**
A. That *is* the tournament system. It owns the pairing (round-robin), it shows the order of play, and it announces the next fight with the "Next match" line and the highlighted row. We deliberately did not build online matchmaking because we didn't take the Remote Players module — every game is local, so "matchmaking" here means organising who plays whom and when, exactly what the mandatory tournament text asks for.

**Q. (Tournaments) What if the leaders tie?**
A. `Tournament.get_winner()` computes each player's wins; if two or more share the top score it creates a **round of tiebreaker matches** (marked `is_additional`) among only the tied players and reports "no winner yet". If that round *also* ends level it creates another round among whoever is still tied, and so on, until exactly one player is on top — so the tournament always resolves to a single winner instead of dead-ending. Pong itself can't tie because a game runs until someone reaches 3 points.

**Q. (Tournaments) Are aliases reset between tournaments? Where are they stored?**
A. Yes — aliases live in the `tournaments.Player` table, which is scoped to one tournament (`unique_together` on tournament + nickname). A new tournament has its own players, so aliases from a previous one are gone. That satisfies the mandatory "aliases are reset when a new tournament begins" rule, and the Standard User Management module lets the creator play under their account's display name.

**Q. (Tournaments) Does a browser refresh lose the tournament?**
A. No. When a tournament is created we keep its id in `localStorage` (`currentTournamentId`), so reloading `/tournament` restores the live view and reloads the table from the server instead of dropping back to the create form. This was a bug we found and fixed during the audit.

**Q. (Tournaments) Can someone tamper with a tournament through the API?**
A. The tournament endpoints now require a logged-in session (a `require_login` decorator returns 401 otherwise) and are CSRF-protected, and `finish_match` validates the scores are non-negative integers and not equal before deciding a winner. So you can't finish a match with junk data or drive the bracket while logged out.

---

## Ali — 02 SDLC (6–10), 07 Profiles/Statistics/Friends (27–29), 09 Team & Conclusion (33–36)

**Q. (SDLC, slide 7) Which model did you follow and what's the evidence?**
A. **Iterative and incremental** development with a GitHub feature-branch flow. Each feature was a short vertical slice — design, build on a branch, integrate, test — and the app was runnable after every merge. Evidence lives in the git history: ~90 commits between 10 Feb and 2 Apr 2025 across 15 merged pull requests, each named for a feature (db-connect, game-setup, tournaments, profile-page, secure-cookies, OAuth, user-settings, delete-account…), plus repeated "merge master into <feature>" commits that show continuous integration of parallel work. We're honest that there were no formal time-boxed sprints or a ticket tracker — planning happened in person and requirements came from the subject and the module list.

**Q. (SDLC, slide 9) You tried microservices — what happened, and what did you learn?**
A. We first planned the DevOps microservices module, splitting the backend into separate services. In practice our containers could not communicate and coordinate reliably in the time we had, and wiring them together kept eating the schedule — so we stepped back to a **modular monolith**: one Django backend with three clean apps (userapp, gameapp, tournaments). It gives the same separation of concerns and it actually runs; a working monolith beats a half-built microservices setup, and it is not a module we claim. The second lesson was Git discipline — early on we edited the same files without branches and lost work to overwriting merges, so we moved to one branch per feature, pull-before-push and reviewed pull requests, and after that we never lost work again.

**Q. (SDLC, slide 7) Describe the branching and review workflow.**
A. `master` is the stable branch. Every feature or fix went on its own branch (e.g. `feature/OAuth`), was opened as a pull request, reviewed by another member, and only merged after it was stable and tested. That isolated work-in-progress, kept `master` runnable, and gave everyone a checkpoint to catch bugs and share knowledge.

**Q. (Profiles, slide 28) What's on the profile / stats dashboard, and where does the data come from?**
A. The profile shows the avatar, join date, and three stat cards — games played, win rate, best score — plus a hand-drawn SVG win-rate pie chart and the last five matches (opponent, score, result, game type, date). It's produced by `userapp.views.profile_view` (and a shared helper `build_profile_summary`) which reads the `MatchHistory` rows for that user, counts wins/total for the win rate, and finds the biggest-margin win for "best score". Tournament games are excluded from these personal stats so a tournament doesn't distort your win rate. The tournament page is the separate per-session view: every match, its score and its winner.

**Q. (Profiles) Is the display name unique, and why does that matter?**
A. Yes — uniqueness is enforced case-insensitively in the profile update (`display_name__iexact`), so two users can't both be "Champ"; the API answers "Display name already taken". It matters because we use the display name as the player's tournament alias, so it has to be unambiguous. The subject explicitly asks for a *unique* display name to play tournaments.

**Q. (Friends, slide 29) How does online status work — and to be clear, is there any online play?**
A. There is **no online play** anywhere; this is presence only. Every logged-in browser tab sends a lightweight heartbeat, `POST /api/auth/heartbeat/`, once a minute, which updates that user's `last_activity`. A user is shown "Online" (green dot) if their last activity is within 2 minutes, otherwise "Offline"; logging out immediately pushes `last_activity` back so they drop offline at once. `get_friends`/`get_all_users` include the `online` flag. Demo: log the same two friends into two separate browser profiles and watch one go online, then offline when they log out.

**Q. (Profiles) Add/remove friends — how does the UI stay in sync?**
A. The Profile page has "My Friends" and "Find Users" tabs. Adding calls `POST /api/auth/friends/add/<id>/`, removing calls the remove endpoint; on success the button flips (Add ↔ Remove) and the friends list reloads, so both tabs agree. The friend model is a non-symmetrical many-to-many on the custom `User`.

**Q. (Database) How is the schema defined, and how does that protect you?**
A. Entirely through Django models — no hand-written SQL. The models are grouped in three apps: `userapp` (custom `User` with email login, avatar, 2FA flag, friends, `last_activity`; and `MatchHistory`), `tournaments` (`Tournament`, `Player`, `Match`), and `gameapp` (legacy `Game/Player/Score`, unused, plus the SSR view). Because every read/write goes through the ORM, parameters are always escaped — that's our SQL-injection defence — and migrations keep the schema versioned and reproducible.

**Q. (Conclusion, slide 34) What were the hardest parts and the main lessons?**
A. Hardest: the tournament tie/tiebreaker logic, managing SPA state (who's logged in, which view, its data) in vanilla JS with no framework, the asynchronous OAuth and 2FA flows, and getting the two Docker containers to talk. Lessons: a clear API contract lets frontend and backend move in parallel; a mature framework (Django) saved huge time on auth and security; a disciplined Git/PR workflow kept four people productive; and security has to be considered at every layer, not bolted on.

---

## Salim — 03 Modules & Design (11–15) & 05 Games & Graphics (20–23)

**Q. (Design, slide 13) Describe the architecture and justify it.**
A. It's a **modular monolith** in Docker. The browser runs the SPA; Gunicorn (3 sync workers) serves the Django app over HTTPS on 443 and serves hashed static files through WhiteNoise; Django exposes a REST/JSON API and talks to PostgreSQL only via the ORM; the two external dependencies are the 42 API (OAuth) and Gmail SMTP (2FA mail). Docker Compose defines the `web` and `db` services, the private network and the DB volume. We chose a monolith over microservices deliberately — for a four-person capstone it's simpler to develop, deploy and reason about, and we didn't take the microservices module; the three Django apps already give us clean internal boundaries.

**Q. (Design) Why Bootstrap, and where is it really used?**
A. Bootstrap is the toolkit the front-end Minor module requires, so using it makes that module count. We use its layout grid (`container`, rows/columns), buttons (`btn`, `btn-primary/secondary/danger`), `btn-group` and utilities like `text-center`; the retro-arcade look on top is our own CSS. Be honest that most of the *visual* styling is custom — Bootstrap gives us the responsive structure and consistent controls, which is what the module is about.

**Q. (Graphics, slide 21) What exactly makes the Pong "advanced 3D"?**
A. It's built with Three.js (r128) on WebGL, not a 2D canvas. There's a `PerspectiveCamera` looking down at an angle, ambient plus spot lighting, `MeshPhongMaterial` surfaces with emissive glow for the neon look, a table from box geometry with edge-line borders, and a spherical ball whose texture is **generated procedurally** on an off-screen canvas and mapped onto it, with spin applied to the ball's rotation as it moves. The scene is driven by a `requestAnimationFrame` render loop and resizes correctly with the window. So it's real 3D geometry, materials, lighting and texturing — the module's intent.

**Q. (Graphics, slide 22) Explain your AI in detail. Remember A\* is banned and it must behave like a human.**
A. The AI lives client-side in `pong.js` (`PongAI`). It obeys the subject's key constraint — it only **refreshes its view of the game once per second** — so between refreshes it can't react, it has to *anticipate*. On each refresh it predicts where the ball will cross its paddle's x-line by simulating the ball forward and **folding the path off the top and bottom walls** (`predictZ`), which is how it "anticipates bounces". It then behaves like a person: instead of moving the paddle directly, it fills a simulated key set (up/down) that the shared `InputHandler` applies — at **exactly the same paddle speed as the human** (`GAME_CONFIG.paddleSpeed`, 0.15 per frame). It has an accuracy/error margin and a mistake chance that adapt to the score (rubber-banding), so it can lose, but it also wins. No A\* and no pathfinding — it's a physics prediction plus simulated input.

**Q. (Graphics) Is the AI genuinely the same speed as a player? Prove it.**
A. Yes. There is no separate "AI speed" any more — the AI's simulated keys go through the very same `InputHandler.update()` that moves the human paddle, so both move `paddleSpeed` (0.15) per frame and are bounded by the same limits. We verified it with a Node harness that measures the per-frame displacement and confirms it equals the human's exactly.

**Q. (Games, slide 23) Is Tic-Tac-Toe online? Where's its "matchmaking"?**
A. It's **local** hot-seat — two players on one keyboard, X and O alternate, win/draw detected in the browser — and every finished game is saved to the player's match history via `POST /api/auth/save-match/`. For the "Add another game with history and matchmaking" module: the new game is Tic-Tac-Toe, the history is the `MatchHistory`/profile, and the **matchmaking is the tournament system**. We built and then removed an online Tic-Tac-Toe queue on purpose, because we don't offer online play — both games are local by design (no Remote Players module).

---

## Nasser — 04 Authentication & Security (16–19) & 08 GDPR & Accessibility (30–32)

**Q. (Auth, slide 17) Walk through the whole 42 OAuth flow.**
A. The user clicks "Sign in with 42". The SPA calls `POST /api/auth/redirect_uri/`, which builds the 42 authorize URL (`api.intra.42.fr/oauth/authorize` with our client id, the redirect URI and `response_type=code`) plus a signed **state**, stores the state in the session, and returns the URL. The browser goes to 42, the user consents, and 42 redirects back to `https://localhost/oauth/callback?code=…&state=…`. The SPA's `checkOAuthLogin` reads both and posts them to `POST /api/auth/get-token/`, which validates the state, exchanges the code at 42's token endpoint for an access token, calls `/v2/me` for the user's login/email/id, creates-or-links the account, issues our own JWT (access + refresh), and logs them in. So 42 handles authentication; we mint our own session token afterwards.

**Q. (Auth) What is the OAuth `state` parameter and how is yours implemented?**
A. It defends the callback against CSRF / login-CSRF — an attacker can't feed a victim a forged `code` to log them into the attacker's 42 account. Ours is a `django.core.signing`-signed token (`OAUTH_STATE_SECRET`, salt `oauth-state`) that we also store in the user's session when we issue the authorize URL. In `get_token` we pop the session copy, require the returned `state` to equal it, and verify the signature and a 10-minute max-age; if any check fails we return 400 "Invalid OAuth state" and **never contact 42**. It's single-use because we pop it from the session. Three unit tests cover this.

**Q. (Auth, slide 18) How does your 2FA work end to end?**
A. It's optional email-based 2FA. On login of an account with 2FA enabled, `login_view` generates a 6-digit code, stores it in a shared cache keyed by user id, and e-mails it — then returns `requires_2fa: true` immediately without issuing tokens. The SPA shows a modal; the user enters the code; `verify_otp` compares it (as a trimmed string), and on success logs them in and issues the JWT. The code has a 10-minute TTL and is single-use (deleted on success), and clicking "Sign in" again reuses the still-valid code instead of invalidating the emailed one.

**Q. (Auth) You had two 2FA bugs — what were the root causes and fixes?**
A. First, "a correct code is sometimes rejected": the code was stored in Django's default in-memory cache, which is **per-process**, and Gunicorn runs **3 workers** — so the worker that verified often wasn't the one that stored it. Fix: a **DatabaseCache** shared by all workers (table created by `createcachetable` in the entrypoint). Second, "the email is very slow": `send_mail` ran **synchronously inside the login request** with no timeout, so the response waited for the whole SMTP round-trip (and 500'd on failure). Fix: send from a **background daemon thread** with `EMAIL_TIMEOUT=10`, logging failures — login now returns in ~80 ms.

**Q. (Auth) Why can a 42 account not turn on 2FA?**
A. A 42 user never enters a password on our site — authentication is delegated to 42 — so an email second factor would guard nothing (there's no password prompt to add a factor to). We hide the whole Security section in Settings for `is_42_user` accounts, and the profile API returns 400 if someone tries to enable it via the endpoint.

**Q. (Auth) How is JWT used — where are tokens kept and sent, and is that secure?**
A. SimpleJWT issues an **access token (60 min)** and a **refresh token (7 days)**, with rotation on refresh. The SPA stores them in `localStorage` and sends `Authorization: Bearer <token>` on API calls through a wrapper, `authFetch`, which transparently refreshes an expired access token and retries once. Every DRF endpoint — including profile and settings — validates the JWT (with session as a fallback). Honest trade-off: `localStorage` is readable by JavaScript, so it's exposed to XSS; we accept that and mitigate hard against XSS (ORM, template auto-escaping, `textContent` on the client), and note that moving tokens to httpOnly cookies would be the next hardening step.

**Q. (Auth) How are passwords stored and what's the policy?**
A. Django hashes and salts with **PBKDF2** by default — we never store plaintext. Sign-up enforces: at least 10 characters, an uppercase letter, a digit, a special character, not a common password, not entirely numeric, and not too similar to the username/email (via Django's validators plus our custom strength validator). And we report **every** failing rule at once with a hint under the field, instead of a single generic "invalid password".

**Q. (Security) SQL injection, XSS and CSRF — how are you covered?**
A. **SQLi**: all DB access is through the ORM, which parameterises queries — we never concatenate user input into SQL. **XSS**: Django templates auto-escape, and on the client we insert user-supplied strings with `textContent`, never `innerHTML` — we actually found and fixed a stored XSS where tournament nicknames were rendered as HTML. **CSRF**: Django's CSRF middleware is on; the token comes from a cookie and every state-changing `fetch` sends it in the `X-CSRFToken` header.

**Q. (Security) Are your API routes protected?**
A. Yes. DRF endpoints require authentication (JWT Bearer or session) via permission classes; the tournament views require login through a decorator; and inputs are validated server-side (registration, match results, tournament scores/nicknames) so no route accepts junk or returns a raw database error. Even the endpoints that don't strictly need auth are CSRF-protected.

### GDPR & Accessibility (slides 30–32)

**Q. (GDPR, slide 31) What GDPR options do you provide?**
A. Three user-facing rights plus retention. **Download My Data** (`export_user_data`) returns a JSON of profile, statistics and full match history. **Anonymize** (`anonymize_account`) replaces username, email, display name and avatar with anonymous values, unlinks 42, disables login and clears the password, but keeps the (non-personal) match statistics. **Delete My Account** hard-deletes the user and cascades to their data. On top, `delete_inactive_users` warns at 5 months of inactivity and deletes at 6 (tracked by `last_activity`), and the About page carries a plain-language privacy policy. All three are in Settings → Data & Privacy / Danger Zone.

**Q. (GDPR) Does anonymization actually work for a 42-login account?**
A. Yes, and we tested it. Anonymize clears `is_42_user` and `intra_id` along with the rest, so the old account can't be recognised as a 42 user. And our 42 login path (`get_or_create_42_user`) only matches **active** accounts by email, so a returning 42 user is given a brand-new account rather than being re-linked to the anonymized one; a username clash falls back to `<login>_<intra_id>`. So a 42 user can exercise their right to be forgotten and still log in again later as a fresh user.

**Q. (Accessibility, slide 32) What did you do for browser compatibility and SSR?**
A. **Browser compatibility** (Minor): we stick to standard, widely-supported APIs — ES modules, WebGL, `fetch`, `localStorage` — with no Chrome-only features, and we tested and ran the whole app on both **Chrome and Firefox**, fixing anything that differed (e.g. date parsing). **SSR** (Minor): the Django `index` view is route-aware — from the request path it decides which page to render, sets the `<title>` and meta description, marks the correct page active, and for a logged-in request pre-renders the profile data (username, join date, stats, recent matches) into the HTML — so the first paint has real server-rendered content and is SEO-friendly, then the SPA hydrates and takes over routing. It's true server-side rendering of the initial page, not just shipping an empty shell.

### Testing, audit & limitations — no dedicated slide any more, but expect these

**Q. (Testing) What is your testing strategy?**
A. Four layers. **Unit** — 54 Django tests (userapp 41, tournaments 10, gameapp 3) covering auth, 2FA, OAuth state, GDPR, validation, tiebreakers, presence, SSR. **Integration** — a scripted end-to-end API run: register → login → profile → save matches → friends → export → tournament → delete, all checked for 2xx. **Browser** — a headless-Chrome walkthrough of every page and both games that fails on any JS error. **Manual / acceptance** — the four of us continuously testing each other's features, on Chrome and Firefox.

**Q. (Limitations) What are the honest limitations?**
A. Both games are **local by design** (we didn't take Remote Players, so no online multiplayer); **JWT lives in localStorage** (XSS exposure — mitigated, not eliminated); some assets (Bootstrap, Three.js, fonts) load from **CDNs**, so the demo wants internet; there's **no rate-limiting/lockout** on login and OTP yet; **scores are reported by the client** (a server-authoritative game would be the Server-Side Pong module); and the GDPR inactivity cleanup is run **manually** because no scheduler is installed in the image.

**Q. (Next steps) What would you do next?**
A. Rate-limiting and account lockout plus 2FA recovery codes; move tokens to httpOnly cookies; make the game server-authoritative on scores; add AI difficulty levels; leaderboards and achievements; vendor the CDN assets locally; and — only if we later add the Remote Players module — real-time play over WebSockets with Django Channels (the ASGI entrypoint is already present).

**Q. (Evolution) You clearly did a lot of fixing near the end — summarise it.**
A. Three passes. An initial audit that root-caused the two reported 2FA bugs (per-process cache × 3 workers; synchronous email). A 30-bug sweep (silent JWT expiry, secrets in logs, duplicate-registration errors, tournament refresh loss, Save Settings, Pong resize/touch/pause leaks, input validation…). And a subject-compliance pass: fixed a stored XSS, made the AI simulate keys at player speed and anticipate bounces, moved DB credentials to `.env`, put login on the tournament routes, added the next-fight announcement, re-added GDPR anonymization (42-safe), built real SSR, added the OAuth `state`, friends presence and unique display names. Every fix has a regression test.

---

### The honest hand-off
If a question is outside your part: "I didn't build that — <name> did, and can explain it precisely," then let them take it. A confident wrong answer costs more than an honest hand-off, and the evaluator can ask that person directly.
