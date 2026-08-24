# Quick drill — rapid-fire Q&A (ordered by likelihood)

Answers describe the code **as it is after the Aug-2026 audit**. Items marked 🆕 are behaviour that changed in the audit — know them, they are the freshest code in the repo.

## A. The big picture (almost certain to be asked)

1. **What is the project?** FAST_PONG — a single-page web app around 3D Pong (Three.js) with a second game (TicTacToe), accounts with e-mail 2FA and 42 OAuth, friends, match history/stats, round-robin tournaments with tie-breakers, GDPR tools, three UI languages. Django + PostgreSQL in Docker, served over HTTPS by Gunicorn.
2. **Which modules?** Majors: Django backend, user management, second game, 2FA+JWT, microservices, Three.js 3D. Minors: Bootstrap, PostgreSQL, GDPR, responsive, browser compatibility, multiple languages, SSR. (6 majors + 7 minors = 9.5 major-equivalents.)
3. **Why Django?** Full-stack batteries (ORM, migrations, auth, sessions, CSRF, admin, e-mail) plus DRF/SimpleJWT; Python known by the whole team; fastest path to auth-heavy features. `backend/settings.py`.
4. **Why PostgreSQL?** Subject requirement; transactional, first-class Django backend, one Docker service (`docker-compose.yml:24`).
5. **Why Three.js?** Scene-graph API over WebGL loadable from a `<script>` tag — no bundler, matches our vanilla-JS front-end. `static/frontend/js/pong.js`.
6. **Why Bootstrap?** Required toolkit for the minor; gives `.container`/`.btn` base and responsive defaults; the retro theme is custom CSS. Usage is light — say so.
7. **What SDLC did you follow?** Iterative & incremental development with a GitHub-flow branching model: `master` + short-lived feature branches merged through 15 pull requests (db-connect, game-setup, page-navigation-fix, register-login-reload-fix, tournaments, profile-page, secure-cookies, OAuth, email-address, user-settings, OAuth-Redirect, MatchError, delete-account…), 10 Feb → 8 Mar 2025 plus a final polish commit on 2 Apr 2025; each iteration delivered a working slice (game → auth → tournaments → OAuth/2FA → profile/GDPR), integrated on `master`, then bug-fixed. Evidence: `git log --oneline`, `git shortlog -sne`.
8. **Who did what?** From `git shortlog`: Salim (shamzaou) — front-end/SPA, Docker, integration, GDPR UI, most merges; Nasser — JWT, 2FA, OAuth backend, match statistics; Alisher — user settings, display name, delete account; Nour — tournament app (models/views/UI). (Adjust before presenting.)
9. **How do I run it?** `make build && make up` → https://localhost (self-signed cert). `make test`, `make logs`, `make down`. Config in `.env` (read at start; `make restart` after changes).
10. **What happens on `make up`?** compose starts `db` (postgres:13, volume) and `web`; `scripts/entrypoint.sh` waits for port 5432, runs `makemigrations`, `migrate`, 🆕 `createcachetable`, 🆕 `collectstatic`, then Gunicorn with 3 workers and TLS on 443 serving `wsgi:application`.

## B. Authentication, 2FA, JWT

