# FAST_PONG (ft_transcendence) — Audit Report, 24 Aug 2026

Scope: full audit of the application one week before the staff evaluation — every page,
API endpoint, auth flow, both games, tournaments, GDPR features, language switcher and
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
| 6 | 🔴 | **Module "Multiple language support" had no implementation** (no i18n code anywhere) | Never built. | New `static/frontend/js/i18n.js` (EN/FR/RU), `data-i18n` attributes on all static UI strings in `index.html`, `<select class="lang-select">` in both nav lists, persisted in `localStorage`. Verified in headless Chrome (RU nav: Главная / О проекте / Войти / Регистрация). |
| 7 | 🟠 | **GDPR "anonymization" not implemented** (only hard delete + export) | Never built. | `POST /api/auth/anonymize-account/` + "Anonymize My Account" button in Settings → Danger Zone; strips username/email/display name/avatar/42 link, disables login, keeps non-personal match stats. Tests in `GdprTests`. |
| 8 | 🟠 | Silent token refresh never worked | `script.js` posted to `/api/token/refresh/` (falls into the SPA catch-all → HTML) instead of `/api/auth/token/refresh/`; on failure it called an undefined `logout()` → `ReferenceError`. | Both corrected. |
| 9 | 🟡 | GDPR cleanup cron never runs | `gdpr_cleanup_crontab` exists but no cron daemon is installed in the image. | `make gdpr-cleanup` (dry run) / `make gdpr-cleanup-run` targets; command covered by a test. Still needs a host scheduler (documented). |

---

## 3. Issues documented but deliberately not fixed (📝)

These would require design changes the team should own, or are out of scope for a
recognisable minimal fix. All are listed in the presentation's *Limitations* slide.

