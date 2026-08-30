# Quick drill — rapid-fire Q&A (ordered by likelihood)

Answers describe the code **as it is after the Aug-2026 audit**. Items marked 🆕 are behaviour that changed in the audit — know them, they are the freshest code in the repo.

## A. The big picture (almost certain to be asked)

1. **What is the project?** FAST_PONG — a single-page web app around 3D Pong (Three.js) with an AI opponent, accounts with e-mail 2FA and 42 OAuth login, friends, match history/stats dashboard, round-robin tournaments with tie-breakers, and GDPR tools. Django + PostgreSQL in Docker, served over HTTPS by Gunicorn. (TicTacToe exists as an extra game — not a claimed module.)
2. **Which modules?** Majors (6): Django backend, standard user management, remote authentication (42 OAuth), AI opponent, 2FA + JWT, advanced 3D. Minors (7): front-end toolkit (Bootstrap), PostgreSQL, user & game stats dashboards, GDPR, support on all devices, browser compatibility, SSR. 6 + 7×0.5 = **9.5 major-equivalents** (7 required).
3. **Why Django?** Full-stack batteries (ORM, migrations, auth, sessions, CSRF, admin, e-mail) plus DRF/SimpleJWT; Python known by the whole team; fastest path to auth-heavy features. `backend/settings.py`.
4. **Why PostgreSQL?** Subject requirement; transactional, first-class Django backend, one Docker service (`docker-compose.yml:24`).
5. **Why Three.js?** Scene-graph API over WebGL loadable from a `<script>` tag — no bundler, matches our vanilla-JS front-end. `static/frontend/js/pong.js`.
6. **Why Bootstrap?** Required toolkit for the minor; gives `.container`/`.btn` base and responsive defaults; the retro theme is custom CSS. Usage is light — say so.
7. **What SDLC did you follow?** Iterative & incremental development with a GitHub-flow branching model: `master` + short-lived feature branches merged through 15 pull requests (db-connect, game-setup, page-navigation-fix, register-login-reload-fix, tournaments, profile-page, secure-cookies, OAuth, email-address, user-settings, OAuth-Redirect, MatchError, delete-account…), 10 Feb → 8 Mar 2025 plus a final polish commit on 2 Apr 2025; each iteration delivered a working slice (game → auth → tournaments → OAuth/2FA → profile/GDPR), integrated on `master`, then bug-fixed. Evidence: `git log --oneline`, `git shortlog -sne`.
8. **Who did what?** From `git shortlog`: Salim (shamzaou) — front-end/SPA, Docker, integration, GDPR UI, most merges; Nasser — JWT, 2FA, OAuth backend, match statistics; Alisher — user settings, display name, delete account; Nour — tournament app (models/views/UI). (Adjust before presenting.)
9. **How do I run it?** `make build && make up` → https://localhost (self-signed cert). `make test`, `make logs`, `make down`. Config in `.env` (read at start; `make restart` after changes).
10. **What happens on `make up`?** compose starts `db` (postgres:13, volume) and `web`; `scripts/entrypoint.sh` waits for port 5432, runs `makemigrations`, `migrate`, 🆕 `createcachetable`, 🆕 `collectstatic`, then Gunicorn with 3 workers and TLS on 443 serving `wsgi:application`.

## B. Authentication: password, 2FA, JWT, 42 OAuth