11. **How does login work?** `POST /api/auth/login/` (`userapp/views.py:239`): `authenticate(email,password)`; without 2FA → Django `login()` (session cookie) + SimpleJWT access/refresh returned; with 2FA → code cached, e-mail sent, `{requires_2fa:true}`.
12. **How does 2FA work?** 6-digit code in a DB-backed cache for 10 min 🆕, e-mailed in a background thread 🆕; `POST /api/auth/verify-otp/` compares, logs in, issues tokens, deletes the code. Modal in the SPA (`script.js:284`).
13. **What were the two 2FA bugs?** 🆕 (1) *Slow e-mail*: `send_mail` ran synchronously in the request with no timeout → response waited for Gmail; fixed with a thread + `EMAIL_TIMEOUT=10`. (2) *Correct code rejected*: OTP stored in per-process `LocMemCache` while Gunicorn runs 3 workers → verify hit a different worker; fixed with `DatabaseCache` (`django_cache`), plus code reuse on re-login and whitespace-tolerant compare. Both have regression tests in `userapp/tests.py`.
14. **Why a thread and not Celery/Redis?** One short SMTP call per login; a daemon thread returns the response instantly and `EMAIL_TIMEOUT` bounds it. No extra infrastructure to run at evaluation.
15. **Why a DB cache and not Redis?** Shared across workers with zero new services; Redis is the scale-up path.
16. **Why JWT?** Stateless bearer credentials that the game modules can attach to API calls; standard claims (`user_id`, `exp`, `jti`); refresh tokens for long sessions. `SIMPLE_JWT` at `backend/settings.py:65`.
17. **Where is the JWT stored?** `localStorage` (`authToken`, `refreshToken`) and sent as `Authorization: Bearer`. Trade-off vs HttpOnly cookies: simpler for ES-module games, but XSS-readable. The unused `oauth_callback` view shows the cookie variant.
18. **Why sessions AND JWT?** Session came with Django `login()` and protects `profile_view` (session auth + CSRF); JWT authenticates DRF views (matches, friends, GDPR). Honest: two mechanisms coexist.
19. **Access/refresh lifetimes?** 60 min / 7 days; refresh at `/api/auth/token/refresh/` (🆕 URL fixed in the SPA), scheduled 1 min before expiry.
20. **How does 42 OAuth work?** Button → server builds authorize URL (`redirect_uri` view) → 42 → `https://localhost/oauth/callback?code=` → SPA catch-all → `POST /api/auth/get-token/` exchanges the code, fetches `/v2/me`, `get_or_create` by e-mail, logs in, returns JWTs. Needs the new client id/secret in `.env`.
21. **Password policy?** ≥10 chars, not similar to username/e-mail, not common, not numeric, ≥1 upper/digit/special (`userapp/validators.py`).
22. **CSRF?** Django middleware; SPA reads the `csrftoken` cookie and sends `X-CSRFToken`; `CSRF_TRUSTED_ORIGINS` includes https://localhost.
23. **HTTPS?** Gunicorn terminates TLS with `localhost.pem/localhost-key.pem`; nothing listens on 80.
24. **How would you stop OTP brute force?** Attempt counter in the cache + lockout; rate limiting — not implemented today.

## C. Users, games, tournaments

25. **Custom user model?** `userapp.User(AbstractUser)`: e-mail login, display name, avatar, 42 ids, `two_factor_enabled`, `last_activity`, friends M2M (`userapp/models.py:6`).
26. **Avatar upload?** Base64 data-URL in a JSON PUT → decoded and saved under `media/profile_pictures/`; served by `/api/auth/avatar/<id>/` with `man.png` default.
27. **Friends?** Non-symmetric M2M; add/remove/list endpoints; "Find Users" tab. No online status.
28. **Match history & stats?** `MatchHistory(user, game_type, opponent, result, score, date)` written by the games via `save-match`; profile computes games played, win rate (pie chart), best score; excludes tournament games.
29. **Second game?** TicTacToe (`tictactoe.js`), hot-seat, result WIN/LOSS/DRAW saved as `TICTACTOE`.
30. **Matchmaking?** Local mode selection (PvP / vs AI) and automatic round-robin pairing in tournaments; no online queue — admit it.
31. **How does the Pong AI work?** Samples the ball once per second, predicts the intercept with error and random mistakes, capped speed (`pong.js:585`).
32. **How do tournaments work?** Create with 3–8 participants → enter unique nicknames → `combinations()` builds every pairing → "Start Match" launches Pong PvP with those names → `finish/` records score/winner → `view_tournament` computes points (1 per win).
33. **How are ties handled?** `Tournament.get_winner()` (`tournaments/models.py:18`): if several players share the top score, it creates round-robin *additional* matches among them (`is_additional=True`); the winner of those wins; if still tied, the tied list is shown.
34. **Are tournament players accounts?** No — per-tournament aliases (`tournaments.Player.nickname`, unique per tournament). Only creating the tournament requires login (front-end gate).