| # | Sev | Finding | Detail / recommendation |
|---|-----|---------|-------------------------|
| 10 | 🟠 | **"Backend as microservices" is a modular monolith** | Three Django apps in one Gunicorn process + one Postgres container. App boundaries (userapp / gameapp / tournaments) are the only "service" boundaries. Weakest module — prepare the honest framing in `docs/study-guide/modules/08-devops-microservices.md`. |
| 11 | 🟠 | Tournament API is unauthenticated | `tournaments/views.py` endpoints only require a CSRF token; any visitor with the cookie can create/finish matches. Frontend sends `Authorization: Token …` (a *JWT*), which these plain Django views ignore. |
| 12 | 🟠 | Mixed auth model | `profile_view`/`user_settings_view` use `@authentication_classes([TokenAuthentication, SessionAuthentication])` → the browser succeeds via the **session cookie**, not the JWT. Other DRF endpoints accept the JWT Bearer through DRF defaults. Django views (`login`, `verify-otp`, tournaments) use sessions/CSRF only. JWTs live in `localStorage` (XSS-readable). |
| 13 | 🟠 | No rate limiting / lockout on `/login/` and `/verify-otp/` | A 6-digit code with a 10-min TTL and no attempt limit is brute-forceable by script. Codes are single-use; recommend attempt counter in the cache + lockout. |
| 14 | 🟡 | Dead / misleading code | `check_auth` (uses `JWT_SECRET_KEY` while tokens are signed with `SECRET_KEY` → always 401; unused by frontend), `oauth_callback` view (unused; hard-codes `redirect_uri=https://localhost:443/home`), `verify_otp_view`, `update_profile`, `gameapp` models, `django_otp` apps, `rest_framework.authtoken` (tokens created but never used), `production_settings.py`, root `wsgi.py`/`wsgi_utils.py`/`check_wsgi.py`, `scripts/init_db.sh`, `backend/asgi.py` + `daphne`. |
| 15 | 🟡 | CDN dependencies | Bootstrap 4.5.2 CSS/JS, jQuery slim, Popper, Three.js r128 and Google Fonts load from CDNs → the demo needs internet. |
| 16 | 🟡 | `register_view` prints request headers (cookies, tokens) and full payload to the log | `print("Headers:", request.headers)` etc. Privacy/log hygiene. |
| 17 | 🟡 | Cookie flags | `SESSION_COOKIE_SECURE = False` in `settings.py`, `CSRF_COOKIE_SECURE=False` in `.env`, `ALLOWED_HOSTS=*`, although the site is HTTPS-only. |
| 18 | 🟡 | `debug-avatar/<id>/` is public and returns filesystem paths | Information disclosure; remove before production. |
| 19 | 🟡 | `save_match_view` sets `match.metadata`, which is not a model field | Silently ignored; tournament matches are not saved to `MatchHistory` anyway (by design, see `pong.js finishMatch`). |
| 20 | 🟡 | Media files are not served in production | `static(MEDIA_URL…)` only applies when `DEBUG=True`; avatars work only because the SPA rewrites URLs to `/api/auth/avatar/<id>/`. |
| 21 | 🟡 | Unexpected exceptions return `str(e)` to the client (`login_view`, `verify_otp`, …) | Information leak; return generic messages. |
| 22 | 🟡 | `entrypoint.sh` runs `makemigrations` at every start | Can silently create migrations in a "production" container. Observed on a fresh volume: it wrote `django_otp/plugins/otp_totp/migrations/0003_alter_totpdevice_id.py` *inside site-packages* (django-otp 1.0.0 predates Django 4.2's `DEFAULT_AUTO_FIELD`). Harmless in the container, but prefer committing migrations and running only `migrate` — or drop the unused `django_otp` apps. |
| 23 | 🟡 | Email change through profile PUT is not re-verified; no password reset/change flow | The About page tells users to email support for password changes. |
| 24 | ⚪ | Frontend hygiene | Leftover `// <<<<<<< master` merge-marker comments, two definitions of `loadTournamentData` (last wins) and of `GameRenderer.handleResize` in `pong.js` (last wins), `PongAI.updateDifficulty` uses a hard-coded `scoreDiff = 0`, both games POST state to non-existent `/api/game/...` routes (silently ignored), `alert()`-driven UX, Russian comments. Cosmetic; left untouched so the team recognises its code. |
| 25 | ⚪ | Second game "matchmaking" is local | Pong: PvP on one keyboard or vs `PongAI`; TicTacToe: hot-seat X/O. No online queue. Documented in the module guide. |
| 26 | ⚪ | Tournaments use nicknames, not accounts | `tournaments.Player` is an alias table; "users across tournaments" = the logged-in user runs a tournament of aliases; tournament games are excluded from personal stats. |

---

## 4. Module verification matrix (post-fix)

| Module | Type | Status | Verified how |
|--------|------|--------|--------------|
| Django backend | Major | ✅ | Site serves; 19 tests; API flow script (register→login→profile→matches→friends→export→tournament→delete) all 2xx. |
| Bootstrap front-end toolkit | Minor | ✅ (light use) | CDN include + `container`/`btn`/`btn-group`/`text-center` classes; most styling is custom `styles.css`. |
| PostgreSQL | Minor | ✅ | postgres:13 container, migrations applied, `django_cache` table created. |
| Standard user management / auth / tournaments | Major | ✅ | Register, login, logout, profile GET/PUT, display name, avatar endpoint, friends add/remove/list, stats; tournament round-robin verified live. |
| Second game + history + matchmaking | Major | ✅ (local matchmaking) | TicTacToe played headlessly; `MatchHistory` rows created for both games; shown on profile. |
| GDPR | Minor | ✅ | Export JSON, anonymize (🆕), delete, inactivity command — all tested. |
| 2FA + JWT | Major | ✅ (delivery blocked by Gmail creds) | Both bugs fixed with regression tests; JWT issuance/refresh verified. |
| Microservices | Major | ⚠️ | Monolith — see #10. |
| Advanced 3D (Three.js) | Major | ✅ | WebGL Pong rendered in headless Chrome (screenshot `11-pong-3d-vs-ai.jpg`). |
| Responsive | Minor | ✅ | 390×844 walkthrough, hamburger menu works (screenshot 17). |
| Browser compatibility | Minor | ✅ (untested on Firefox here) | Standard ES modules/WebGL/fetch; no Chrome-only APIs found. |
| Multiple languages | Minor | ✅ 🆕 | EN/FR/RU switcher verified. |
| SSR integration | Minor | ✅ (template-level) | Django renders `index.html` with manifest static URLs and CSRF token; SPA takes over. |

---

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
* `make test`: **19 tests, OK** (userapp 16, tournaments 3).
* Headless-Chrome walkthrough of every page, both games, tournament creation, i18n and mobile
  layout: **0 JavaScript errors**; screenshots in `presentation/screenshots/`.
* Commits (all on `master`): settings/test fix → 2FA fix → i18n/GDPR/frontend → staticfiles →
  screenshots → docs.