11. **How does login work?** `POST /api/auth/login/` (`userapp/views.py:239`): `authenticate(email,password)`; without 2FA → Django `login()` (session cookie) + SimpleJWT access/refresh returned; with 2FA → code cached, e-mail sent, `{requires_2fa:true}`.
12. **How does 2FA work?** 6-digit code in a DB-backed cache for 10 min 🆕, e-mailed in a background thread 🆕; `POST /api/auth/verify-otp/` compares, logs in, issues tokens, deletes the code. Modal in the SPA (`script.js:284`).
13. **What were the two 2FA bugs?** 🆕 (1) *Slow e-mail*: `send_mail` ran synchronously in the request with no timeout → response waited for Gmail; fixed with a thread + `EMAIL_TIMEOUT=10`. (2) *Correct code rejected*: OTP stored in per-process `LocMemCache` while Gunicorn runs 3 workers → verify hit a different worker; fixed with `DatabaseCache` (`django_cache`), plus code reuse on re-login and whitespace-tolerant compare. Both have regression tests in `userapp/tests.py`.
14. **Why a thread and not Celery/Redis?** One short SMTP call per login; a daemon thread returns the response instantly and `EMAIL_TIMEOUT` bounds it. No extra infrastructure to run at evaluation.
15. **Why a DB cache and not Redis?** Shared across workers with zero new services; Redis is the scale-up path.
16. **Why JWT?** Stateless bearer credentials that the game code can attach to API calls; standard claims (`user_id`, `exp`, `jti`); refresh tokens for long sessions. `SIMPLE_JWT` at `backend/settings.py:65`.
17. **Where is the JWT stored?** `localStorage` (`authToken`, `refreshToken`) and sent as `Authorization: Bearer`. Trade-off vs HttpOnly cookies: simpler for ES-module games, but XSS-readable. The unused `oauth_callback` view shows the cookie variant.
18. **Why sessions AND JWT?** Session came with Django `login()` and protects `profile_view` (session auth + CSRF); JWT authenticates DRF views (matches, friends, GDPR). Honest: two mechanisms coexist.
19. **Access/refresh lifetimes?** 60 min / 7 days; refresh at `/api/auth/token/refresh/` (🆕 URL fixed in the SPA), scheduled 1 min before expiry.
20. **How does 42 OAuth (remote authentication) work?** Button → `POST /api/auth/redirect_uri/` builds the authorize URL (`client_id`, `redirect_uri=https://localhost/oauth/callback`, `response_type=code`) → user consents on 42 → redirected to the SPA route `/oauth/callback?code=` → `checkOAuthLogin` posts the code to `/api/auth/get-token/` → server exchanges it at `api.intra.42.fr/oauth/token` with the client secret, reads `/v2/me`, `get_or_create` the user by e-mail (`is_42_user`, `intra_id`), `login()`, returns JWTs → SPA stores them and reloads home. (`views.py:480`, `:583`; `script.js:939`, `:1018`.)
21. **Why OAuth / why 42?** Every evaluator has a 42 account; OAuth delegates password handling to the identity provider; the authorization-code grant keeps the secret server-side.
22. **Why does the 42 login fail today?** The 42 client key expired after a year. Rotate on the intra, set `FORTYTWO_CLIENT_ID`/`FORTYTWO_CLIENT_SECRET` (and `CLIENT_ID`/`CLIENT_SECRET`) in `.env`, `make restart`. The redirect URI on the 42 app must be exactly `https://localhost/oauth/callback`.
23. **Is there a `state` parameter?** No — honest gap (login CSRF). `OAUTH_STATE_SECRET` exists in `.env` but is unused; the fix is to generate/store/verify a random `state` in `redirect_uri`/`get_token`.
24. **What if a 42 e-mail matches an existing local account?** `get_or_create(email=…)` links the login to that account; `is_42_user` is only set on creation.
25. **Password policy?** ≥10 chars, not similar to username/e-mail, not common, not numeric, ≥1 upper/digit/special (`userapp/validators.py`).
26. **CSRF?** Django middleware; SPA reads the `csrftoken` cookie and sends `X-CSRFToken`; `CSRF_TRUSTED_ORIGINS` includes https://localhost.
27. **HTTPS?** Gunicorn terminates TLS with `localhost.pem/localhost-key.pem`; nothing listens on 80.
28. **How would you stop OTP brute force?** Attempt counter in the cache + lockout; rate limiting — not implemented today.

## C. Users, AI, stats, tournaments

