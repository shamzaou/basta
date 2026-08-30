# FAST_PONG (ft_transcendence) — Audit Report, 24 Aug 2026

Scope: full audit of the application one week before the staff evaluation — every page,
API endpoint, auth flow, both games, tournaments, GDPR features and
responsive layout — using the running stack (`make build && make up`, https://localhost),
the Django test suite, scripted API flows (curl), a headless-Chrome walkthrough of the SPA
(desktop 1280×800 and mobile 390×844), and code review.

Legend — **Severity**: 🔴 High · 🟠 Medium · 🟡 Low · ⚪ Info. **Status**: ✅ Fixed · 📝 Documented/deferred · 🔒 Blocked externally.

---

## 1. The two reported 2FA bugs (root causes)

### Bug A — "A correct 2FA code is sometimes rejected" · 🔴 · ✅ Fixed

**Root cause (primary): the one-time code was stored in a per-process cache while the
site runs 3 worker processes.**

* `backend/settings.py` defined no `CACHES`, so Django used its default
  `LocMemCache`, which lives in the memory of the *process* that wrote it.
* `scripts/entrypoint.sh` starts Gunicorn with `--workers 3`. `login_view` stored the code
  with `cache.set(f"otp_{user.id}", otp, 300)` in whichever worker handled `/api/auth/login/`;
  `verify_otp` ran `cache.get(...)` in whichever worker handled `/api/auth/verify-otp/`.
  Two thirds of the time that is a *different* process → `cached_otp is None` → "Invalid OTP".
* Reproduced inside the container (two processes, `spawn` context):
  `worker A pid 51 sets otp -> reads back 123456` / `worker B pid 58 reads otp -> None`.
  Gunicorn's log confirmed consecutive requests landing on pids 51/52/53.

**Secondary causes found while tracing the flow**

* Every click on *Sign In* generated a **new random code** and overwrote the cached one.
  With slow email (Bug B) users clicked again, and the code in the first email to arrive
  was already stale.
* `cached_otp == otp` compared the cached `str` with whatever JSON type arrived; whitespace
  from copy-paste and numeric payloads were rejected.
* `verify_otp` returned no `refresh_token`, so the SPA stored the string `"undefined"`.
* 5-minute TTL was short relative to the observed email latency.

**Fix (minimal, in place)** — `backend/settings.py`, `scripts/entrypoint.sh`, `userapp/views.py`:
`CACHES` → `DatabaseCache` (table `django_cache`, created by `manage.py createcachetable` in the
entrypoint, shared by all workers); reuse an unexpired code on repeated login; compare as
stripped strings; TTL → `OTP_TTL_SECONDS` (600 s, overridable in `.env`); include
`refresh_token` in the verify response.

**Proof** — `userapp/tests.py::TwoFactorLoginTests` (cache backend is not per-process; correct
code accepted; whitespace/number tolerated; second login keeps the first code; wrong/expired
code rejected). Live: 5/5 login→verify rounds succeeded on the real 3-worker Gunicorn,
including a round where login hit pid 52 and verify hit pid 51.

### Bug B — "2FA email is very slow to arrive" · 🔴 · ✅ Fixed

**Root cause: the SMTP round-trip to Gmail ran synchronously inside the login request, with
no timeout.**

* `login_view` called `send_mail(..., fail_silently=False)` before returning. The HTTP
  response (and the user's spinner) waited for DNS + TLS handshake + SMTP AUTH + DATA to
  `smtp.gmail.com:587`. Measured on the live stack: **1.86 s** just to be *rejected* by
  Gmail; a successful send is typically 2–6 s and a stalled connection blocks the worker
  indefinitely because `EMAIL_TIMEOUT` was unset.
* Because `fail_silently=False`, any SMTP error turned the login into a **500** with the raw
  SMTP error in the JSON body (observed: `534 5.7.9 WebLoginRequired`).
* Gunicorn `sync` workers handle one request at a time, so each 2FA login also froze one of
  the three workers for the duration.

**Fix** — `send_otp_email_async()` in `userapp/views.py` sends from a daemon thread and logs
failures (`logger.exception`) instead of surfacing them; `EMAIL_TIMEOUT = 10`;
`EMAIL_BACKEND` is now read from `.env` so the flow can be demoed with the console backend.
No Celery/broker introduced.

**Proof** — tests `test_login_returns_before_slow_email_is_delivered` (backend that sleeps
1.5 s; login returns in < 0.1 s, mail still delivered), `test_email_failure_is_logged_not_500`,
`test_email_timeout_is_configured`. Live: `/api/auth/login/` for a 2FA user now returns
**200 in ~80 ms** (was 500 after 1.86 s).

> ⚠️ Actual Gmail delivery still cannot be verified: Google rejects the app password
> (`534 5.7.9 Please log in with your web browser`). Only the account owner can fix that
> (see §5). The code path is verified with the locmem/console backends.

---

## 2. Other issues found and fixed

| # | Sev | Issue | Root cause | Fix / evidence |
|---|-----|-------|-----------|----------------|
| 3 | 🔴 | `make test`, `make migrate`, `make shell`, `make static` all crashed with `ImproperlyConfigured: SECRET_KEY must not be empty` | `docker-compose.yml` set `DJANGO_SETTINGS_MODULE=production_settings` for `exec` commands; `production_settings.py:33` overwrote `SECRET_KEY` with an unset env var. Gunicorn only worked because `entrypoint.sh` re-exports `backend.settings`. | Compose now uses `backend.settings` (what the server actually runs); `production_settings.py` falls back to the `.env` key. ✅ `make test` runs. |
| 4 | 🔴 | Browser was served a **stale `script.js`** (OTP modal button/timeout code from the last commit was missing) | WhiteNoise serves hashed files from `staticfiles/` via the manifest; `entrypoint.sh` skipped `collectstatic` ("causing issues" — it isn't), so `staticfiles/` drifted from `static/`. | `collectstatic` restored in the entrypoint; `staticfiles/` regenerated and committed. |
| 5 | 🟠 | Existing test suite failed (2/2 tournament tests) | Tests asserted tiebreaker matches without calling `Tournament.get_winner()`, the only place they are created; second test also miscounted the `setUp` match. | Tests corrected + one added; 3/3 pass. |
| 6 | ⚪ | Language switcher added then **removed** | During the audit a three-language (EN/FR/RU) switcher was implemented on the assumption that *Multiple language support* was a selected module. The team's actual module list does not include it, so the feature was reverted (template, CSS, `i18n.js`). No trace remains in the code. |
| 7 | ⚪ | GDPR "anonymization" prototyped then **removed** | The module title mentions anonymization but the app only had export + hard delete. An anonymize endpoint/button was implemented during the audit and later removed at the team's request — GDPR is delivered as JSON export, account deletion (cascade) and the inactive-account cleanup command, all covered by `GdprTests`. |
| 8 | 🟠 | Silent token refresh never worked | `script.js` posted to `/api/token/refresh/` (falls into the SPA catch-all → HTML) instead of `/api/auth/token/refresh/`; on failure it called an undefined `logout()` → `ReferenceError`. | Both corrected. |
| 9 | 🟡 | GDPR cleanup cron never runs | `gdpr_cleanup_crontab` exists but no cron daemon is installed in the image. | `make gdpr-cleanup` (dry run) / `make gdpr-cleanup-run` targets; command covered by a test. Still needs a host scheduler (documented). |
| 9b | 🟠 | Editing an unset display name saved **"The Champion"** | `templates/frontend/index.html` hard-coded `value="The Champion"` in the Settings display-name input (and "nickname" in the read-only box); `loadSettingsData` only overwrote them when the user already had a display name, so *Edit → Save* stored the placeholder. | Template value emptied (placeholder instead); `loadSettingsData` always syncs both elements from the server (`data.display_name \|\| ''`). About page: Ali's role corrected to "Backend Developer". |
| 9c | 🟠 | Pong ball got **stuck gliding along the top/bottom wall** in a straight line | `static/frontend/js/pong.js` `GamePhysics.updatePhysics`: the wall check ran *after* the move and only flipped `velocity.z` (×0.9) without moving the ball back inside. Whenever the ball overshot the ±2.9 wall by more than 0.9 × its z-speed it stayed outside, re-flipped every frame and its vertical speed decayed to 0 (Node harness with the real class: final z 3.05, vz 0.0000). Serves were also nearly flat ~25 % of the time (`resetBall` drew vz uniformly in ±0.02). | Clamp `ball.position.z` to the wall, set `velocity.z` explicitly *away* from the wall with a 0.01 minimum, and serve with \|vz\| in [0.01, 0.03] (`pong.js:35-45`, `:74-83`). Post-fix harness: 0 stuck rallies, 0 flat serves. |
| 9d | 🟠 | Profile picture stayed from the **previous account** after switching users in the SPA | `updateNavAvatar()` and the Settings avatar code in `script.js` only set `img.src` when the current account *has* an avatar; with no page reload the previous user's `/api/auth/avatar/<id>/` image simply stayed in the DOM (reproduced headlessly: user A uploads an avatar → logout → login as B → nav and settings still show A's picture). | Both now fall back to the default `man.png` when the account has no avatar, and `handleLogout()` resets the nav avatar. Also removed a doubled `?t=` cache-buster on the settings avatar. |

---

---

## 2b. Second sweep (30 bugs fixed on request, 30 Aug 2026)

After the first audit the team asked for a full bug sweep of the project ("scour the project
for other bugs") and then to fix everything found. Three parallel reviews (SPA, games, backend)
plus live UI scenarios produced 30 findings; all were fixed, each backend fix has a test, and the
whole batch was re-verified through the real UI with headless Chrome. Suite: **34 tests OK** at the time (54 after §2c)
(userapp 26, tournaments 8).

| # | Sev | What was wrong | Root cause | Fix | Where |
|---|-----|----------------|-----------|-----|-------|
| 1 | 🔴 | Plaintext passwords, 2FA codes, cookies and JWTs were written to `gunicorn-error.log` | Debug `print()`s of the registration payload, request headers and OTP values | All secret-leaking prints removed; unexpected errors go to `logger.exception` | `userapp/views.py` (`register_view`, `verify_otp`, `save_match_view`, `create_match`, `get_token`) |
| 2 | 🔴 | After 60 min the app looked logged in but games were no longer saved, friends/export failed | The access JWT expires after 60 min while the session lasts 24 h; the refresh timer was only armed after a 42 login and `getAccessToken()` was never used | `authFetch()` wrapper (fresh token via `getAccessToken()`, Bearer + CSRF, one refresh-and-retry on 401) used by every JWT call; `scheduleTokenRefresh()` after password and OTP login; expired token refreshed on page load, `clearLocalSession()` if that fails | `script.js:1417-1523` (`getAccessToken`, `refreshAccessToken`, `scheduleTokenRefresh`, `authFetch`), `:146` (`load`), `:410` (`clearLocalSession`); games use `window.authFetch` (`pong.js:1007`, `tictactoe.js:145`) |
| 3 | 🟠 | Duplicate email/username at registration → HTTP 500 with the raw Postgres error in the alert | `IntegrityError` caught by a generic `except` that echoed `str(e)` | Case-insensitive existence checks → 400 "Email already registered" / "Username already taken"; `IntegrityError` → 400 | `userapp/views.py:430-433` |
| 4 | 🟠 | Login was case-sensitive on the email local part | Email stored/compared as typed | `email.strip().lower()` at register/login/verify-otp; `email__iexact` lookups | `userapp/views.py` (`register_view`, `login_view`, `verify_otp:341`) |
| 5 | 🟠 | A tournament was lost on browser refresh | Id lived only in a JS variable (and two different variables were used) | `setCurrentTournament()` mirrors the id to `localStorage` + `window`; `showPage('tournament')` resumes it; cleared on logout / Return to Home; dead first `loadTournamentData` and `finishTournamentMatch` removed | `script.js:111-131`, `:2174` |
| 6 | 🟠 | "Save Settings" saved nothing | Submit handler only showed an alert | Submit now PUTs `{display_name, two_factor_enabled}` via `authFetch` | `script.js` settings-form handler (~`:600-640`) |
| 7 | 🟠 | Resizing the window mid-game broke the Pong canvas | A second `handleResize()` (window-sized) overrode the 4:3 container one | Duplicate removed; `GameRenderer.dispose()` removes the resize listener, canvas and GPU context | `pong.js:128-140`, `:381` |
| 8 | 🟠 | Pong unplayable on touch devices | Keyboard-only input | Pointer events on the canvas (`touch-action: none`): left half → paddle 1, right half → paddle 2 (ignored vs AI), multi-touch, vertical position → paddle z | `pong.js:376`, `:551-560`, instructions `:160` |
| 9 | 🟠 | Tournament could end with several "winners" when the tiebreaker round tied again | `get_winner` created a single tiebreak round | Tiebreakers are played in rounds; a fully played, still-level round creates a new round among the remaining players; completed rounds are kept | `tournaments/models.py:18-99` (`get_winner`, `_tiebreak_rounds`, `create_additional_matches`) |
| 10 | 🟠 | `add_players` accepted a second call (corrupt bracket), blank names, >50-char names (HTML 500), and the UI showed a Russian error | No validation, no transaction | Strip names; reject empty ("Nicknames cannot be empty"), too long ("Nickname too long (max 50)"), repeat ("Players already added"); `transaction.atomic()`; DB errors → 400; frontend validates too and shows English messages | `tournaments/views.py:42-81`, `script.js:2115-2165` |
| 11 | 🟠 | `finish_match` compared scores as strings ("10" < "9"), accepted negatives and ties | Values used as sent | `int()` both (400 "Scores must be integers"), reject negatives and equal scores | `tournaments/views.py:174-200` |
| 12 | 🟠 | Inactive-account cleanup never deleted anyone while email was failing | Deletion email sent before `delete()` inside the same `try` | Mail is best-effort in its own `try`; `user.delete()` always runs | `delete_inactive_users.py:73-84` |
| 13 | 🟠 | 2FA could not be enabled/disabled after registration | No endpoint/UI | `two_factor_enabled` in profile GET/PUT; "Security" section with a checkbox in Settings | `userapp/views.py:137`, `:177-178`; `index.html` Settings; `script.js:640`, `:1297` |
| 14 | 🟠 | Every page initialised twice; nav clicks fired `showPage` 2–3× (3 TicTacToe matches created per visit); deep-link reload needed two Back presses | `showPage` called from both `DOMContentLoaded` and `load`; inline `onclick` + global click handler | Single initialisation in `load` (`pushState=false`); inline `onclick`s removed; duplicate listeners removed; friends-tab listeners attached once | `script.js:146`, `:526`, `:1680`; `index.html` nav |
| 15 | 🟠 | Pause key listener leaked across games (desynced pause, SPACE swallowed on other pages) | `keydown` handler never removed | Handler stored as `pauseHandler` and removed in `cleanup()`; pause overlay removed | `pong.js:1144-1150`, `:1201-1213` |
| 16 | 🟠 | Any string accepted as email (`"broken"` became the login) | No `validate_email` | `validate_email` at registration and profile PUT (400 "Invalid email address"); uniqueness checked case-insensitively | `userapp/views.py:166-169`, `:427` |
| 17 | 🟠 | Match dates could render "Invalid Date" outside Chrome | Non-ISO `"24 Aug 2026"` strings parsed with `new Date()` | API returns `date_played.isoformat()`; frontend guards invalid dates | `userapp/views.py:127`, `:783`; `script.js` `loadProfileData` |
| 18 | 🟡 | OTP modal: Enter did not submit, clicking outside closed it for good, button label changed | Input not in a form; `window.onclick` closer | `<form id="otp-form">` (Enter, `inputmode=numeric`, `autocomplete=one-time-code`), Cancel button, outside-click closer removed | `index.html` modal; `script.js:847` |
| 19 | 🟡 | Avatar upload accepted any size/type; errors inside `reader.onload` were lost | No checks client or server side | Client: ≤ 2 MB and `image/*`, try/catch inside `onload`; server: ext whitelist, ≤ 2 MB decoded, Pillow `verify()`, proper `mimetypes` content-type, file saved as `user_<id>.<ext>` (no doubled directory) | `script.js:734`; `userapp/views.py:195-210`, `:896` |
| 20 | 🟡 | `save-match` accepted arbitrary result/score/game_type (raw DB error on overflow) | No validation | Validated against model choices and `\d{1,4}-\d{1,4}` → 400 "Invalid match data" | `userapp/views.py:799-815` |
| 21 | 🟡 | Malformed JSON to `/login/` → 500 with the exception text | Generic `except` | `JSONDecodeError` → 400 "Invalid JSON format"; other errors → 500 "Login failed" (logged) | `userapp/views.py:321-324` |
| 22 | 🟡 | Stale tournament globals after NEXT GAME → Back to `/game` bound a new game to a finished match | Globals never cleared | Cleared on NEXT GAME and in `clearLocalSession()` | `pong.js:1083`; `script.js:410` |
| 23 | 🟡 | `/game`, `/tictactoe`, `/tournament` opened while logged out (results then failed with 401) | Gating list only had profile/settings | Gating list extended | `script.js:19` |
| 24 | 🟡 | After Restart the client POSTed to a bogus `match/game_<ts>/state/` URL; TicTacToe posted every move to a non-existent route | Invented ids; leftover calls | No invented ids; state POST only for integer (tournament) match ids, once per second as intended; TicTacToe `updateMatchState` removed | `pong.js:787`, `:882`; `tictactoe.js` |
| 25 | 🟡 | No winner announcement in normal Pong games | — | `showWinner()` writes "`<name>` wins! p1 - p2" into the HUD; restart restores the hint | `pong.js:1041-1047` |
| 26 | 🟡 | AI difficulty tuning was dead code (`scoreDiff = 0`, `ACCURACY` overwritten, `REACTION_DELAY` unused) | Constructor values discarded on frame 1 | `PongAI(paddle, getScore)` reads the live score: AI ahead by ≥2 → 0.6/0.15/0.10, behind by ≥2 → 0.9/0.05/0.14, else 0.8/0.10/0.12; `REACTION_DELAY` removed; 1 s decision rule kept | `pong.js:666-755` |
| 27 | 🟡 | Password-similarity validator never ran | `validate_password` called without `user=` | `validate_password(password1, user=User(username, email))` | `userapp/views.py:442` |
| 28 | 🟡 | "Find Users" listed inactive accounts; unknown avatar extensions served as `image/jpeg` | — | `.filter(is_active=True)`; `mimetypes.guess_type` | `userapp/views.py:1013`, `:896` |
| 29 | 🟡 | Paddle kept moving after alt-tab with a key held | Key `Set` never reset | Keys cleared on `blur` / `visibilitychange`; listeners removed in cleanup | `pong.js:551-552`, `:652-653` |
| 30 | ⚪ | Misc: `deleteAccount` navigated before its alert; logout skipped the server call without a token; `Token <JWT>` header sent to tournament views; TicTacToe `cleanup()` removed nothing and re-injected its `<style>`; naive `datetime.now()` in export; `make clean` removed a non-existent dir; dead code | — | All corrected (`clearLocalSession()`, logout always POSTs, bound handlers + single `<style>` in TicTacToe, `timezone.now()`, Makefile) | `script.js`, `tictactoe.js:26-38`, `userapp/views.py:997`, `Makefile:65` |

Live verification after the batch (headless Chrome, real UI): expired token → automatic refresh on
load and `authFetch` retry (save-match 201); both tokens invalid → clean logout; duplicate
registration → 400 message; mixed-case registration + lower-case login; invalid email rejected;
tournament survives reload; blank nickname rejected; 3-way tie → 3 tiebreakers, tied again → a
second round of 3; "A wins! 3 - 0" announced; Save Settings persisted; 2FA toggle round-trips;
3 MB avatar rejected; canvas stays 800×600 after a resize; `touch-action: none` on the canvas;
pause overlay and canvas removed on leaving the page; one `match/create` per TicTacToe visit;
logged-out `/profile` → login; 0 JavaScript errors.

## 2c. Subject-compliance fixes (30 Aug 2026)

A line-by-line review of the selected modules and the mandatory part against `en.subject` v15
found the items below; all were fixed on request and re-verified live (two-browser test for the
online game, headless Chrome for the SPA, Node harness for the AI, 54 Django tests).

| # | Subject rule | What was wrong | Fix (file) | Verified |
|---|---|---|---|---|
| C1 | III.4 "protected against XSS" | **Stored XSS**: tournament nicknames were injected with `innerHTML` (`<b id=xss-probe>` rendered as a real element). | `loadTournamentData` builds rows, winner cells, Start buttons and the players list with `createElement`/`textContent` (`script.js:2249-2360`); no user string reaches `innerHTML` anywhere in the SPA. | Live: probe nickname now shown as literal text. |
| C2 | III.3 "the AI must exhibit the same speed as a regular player" | AI paddle moved at `MAX_SPEED` 0.10–0.14 vs the human 0.15. | AI no longer moves the paddle; it presses simulated keys consumed by `InputHandler` at `GAME_CONFIG.paddleSpeed` (`pong.js:626-640`, `:742-753`). Difficulty now changes accuracy/mistakes only (`:755-773`). | Harness: displacement per frame exactly 0.1500. |
| C3 | IV.5 "simulate keyboard input … refresh once per second … anticipate bounces" | `executeMove` set the paddle position directly; prediction was a straight line (no wall bounces). | `PongAI.pressKeys` holds `arrowup`/`arrowdown` in `InputHandler.aiKeys` with a ±0.1 dead-zone; `predictZ` folds the trajectory at the ±2.9 walls (`pong.js:714-741`); `UPDATE_INTERVAL` stays 1000 ms. | Harness: folded prediction matches simulation; AI returns the ball in a 1000-frame rally. |
| C4 | III.4 "credentials … must be saved locally in a .env file" | `docker-compose.yml` committed `POSTGRES_PASSWORD=postgres`. | `db` service now uses `${DB_NAME}/${DB_USER}/${DB_PASSWORD}` substituted from `.env`; unused `DATABASE_URL` removed. | `docker-compose config` resolves from `.env`. |
| C5 | III.4 "ensure your routes are protected" | Tournament API accepted any visitor holding a CSRF cookie. | `require_login` decorator → 401 JSON on all seven tournament views (`tournaments/views.py:14-21`, applied `:33-231`); SPA shows "Please log in" on 401. | Test + live: anonymous create → 401. |
| C6 | III.3 "matchmaking … announce the next fight" | Nothing announced the next match. | `#next-match` line ("Next match: A vs B" / "All matches played") and `.next-match-row` highlight (`script.js:2350`, `index.html:545`). | Live. |
| C7 | IV.6 GDPR "request anonymization of their personal data" | Anonymization had been removed. | `POST /api/auth/anonymize-account/` restored (`userapp/views.py:886-925`) + Settings button (`script.js:858-885`). **42-safe**: `get_or_create_42_user` (`:132-158`) matches only *active* accounts by e-mail and handles username collisions, so an anonymized 42 user who logs in again gets a fresh account and the anonymized row is never re-linked. | Tests `userapp/tests.py` (normal + 42 account); live UI. |
| C8 | IV.4 "Add another game **with user history and matchmaking**" | TicTacToe was hot-seat only — no way to find an opponent. | Online matchmaking: `gameapp.TicTacToeQueue`/`TicTacToeMatch` (`gameapp/models.py:39-85`), `/api/game/ttt/queue/` pairs the waiting player with the closest TicTacToe win-rate (`gameapp/views.py:112-137`), turn-based play through `GET …/match/<id>/` + `POST …/move/` (`:141-192`), forfeit `…/leave/` (`:196-`), `MatchHistory` written for both players on finish (`:96-108`). UI: Local / Online mode selector, queue polling every 2 s, board polling every 1 s (`tictactoe.js:352-556`). | Two headless browsers: queued → matched → X wins → both histories written. 14 gameapp tests. |
| C9 | IV.10 "content is pre-rendered on the server" | Django only served the empty SPA shell. | `gameapp.views.index` (`gameapp/views.py:38-61`) picks the page from the URL, sets `<title>`/`<meta description>` per route, renders the requested page as `active`, pre-fills the profile (stats + last matches via `build_profile_summary`, `userapp/views.py:80-130`) for logged-in sessions, and redirects login-only pages to the login view when anonymous. Template: `index.html:9-17`, `:59-120`. `script.js:152` starts from `body.dataset.ssrPage`. | Tests (title/username in HTML); live fetch of `/profile` contains the username. |

### Subject compliance check (after the fixes)

Mandatory part (III): SPA + Back/Forward ✅ · latest Chrome, no errors and **no warnings** ✅ (verified on every page) · single `docker-compose up --build` ✅ (bind mount `.:/app`; container runs as root — on a 42 Linux cluster keep Docker runtime files in `/goinfre`) · same-keyboard Pong ✅ · tournament shows who plays whom, order, and now the next fight ✅ · aliases per tournament ✅ · AI same speed ✅ (C2) · hashed passwords, ORM, HTTPS, server-side validation ✅ · XSS ✅ (C1) · routes protected ✅ (C5) · credentials in `.env` ✅ (C4; `localhost-key.pem` is a self-signed dev certificate).

Remaining ⚠️ (not fixed, documented): unique display name not enforced (`display_name` has no unique constraint; tournaments use per-tournament nicknames); no friends **online status**; no separate per-session stats dashboard (only the match list and the tournament scoreboard); Bootstrap usage is light; browser-compatibility testing on Firefox/Safari still has to be done by the team.

## 3. Issues documented but deliberately not fixed (📝)

These would require design changes the team should own, or are out of scope for a
recognisable minimal fix. All are listed in the presentation's *Limitations* slide.

| # | Sev | Finding | Detail / recommendation |
|---|-----|---------|-------------------------|
| 10 | ⚪ | Backend is a modular monolith | Three Django apps in one Gunicorn process + one Postgres container. Not a problem: *Designing the backend as microservices* is **not** a selected module. Mentioned only so nobody claims it at the evaluation. |
| 11 | ✅ | ~~Tournament API is unauthenticated~~ | **Fixed (§2c C5)**: every tournament view now requires a logged-in session (`require_login`, 401 JSON). |
| 12 | 🟠 | Mixed auth model | `profile_view`/`user_settings_view` use `@authentication_classes([TokenAuthentication, SessionAuthentication])` → the browser succeeds via the **session cookie**, not the JWT. Other DRF endpoints accept the JWT Bearer through DRF defaults. Django views (`login`, `verify-otp`, tournaments) use sessions/CSRF only. JWTs live in `localStorage` (XSS-readable); since the second sweep they are refreshed automatically (`authFetch`), so expiry no longer breaks the app. |
| 13 | 🟠 | No rate limiting / lockout on `/login/` and `/verify-otp/` | A 6-digit code with a 10-min TTL and no attempt limit is brute-forceable by script. Codes are single-use; recommend attempt counter in the cache + lockout. |
| 14 | 🟡 | Dead / misleading code | `check_auth` (uses `JWT_SECRET_KEY` while tokens are signed with `SECRET_KEY` → always 401; unused by frontend), `oauth_callback` view (unused; hard-codes `redirect_uri=https://localhost:443/home`), `verify_otp_view`, `update_profile`, `gameapp` models, `django_otp` apps, `rest_framework.authtoken` (tokens created but never used), `production_settings.py`, root `wsgi.py`/`wsgi_utils.py`/`check_wsgi.py`, `scripts/init_db.sh`, `backend/asgi.py` + `daphne`. |
| 15 | 🟡 | CDN dependencies | Bootstrap 4.5.2 CSS/JS, jQuery slim, Popper, Three.js r128 and Google Fonts load from CDNs → the demo needs internet. |
| 16 | ✅ | ~~`register_view` prints request headers (cookies, tokens) and full payload to the log~~ | **Fixed in the second sweep (§2b #1)** — no secrets are logged any more. |
| 17 | 🟡 | Cookie flags | `SESSION_COOKIE_SECURE = False` in `settings.py`, `CSRF_COOKIE_SECURE=False` in `.env`, `ALLOWED_HOSTS=*`, although the site is HTTPS-only. |
| 18 | 🟡 | `debug-avatar/<id>/` is public and returns filesystem paths | Information disclosure; remove before production. |
| 19 | 🟡 | `save_match_view` sets `match.metadata`, which is not a model field | Silently ignored; tournament matches are not saved to `MatchHistory` anyway (by design, see `pong.js finishMatch`). |
| 20 | 🟡 | Media files are not served in production | `static(MEDIA_URL…)` only applies when `DEBUG=True`; avatars work only because the SPA rewrites URLs to `/api/auth/avatar/<id>/`. |
| 21 | 🟡 | Unexpected exceptions return `str(e)` to the client in some views (`verify_otp`, profile PUT, friends, …) | Information leak; `login_view`/`register_view`/`save_match_view` were made generic in the second sweep, the rest still echo `str(e)`. |
| 22 | 🟡 | `entrypoint.sh` runs `makemigrations` at every start | Can silently create migrations in a "production" container. Observed on a fresh volume: it wrote `django_otp/plugins/otp_totp/migrations/0003_alter_totpdevice_id.py` *inside site-packages* (django-otp 1.0.0 predates Django 4.2's `DEFAULT_AUTO_FIELD`). Harmless in the container, but prefer committing migrations and running only `migrate` — or drop the unused `django_otp` apps. |
| 23 | 🟡 | Email change through profile PUT is not re-verified; no password reset/change flow | The About page tells users to email support for password changes. |
| 24 | ⚪ | Frontend hygiene | Leftover `// <<<<<<< master` merge-marker comments, `alert()`-driven UX, Russian comments. (The duplicate `loadTournamentData`/`handleResize`, the hard-coded `scoreDiff` and the POSTs to non-existent routes were fixed in the second sweep.) |
| 25 | ✅ | ~~Second game "matchmaking" is local~~ | **Fixed (§2c C8)**: TicTacToe has an online queue with rating-based pairing and turn-based play; Pong stays local (PvP on one keyboard or vs the AI), which is what the mandatory part asks. |
| 26 | ⚪ | Tournaments use nicknames, not accounts | `tournaments.Player` is an alias table; "users across tournaments" = the logged-in user runs a tournament of aliases; tournament games are excluded from personal stats. |

---

## 4. Module verification matrix (post-fix, team's actual selection — 7 Major + 6 Minor = 10 major-equivalents)

| Module | Type | Status | Verified how |
|--------|------|--------|--------------|
| Use a framework as backend (Django) | Major | ✅ | Site serves; 54 tests; scripted API flow (register→login→profile→matches→friends→export→tournament→delete) all 2xx. |
| Front-end framework/toolkit (Bootstrap) | Minor | ✅ (light use ⚠️) | CDN include + `container`/`btn`/`btn-group`/`text-center` classes; most styling is custom `styles.css`. |
| Database for the backend (PostgreSQL) | Minor | ✅ | postgres:13 container, credentials from `.env`, migrations applied (incl. `gameapp 0002`), `django_cache` table created. |
| Standard user management / auth / users across tournaments | Major | ✅ (⚠️ no online status, display name not unique) | Register (duplicate/invalid email → 400, case-insensitive email), login, logout, profile GET/PUT, display name, 2FA toggle, validated avatar upload, friends add/remove/list, stats; tournament round-robin with repeated tiebreak rounds, next-fight announcement, login-protected API, XSS-safe rendering — verified live. |
| Remote authentication (42 OAuth) | Major | ✅ code / 🔒 key | Authorize URL correct; SPA callback + `get-token` exchange via `get_or_create_42_user` (active-only match, username-collision handling) covered by tests; end-to-end login needs the rotated 42 key (§5). |
| Add another game with user history and matchmaking (TicTacToe) | Major | ✅ | Local hot-seat + **online matchmaking** (queue, closest-rating pairing, polling play, forfeit); both players' `MatchHistory` written server-side; profile stats/history include TicTacToe. Two-browser live test + 14 tests. |
| AI opponent (Pong vs AI) | Major | ✅ | Samples the game once per second, predicts the intercept with wall-bounce folding, presses simulated arrow keys at the human paddle speed (no A*); rubber-banding adjusts accuracy only; can win. Node harness + live game. |
| User and game stats dashboards | Minor | ✅ (⚠️ no per-session dashboard) | Profile stat cards, SVG win-rate pie chart, recent-match list (ISO dates), JSON export with statistics; tournament page = per-tournament scoreboard. |
| GDPR (anonymization, local data management, deletion) | Minor | ✅ | Export JSON, **anonymize** (42-safe), delete (cascade), inactivity command — all tested; privacy policy on the About page. |
| 2FA + JWT | Major | ✅ (delivery blocked by Gmail creds) | Both 2FA bugs fixed with regression tests; JWT issuance, automatic refresh (`authFetch`) and validation verified. |
| Advanced 3D (Three.js) | Major | ✅ | WebGL Pong rendered in headless Chrome (screenshot `11-pong-3d-vs-ai.jpg`). |
| Expanding browser compatibility | Minor | ⚠️ untested on Firefox here | Standard ES modules/WebGL/fetch, ISO dates, no Chrome-only APIs found — the team must still test on a second browser before the defense. |
| SSR integration | Minor | ✅ | Route-aware server rendering: per-page `<title>`/`<meta description>`, requested page rendered active, profile pre-filled for logged-in sessions; SPA hydrates afterwards. Tests + live fetch. |

Features that are **not** claimed modules: responsive layout + Pong touch controls ("Support on all devices" was dropped from the selection), friends list.

## 5. Blocked externally (🔒) — needs the humans

1. **42 OAuth client key expired.** Code side verified: `POST /api/auth/redirect_uri/` returns
   `https://api.intra.42.fr/oauth/authorize?client_id=<FORTYTWO_CLIENT_ID>&redirect_uri=https://localhost/oauth/callback&response_type=code`,
   the SPA route `/oauth/callback` exchanges the code at `/api/auth/get-token/` with the same
   `redirect_uri`. After rotating the key: put the new `FORTYTWO_CLIENT_ID` /
   `FORTYTWO_CLIENT_SECRET` in `.env` (the legacy `CLIENT_ID`/`CLIENT_SECRET` keys must also
   exist because `settings.py` reads them), make sure the 42 app's redirect URI is exactly
   `https://localhost/oauth/callback`, then `make down && make up`.
2. **Gmail app password rejected** (`534 5.7.9 WebLoginRequired`). Log in to
   `transcendance.2fa@gmail.com` in a browser, create a new App Password, update
   `EMAIL_HOST_PASSWORD` in `.env`, restart. Until then demo 2FA with
   `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` in `.env` and read the code
   from `gunicorn-error.log` (`grep "OTP for login" gunicorn-error.log | tail -1`).

---

## 6. Verification summary

* `make build && make up` from the committed tree: web + db start, entrypoint runs
  migrate → createcachetable → collectstatic → Gunicorn TLS on 443. `curl -k https://localhost/` → 200.
* `make test`: **54 tests, OK** (userapp 30, gameapp 14, tournaments 10).
* Headless-Chrome walkthrough of every page, both games (incl. a two-browser online TicTacToe match), tournament creation and mobile
  layout: **0 JavaScript errors, 0 console warnings**; screenshots in `presentation/screenshots/`.
* Commits (all on `master`): settings/test fix → 2FA fix → frontend fixes → staticfiles →
  screenshots → docs → language-switcher removal after the team corrected the module list → anonymize removal + display-name fix → Pong wall + avatar fixes → second sweep (30 bugs) → subject-compliance fixes (XSS, AI keyboard simulation, credentials, tournament auth, next fight, anonymization, online matchmaking, SSR).
