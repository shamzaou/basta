# Module — Web: Django as the backend framework (Major)

**Verdict: Works end-to-end ✅** — the whole backend is one Django 4.2 project (`backend/`) with three apps, served by Gunicorn over HTTPS.

## What the module requires (42 subject wording)
"Use a framework for the backend." The chosen framework must be used for the whole backend; the subject names Django as the allowed framework for this major module.

## What it does in FAST_PONG
Django is the *entire* server side: routing, ORM/migrations against PostgreSQL, authentication (custom `User` model), sessions, CSRF, password validation, e‑mail, admin, template rendering of the SPA shell, static-file serving (WhiteNoise), and the JSON API consumed by the SPA (plain Django `JsonResponse` views plus Django REST Framework views with SimpleJWT).

## Exactly where it is implemented

| Concern | File → symbol | Ref |
|---|---|---|
| Project settings | `backend/settings.py` | `AUTH_USER_MODEL` `backend/settings.py:17`, `SECRET_KEY = config('DJANGO_SECRET_KEY')` `:27`, `DEBUG` `:30`, `ALLOWED_HOSTS` `:32` |
| Installed apps | `INSTALLED_APPS` | `backend/settings.py:37` — `userapp`, `gameapp`, `tournaments`, `django_otp` (+`otp_totp`), `rest_framework`, `rest_framework.authtoken`, `django_extensions`, `whitenoise.runserver_nostatic` |
| DRF auth classes | `REST_FRAMEWORK` | `backend/settings.py:56` — JWTAuthentication → TokenAuthentication → SessionAuthentication → BasicAuthentication |
| SimpleJWT | `SIMPLE_JWT` | `backend/settings.py:65` — access 60 min, refresh 7 days, rotate + blacklist flags |
| Middleware stack | `MIDDLEWARE` | `backend/settings.py:73` — Security → **WhiteNoise** (`:75`) → Session → CORS → Common → CSRF → Auth → Messages → XFrame → `UserActivityMiddleware` (`:83`) |
| Root URLconf | `backend/urls.py` | `admin/` `:10`, `api/auth/` → `userapp.urls` `:11`, `tournaments/` → `tournaments.urls` `:12`, catch‑all `re_path(r'^.*$', index)` `:16` |
| SPA shell view | `gameapp/views.py` → `index()` | `gameapp/views.py:3` renders `templates/frontend/index.html` |
| Database | `DATABASES` | `backend/settings.py:93` (`django.db.backends.postgresql`, values from `.env` via `decouple.config`) |
| Password policy | `AUTH_PASSWORD_VALIDATORS` | `backend/settings.py:107` (min length 10 `:118`, custom `userapp.validators.PasswordStrengthValidator` `:128`) |
| Sessions | `SESSION_ENGINE` db | `backend/settings.py:179` |
| Static files | `STATIC_ROOT`, `STATICFILES_STORAGE` | `backend/settings.py:155`, `:311` (`whitenoise.storage.CompressedManifestStaticFilesStorage`) |
| E‑mail | `EMAIL_BACKEND`/`EMAIL_TIMEOUT`/`EMAIL_HOST` | `backend/settings.py:223`, `:225`, `:226` |
| Cache | `CACHES` (DatabaseCache `django_cache`) | `backend/settings.py:296` |
| Config loading | `python-decouple` `config()` | everywhere in `backend/settings.py`; reads `.env` at process start |
| WSGI entry | `wsgi.py` (root) → `get_wsgi_application()` | `wsgi.py` auto-detects `backend.settings`; Gunicorn is started with `wsgi:application` in `scripts/entrypoint.sh:56-66` |
| Process manager | Gunicorn, 3 sync workers, TLS on 443 | `scripts/entrypoint.sh:56-59` |
| Management command | `userapp/management/commands/delete_inactive_users.py` | `Command` `:12` |
| Admin | `userapp/admin.py`, `gameapp/admin.py` | `User` registered with `UserAdmin`; Game/Player/Score registered |
| Tests | `userapp/tests.py`, `gameapp/tests.py`, `tournaments/tests.py` | run via `make test` (57 tests) |

### Two styles of view coexist
* **Plain Django views** (`@require_POST`, `JsonResponse`, `json.loads(request.body)`): `login_view` `userapp/views.py:239`, `verify_otp` `:293`, `register_view` `:364`, `logout_view` `:465`, `redirect_uri` `:481`, `get_token` `:586`, and all of `tournaments/views.py`.
* **DRF `@api_view` views** (`Response`, `request.data`, `IsAuthenticated`): `profile_view` `:76`, `user_settings_view` `:702`, `match_history_view` `:746`, `save_match_view` `:775`, `create_match` `:826`, `delete_account` `:851`, `export_user_data` `:932`, friends views `:993-1079`.