29. **Custom user model?** `userapp.User(AbstractUser)`: e-mail login, display name, avatar, 42 ids, `two_factor_enabled`, `last_activity`, friends M2M (`userapp/models.py:6`).
30. **Avatar upload?** Base64 data-URL in a JSON PUT → decoded and saved under `media/profile_pictures/`; served by `/api/auth/avatar/<id>/` with `man.png` default.
31. **Friends?** Non-symmetric M2M; add/remove/list endpoints; "Find Users" tab. No online status.
32. **How does the Pong AI work?** `PongAI` (`pong.js:585`): once per second (`UPDATE_INTERVAL = 1000`) it snapshots ball position + velocity, predicts where the ball crosses the paddle plane, adds an error scaled by `(1-ACCURACY)` and a 10 % random mistake, then every frame moves toward that target at ≤ `MAX_SPEED` — like a human holding a key. Human ↑/↓ are disabled for the AI paddle.
33. **Why does it refresh only once per second?** Subject rule: the AI must simulate human perception and anticipate; the 1 s window forces prediction instead of tracking the ball perfectly.
33b. **Does the AI adapt?** 🆕 Yes: every 5 s `updateDifficulty()` reads the live score — leading by ≥ 2 it plays sloppier (accuracy 0.6, slower), trailing by ≥ 2 it plays sharper (0.9, faster), otherwise 0.8 (`pong.js:733-755`).
33c. **Can you play on a phone?** 🆕 Yes — drag on your half of the canvas (pointer events, `touch-action: none`, multi-touch for two players); keyboard on desktop (`pong.js:551-560`).
33d. **What happens when the tiebreakers tie again?** 🆕 `Tournament.get_winner` plays tiebreak *rounds*: a fully played round that is still level creates a new round-robin among the remaining leaders, until one player has the most tiebreak wins (`tournaments/models.py:18-99`).
34. **Why no A\*?** Pong has no graph to search; the AI uses kinematic prediction (linear extrapolation). A* is forbidden by the subject anyway.
35. **How is AI difficulty tuned?** Constants `ACCURACY`, `MISTAKE_CHANCE`, `MAX_SPEED`; `updateDifficulty()` runs every 5 s but its score-based branch is stubbed (`scoreDiff = 0`) — say it honestly; making it read the real score is a listed improvement.
36. **Can the AI lose?** Yes — prediction error, random mistakes, the 1 s blind window and the ball speeding up 5 % per hit; games are first to 3 points.
37. **Where is the stats dashboard?** `/profile`: Games Played, Win Rate (SVG pie chart), Best Score, last 5 matches with game badge/opponent/score/result/date, friends. Data from `profile_view` (`views.py:76`); chart is hand-drawn SVG (`createWinratePieChart`, `script.js:1913`), no library.
38. **How is win rate / best score computed?** `wins / total × 100` (integer) over non-tournament matches; best score = the win with the largest `user − opponent` margin (`views.py:85-111`). Full stats (wins/losses/draws, all matches) in the JSON export.
39. **Why are tournament games excluded from personal stats?** Tournament players are nicknames, not accounts; tournaments have their own points table (`view_tournament`: 1 point per win).
40. **Match history model?** `MatchHistory(user, game_type PONG/TICTACTOE, opponent, result WIN/LOSS/DRAW, score "a-b", date_played)` written by the games via `POST /api/auth/save-match/` (JWT). The client is trusted for the score — limitation.
41. **How do tournaments work?** Create with 3–8 participants → enter unique nicknames → `combinations()` builds every pairing → "Start Match" launches Pong PvP with those names → `finish/` records score/winner → `view_tournament` computes points.
42. **How are ties handled?** `Tournament.get_winner()` (`tournaments/models.py:18`): if several players share the top score, it creates round-robin *additional* matches among them (`is_additional=True`); the winner of those wins; if still tied, the tied list is shown.
43. **Are tournament players accounts?** No — per-tournament aliases (`tournaments.Player.nickname`, unique per tournament). Only creating the tournament requires login (front-end gate); the tournament API itself is CSRF-only — limitation.
44. **What is TicTacToe?** An extra hot-seat game (`tictactoe.js`) whose results also land in `MatchHistory`; not a claimed module.

## D. GDPR, front-end, DevOps