## D. GDPR, i18n, front-end, DevOps

35. **GDPR features?** Export JSON (`export-data/`), 🆕 anonymize (`anonymize-account/`: PII replaced, login disabled, stats kept), delete (`delete-account/`, cascades), inactivity warn 5 mo / delete 6 mo (`delete_inactive_users`, `make gdpr-cleanup`), privacy policy on About.
36. **Is the retention cron running?** Not inside the container (no cron in the image); `gdpr_cleanup_crontab` is provided for a host cron; run manually with `make gdpr-cleanup-run`.
37. **How does i18n work?** 🆕 `static/frontend/js/i18n.js`: EN/FR/RU dictionary, `data-i18n` attributes on static text, `<select class="lang-select">` in the nav, preference in `localStorage.lang`, English fallback, `<html lang>` updated.
38. **How does the SPA router work?** `showPage(pageId)` (`script.js:13`) hides all `.page` divs and shows one, `history.pushState` updates the URL, `popstate` restores; global click handler intercepts `href="/..."` links; on load the path decides the initial page; Django's catch-all serves the same shell for any path. Login-gated pages redirect.
39. **How are pages swapped without reload?** All eight pages are already in the server-rendered HTML; only `display` toggles. Games are created/destroyed by `initializeGameIfNeeded`.
40. **SSR?** Django renders the whole shell server-side (templates, `{% static %}` hashed URLs, `{% csrf_token %}`); data is fetched client-side. Template-level SSR — say it precisely.
41. **Responsive?** Media queries at 768/480/920/1100 px, hamburger nav, fluid grids, 4:3 canvas sizing. Pong controls are keyboard-only.
42. **Browsers?** Chrome/Edge + Firefox; standard APIs (ES modules, fetch, WebGL, localStorage).
43. **Where are your microservices?** Honest: modular monolith — three Django apps with separate REST interfaces and models, co-deployed in one container; DB and cache are separate services; workers stateless. Split plan: per-app compose services behind a gateway, per-service DBs, JWT for cross-service auth.
44. **Why Gunicorn directly on 443 without nginx?** Fewer moving parts for a local evaluation; WhiteNoise serves static files; a gateway is step 1 of the microservice split.
45. **Where do secrets live?** `.env` (git-ignored) read by python-decouple: Django secret, DB password, Gmail app password, 42 client id/secret, JWT secret. Not baked into the image (bind mount).
46. **Does the site need internet?** Yes for Bootstrap, jQuery/Popper, Google Fonts and **Three.js** (CDN). Vendoring them is a recommended improvement.
47. **How do you test?** `make test` → 22 Django tests (2FA regression, no-2FA login, GDPR export/anonymize/delete/cleanup, tournament tie-breakers). Audit also ran a curl API flow and a headless-Chrome UI walkthrough (0 JS errors).
48. **What would you improve?** Rate-limit OTP; HttpOnly-cookie JWTs; server-authoritative game results; real matchmaking queue + WebSockets; split services + gateway; vendor CDN assets; cron in the image; translate dynamic strings; password reset; `renderer.dispose()`.
49. **What does `production_settings.py` do?** Nothing at runtime — Gunicorn uses `backend.settings`; 🆕 compose now also points `exec` commands there, and the file has a `SECRET_KEY` fallback so it no longer crashes if used.
50. **What is `gameapp` for?** Serves the SPA shell (`index`) and holds unused `Game/Player/Score` models reserved for server-side games.

## Demo commands appendix

```bash
make build && make up            # https://localhost  (accept the self-signed cert)
make logs                        # container logs (entrypoint output)
make test                        # 19 tests
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

Test accounts to pre-create for the demo: one normal user, one with 2FA enabled, one throw-away for anonymize, one throw-away for delete; two users to demo friends.