## How it interacts with the rest
* Browser → Gunicorn (TLS) → Django middleware → URL resolver → view → ORM → PostgreSQL (`db` container).
* `templates/frontend/index.html` is rendered once by `index()`; after that the SPA (`static/frontend/js/script.js`) only calls `/api/auth/...` and `/tournaments/api/...`.
* WhiteNoise serves hashed files from `staticfiles/` (manifest `staticfiles/staticfiles.json`), so `collectstatic` must run after any change in `static/`.

**🆕 Changed in Aug-2026 audit:** `scripts/entrypoint.sh:48` now runs `createcachetable` (backs the shared OTP cache) and `:52` runs `collectstatic` on every container start (previously skipped, so `staticfiles/` had drifted from `static/`). `docker-compose.yml:18` now exports `DJANGO_SETTINGS_MODULE=backend.settings` so `make test/migrate/shell` use the same settings as Gunicorn; `production_settings.py:35` falls back to the `.env` secret key instead of crashing.

## Status after audit
Works ✅. **🆕 Second sweep:** input validation everywhere a user can type (`validate_email`, duplicate checks, `save_match` choices/score regex, avatar size/type/Pillow check, tournament nickname/score checks), no secrets in the log, generic error messages on `/login/` and `/register/`, 57 tests (incl. 14 for the online TicTacToe API and SSR). Known oddities (left as-is, documented in `docs/audit-report.md`): `production_settings.py`, `wsgi_utils.py`, `check_wsgi.py`, `scripts/init_db.sh` and the Dockerfile `CMD` are unused leftovers (the compose `entrypoint` overrides them); `gameapp` models (`Game`, `Player`, `Score`) are registered in admin but never written to by the app; `check_auth` uses a different JWT secret and is dead code.

## Likely evaluator questions
1. **Why Django?** Batteries included: ORM + migrations, a mature auth system we could extend (`AbstractUser` at `userapp/models.py:6`), CSRF/session security, admin for debugging, and DRF/SimpleJWT for the API — all in Python, which the team already knew from the 42 curriculum. It let five people ship auth, 2FA, OAuth, GDPR and tournaments in ~7 weeks.
2. **Where does configuration come from?** `python-decouple` reads `.env` (`config('DJANGO_SECRET_KEY')`, `backend/settings.py:27`). Values are read once at process start, so changing `.env` needs `make restart`.
3. **How does a request reach your code?** Gunicorn (`entrypoint.sh:56`) → `wsgi.py` → Django middleware (`settings.py:73`) → `backend/urls.py` → app `urls.py` → view. Anything not matching `/admin/`, `/api/auth/`, `/tournaments/` falls into the catch‑all (`backend/urls.py:16`) which returns the SPA shell — that is what makes deep links like `/profile` work on refresh.
4. **Why both plain Django views and DRF views?** Historical: auth endpoints were written first with `JsonResponse`; later profile/match/friends endpoints used DRF for `IsAuthenticated` and JWT parsing. Both share the same session/JWT identity.
5. **Which ORM models exist?** `userapp.User`, `userapp.MatchHistory`, `tournaments.Tournament/Player/Match`, `gameapp.Game/Player/Score` (unused), plus Django/DRF/OTP tables. See `docs/study-guide/architecture/`.
6. **How do you serve static files without nginx?** WhiteNoise middleware (`settings.py:75`) serves compressed, hashed files from `staticfiles/`; `{% static %}` resolves to the hashed name from the manifest.
7. **Is DEBUG off?** Yes — `.env` `DEBUG=False`; the compose file also sets `DEBUG=0`. Errors surface as JSON messages from the views' `try/except`, not Django debug pages.
8. **Why 3 Gunicorn workers and what did that break?** CPU-bound Python benefits from multiple processes. It exposed that Django's default cache is per-process — the root cause of the "2FA code rejected" bug (see `07-cybersecurity-2fa-jwt.md`).
9. **How are migrations applied?** Automatically on container start (`entrypoint.sh:45-46` runs `makemigrations` then `migrate`) — also `make migrate`.
10. **What is `django_otp` doing?** It is installed (`settings.py:47-48`) but the e‑mail OTP flow is custom (`login_view`/`verify_otp`); `django_otp` only contributes tables. Say so if asked.