45. **GDPR features?** Export JSON (`export-data/`, "local data management"), delete (`delete-account/`, hard delete that cascades to match history), inactivity warn 5 mo / delete 6 mo (`delete_inactive_users`, `make gdpr-cleanup`), privacy policy on About. **Why no anonymization?** The module title lists it, but the team chose full deletion: it removes *all* personal data, the strictest form of erasure. (An anonymize endpoint was prototyped during the audit and removed by the team's decision.)
46. **Is the retention cron running?** Not inside the container (no cron in the image); `gdpr_cleanup_crontab` is provided for a host cron; run manually with `make gdpr-cleanup-run`.
46b. **What happens when the JWT expires after 60 minutes?** 🆕 `authFetch` asks `getAccessToken()` for a fresh token (it refreshes via `/api/auth/token/refresh/` when `exp` has passed), the timer from `scheduleTokenRefresh()` renews it a minute early, the `load` handler refreshes on page open, and a 401 triggers one refresh-and-retry; if the refresh token is bad too, `clearLocalSession()` logs the user out cleanly (`script.js:1417-1523`).
47. **How does the SPA router work?** `showPage(pageId)` (`script.js:13`) hides all `.page` divs and shows one, `history.pushState` updates the URL, `popstate` restores; global click handler intercepts `href="/..."` links; on load the path decides the initial page; Django's catch-all serves the same shell for any path. Login-gated pages redirect.
48. **How are pages swapped without reload?** All pages are already in the server-rendered HTML; only `display` toggles. Games are created/destroyed by `initializeGameIfNeeded`.
49. **SSR?** Django renders the whole shell server-side (templates, `{% static %}` hashed URLs, `{% csrf_token %}`); data is fetched client-side. Template-level SSR — say it precisely.
50. **Responsive?** Media queries at 768/480/920/1100 px, hamburger nav, fluid grids, 4:3 canvas sizing. Pong controls are keyboard-only.
51. **Browsers?** Chrome/Edge + Firefox; standard APIs (ES modules, fetch, WebGL, localStorage).
52. **What are the 3D techniques?** Three.js scene graph, perspective camera, Phong materials with emissive glow, ambient + spot lights, procedural canvas texture on the ball, spin physics, edge-geometry border, `requestAnimationFrame` loop, aspect-preserving resize (`pong.js` `GameRenderer`).
53. **Why Gunicorn directly on 443 without nginx?** Fewer moving parts for a local evaluation; WhiteNoise serves static files; a reverse proxy is the first production step.
54. **Where do secrets live?** `.env` (git-ignored) read by python-decouple: Django secret, DB password, Gmail app password, 42 client id/secret, JWT secret. Not baked into the image (bind mount).
55. **Does the site need internet?** Yes for Bootstrap, jQuery/Popper, Google Fonts and **Three.js** (CDN). Vendoring them is a recommended improvement.
56. **How do you test?** `make test` → 17 Django tests (2FA regression, no-2FA login, GDPR export/delete/cleanup, tournament tie-breakers). Audit also ran a curl API flow and a headless-Chrome UI walkthrough (0 JS errors).
57. **What would you improve?** Rate-limit OTP; `state` on OAuth; HttpOnly-cookie JWTs; server-authoritative game results; real AI difficulty adaptation and bounce-aware prediction; touch controls; vendor CDN assets; cron in the image; password reset; `renderer.dispose()`.
58. **What does `production_settings.py` do?** Nothing at runtime — Gunicorn uses `backend.settings`; 🆕 compose now also points `exec` commands there, and the file has a `SECRET_KEY` fallback so it no longer crashes if used.
59. **What is `gameapp` for?** Serves the SPA shell (`index`) and holds unused `Game/Player/Score` models reserved for server-side games.
60. **Is the backend microservices?** No, and we don't claim it — a modular monolith (3 Django apps, one process) with a separate Postgres container.

## Demo commands appendix

```bash
make build && make up            # https://localhost  (accept the self-signed cert)
make logs                        # container logs (entrypoint output)
make test                        # 34 tests
make shell                       # Django shell
make db                          # psql into basta_db  (\dt to list tables)
make gdpr-cleanup                # dry-run inactivity cleanup
make restart                     # after editing .env

# 2FA without Gmail: add to .env, then make restart
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
# the OTP is printed by Gunicorn's captured stdout:
tail -f gunicorn-error.log | grep "OTP for login"

# API smoke (bash): CSRF cookie first, then register/login
curl -sk -c cj -b cj https://localhost/api/auth/register/
CSRF=$(grep csrftoken cj | awk '{print $7}')
curl -sk -c cj -b cj -H "Content-Type: application/json" -H "X-CSRFToken: $CSRF" -H "Referer: https://localhost/" \
  -X POST https://localhost/api/auth/register/ \
  -d '{"username":"demo1","email":"demo1@example.com","password1":"Str0ng!Passw0rd","password2":"Str0ng!Passw0rd","enable_2fa":false}'
# (login rotates the CSRF token: re-read it from the jar before the next POST)
curl -sk -c cj -b cj -H "Content-Type: application/json" -H "X-CSRFToken: $(grep csrftoken cj | awk '{print $7}')" -H "Referer: https://localhost/" \
  -X POST https://localhost/api/auth/login/ -d '{"email":"demo1@example.com","password":"Str0ng!Passw0rd"}'
# then with the access token:
curl -sk -H "Authorization: Bearer <access>" https://localhost/api/auth/match-history/
curl -sk -H "Authorization: Bearer <access>" https://localhost/api/auth/export-data/

# 42 OAuth link (shows client id + redirect uri used)
curl -sk -X POST https://localhost/api/auth/redirect_uri/

# Prove the old cache bug (per-process) vs the fix: see docs/audit-report.md
```

Test accounts to pre-create for the demo: one normal user, one with 2FA enabled, one throw-away for delete; two users to demo friends. For the AI module: Play Now → Player vs AI, play one game to 3 points, then open Profile to show the `vs. AI` row and the win-rate chart.
