# Module — Cybersecurity: Two-Factor Authentication (2FA) and JWT (Major)

**Verdict: Works end-to-end ✅ (after audit)** — e-mail OTP second factor + SimpleJWT access/refresh tokens. Two production bugs were root-caused and fixed with regression tests. Live e-mail delivery still depends on the Gmail app password (external).

## What the module requires (42 subject wording)
Implement 2FA as an additional security layer (e.g. a one-time code by e-mail/SMS/authenticator) and use JSON Web Tokens for authentication and authorization, with secure token management.

## What it does in FAST_PONG

### 2FA flow (post-fix)
1. User registers with "Enable Two-Factor Authentication" → `User.two_factor_enabled=True` (`userapp/views.py:418-423`).
2. `POST /api/auth/login/` with e-mail+password → `authenticate()`; if 2FA is on:
   * reuse a still-valid code from the **shared DB cache** (`cache.get('otp_<id>')`, `views.py:257-258`) or create a new 6-digit code stored for `OTP_TTL_SECONDS` = 600 s (`:259-261`, `backend/settings.py:303`);
   * send the e-mail **in a background thread** (`send_otp_email_async`, `:263` → `:46-70`) and return immediately `{requires_2fa: true}` (`:265-269`). No session/JWT is issued yet.
3. SPA shows the OTP modal (`script.js:284`), user types the code, `POST /api/auth/verify-otp/ {email, otp}` (`script.js:334`).
4. `verify_otp` normalises the code (`str(...).strip()`, `views.py:298`), compares with the cached value as strings (`:322`), then `login()` (`:324`), creates a DRF token (`:328`), issues SimpleJWT access+refresh (`:329-337`), deletes the code (single use) and returns tokens + user.

### JWT
* Library: `djangorestframework-simplejwt`; settings `SIMPLE_JWT` (`backend/settings.py:65-71`): access 60 min, refresh 7 days, `ROTATE_REFRESH_TOKENS`, `BLACKLIST_AFTER_ROTATION` (blacklist app not installed → rotation happens, blacklisting is a no-op).
* Issued with `RefreshToken.for_user(user)` in `login_view` `:275`, `verify_otp` `:329`, `get_token` (42 OAuth) `:653`, `oauth_callback` `:559`.
* Stored by the SPA in `localStorage` (`authToken`, `refreshToken`) and sent as `Authorization: Bearer <access>` by `authFetch` (`script.js:1499`; the games use `window.authFetch`, `pong.js:1007`, `tictactoe.js:145`).
* Validated by DRF's `JWTAuthentication` (first in `REST_FRAMEWORK` defaults, `settings.py:56-63`) on every `@api_view` view that does **not** override `authentication_classes`: `match_history_view`, `save_match_view`, `create_match`, `delete_account`, `export_user_data`, `get_all_users`, `get_friends`, `add_friend`, `remove_friend`.
* `profile_view` and `user_settings_view` override to `[TokenAuthentication, SessionAuthentication]` (`views.py:75`, `:701`) → in the browser they authenticate through the **session cookie** created by `login()`; the Bearer header is ignored there. Be honest about this.
* Refresh: `TokenRefreshView` at `/api/auth/token/refresh/` (`userapp/urls.py:21`); SPA `refreshAccessToken` (`script.js:1438`), `scheduleTokenRefresh` (refresh 1 min before `exp`, `:1472`) and `getAccessToken` (`:1417`). **🆕 Second sweep:** these are now actually used — every JWT call goes through `authFetch` (`:1499`, retries once after a 401), the timer is armed after password/OTP/42 login and an expired token is refreshed on page load; before, only the 42 path armed the timer and the app silently failed after 60 minutes.
* Also issued: `TokenObtainPairView` at `/api/auth/token/` (`urls.py:19`) — not used by the SPA. `oauth_callback` (`views.py:515-582`) sets HttpOnly JWT cookies but that route is not used (42 redirects to the SPA, which uses `get_token`).
* Legacy: `userapp/utils.py:6` `jwt_required` verifies with `JWT_SETTINGS['JWT_SECRET_KEY']` (different key from SimpleJWT's `SECRET_KEY`) → `check_auth` (`views.py:470`) always rejects; dead code, not called by the SPA.

## Exactly where it is implemented

| Concern | Symbol | Ref |
|---|---|---|
| 🆕 Async mail helper | `send_otp_email_async(user, otp)` — daemon `threading.Thread`, `send_mail(... fail_silently=False)`, `logger.exception` on failure | `userapp/views.py:46-70` |
| Login | `login_view` | `userapp/views.py:238-290` |
| Verify | `verify_otp` | `userapp/views.py:292-361` |
| Unused alt verify | `verify_otp_view` (username-based, not routed) | `userapp/views.py:673-697` |
| 🆕 Shared cache | `CACHES` DatabaseCache `django_cache` | `backend/settings.py:296-301`; table via `scripts/entrypoint.sh:48` |
| 🆕 OTP TTL | `OTP_TTL_SECONDS` (default 600, `.env` overridable) | `backend/settings.py:303` |
| 🆕 E-mail config | `EMAIL_BACKEND` from `.env` (default SMTP), `EMAIL_TIMEOUT=10`, Gmail host/port/TLS/user/password | `backend/settings.py:220-230` |
| SimpleJWT | `SIMPLE_JWT`, DRF defaults | `backend/settings.py:56-71` |
| URLs | `login/ verify-otp/ token/ token/refresh/ logout/` | `userapp/urls.py:12-21` |
| SPA | `handleLogin` `:256`, `handleOTPVerification` `:310` (20 s abort timeout `:328`), token storage, `refreshAccessToken` `:1459`, `scheduleTokenRefresh` `:1490` | `static/frontend/js/script.js` |
| OTP modal | `#otp-modal` | `templates/frontend/index.html:589-598` |
| 2FA checkbox | `#enable_2fa` | `templates/frontend/index.html:488-489` |
| HTTPS | Gunicorn `--certfile localhost.pem --keyfile localhost-key.pem` on 443 | `scripts/entrypoint.sh:56-59` |
| CSRF | `CsrfViewMiddleware`; SPA sends `X-CSRFToken` from the `csrftoken` cookie (`getCookie`, `script.js:180`); `CSRF_TRUSTED_ORIGINS` | `backend/settings.py:79`, `:212-218` |
| Session cookie | HttpOnly, SameSite Lax, 24 h, `SESSION_COOKIE_SECURE=False` | `backend/settings.py:179-186` |
| Password policy | validators | `backend/settings.py:107-130`, `userapp/validators.py` |
| Tests | `TwoFactorLoginTests` (10 tests) + `NoTwoFactorLoginTests` | `userapp/tests.py:58-186` |

## The two reported bugs — root causes and proof

### Bug 1 — "2FA e-mail is very slow to arrive"
* **Root cause:** `login_view` called `send_mail()` **synchronously** inside the request, with no `EMAIL_TIMEOUT`. The HTTP response waited for the full SMTP handshake + TLS + auth + send to Gmail (seconds; 1.9 s just to be *rejected* in the audit; unbounded if Gmail hung), and any SMTP error became a 500 with the raw SMTP message. With 3 sync Gunicorn workers a slow SMTP call also blocked one third of the server.
* **Fix 🆕:** mail is sent from a daemon thread (`views.py:46-70`); `EMAIL_TIMEOUT=10` (`settings.py:225`); failures are logged, not returned. Measured live: login now answers in ~80 ms.
* **Tests:** `test_login_returns_before_slow_email_is_delivered` (`tests.py:147`) uses a backend that sleeps 1.5 s and asserts the response returns sooner and the mail still lands in the outbox; `test_email_failure_is_logged_not_500` (`:160`); `test_email_timeout_is_configured` (`:170`).

### Bug 2 — "A correct 2FA code is sometimes rejected"
* **Root cause:** `settings.py` defined no `CACHES`, so Django used `LocMemCache` — **memory private to each process**. Gunicorn runs `--workers 3`; the worker that handled `/login/` stored the code, and `/verify-otp/` usually landed on another worker whose cache had never seen it → "Invalid OTP" roughly two times out of three. Reproduced in the container: worker A `cache.set` → worker B `cache.get` = `None`.
* **Secondary causes:** (a) clicking "Sign In" again (because the e-mail was slow) generated a *new* random code, so the first e-mail that arrived was already stale; (b) 5-minute TTL was short relative to the delivery delay; (c) comparison did not strip whitespace/accept a numeric JSON value.
* **Fix 🆕:** `CACHES` → `DatabaseCache` table `django_cache` shared by all workers (`settings.py:296`); reuse an unexpired code on re-login (`views.py:257-261`); TTL 10 min; `str(...).strip()` normalisation (`:298`, `:322`).
* **Tests:** `test_otp_store_is_shared_across_worker_processes` (`tests.py:83`, asserts the backend is not LocMem), `test_correct_otp_from_email_is_accepted` (`:90`, also checks single use + `refresh_token`), whitespace/number tolerance (`:106`, `:112`), `test_second_login_does_not_invalidate_first_emailed_code` (`:118`), wrong/expired code rejected (`:128`, `:137`). Live proof: 5/5 login→verify rounds succeeded across different worker PIDs.

## How it interacts with the rest
Every authenticated feature (profile, games, friends, GDPR, tournaments page gate) depends on the tokens/session issued here. The games only carry the JWT. The OAuth path issues the same JWTs so 42 users are indistinguishable afterwards.

## Status after audit
Code path verified with the locmem backend (tests), the console backend (live, OTP read from `gunicorn-error.log`) and the real SMTP backend (login returns 200 and logs the Gmail 534 error). **Actual Gmail delivery** needs a new app password for `transcendance.2fa@gmail.com` — only the team can do that. For the demo without Gmail: set `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` in `.env`, `make restart`, read the code from `gunicorn-error.log`.

**🆕 Second sweep:** users can turn 2FA on/off in Settings (checkbox → `PUT /api/auth/profile/ {two_factor_enabled}`, `userapp/views.py:177-178`); the e-mail is normalised (`strip().lower()`, `email__iexact`) at registration, login and OTP verification, so `Upper.Name@X.com` can log in as `upper.name@x.com`; a bad JSON body to `/login/` returns 400 and unexpected errors a generic 500 (`views.py:321-324`); OTP values are no longer printed to the log.

Limitations to admit: tokens in `localStorage` (XSS-readable) rather than HttpOnly cookies; no rate limiting on `verify-otp` (6 digits, 10 min → brute-force feasible; mitigation: attempt counter in the cache); `SESSION_COOKIE_SECURE=False`; the refresh-token blacklist app is not installed; `check_auth` is dead.

## Likely evaluator questions
1. **Walk me through 2FA.** See flow above; point at `login_view:239`, `send_otp_email_async:46`, `verify_otp:293`, modal `script.js:284`.
2. **Why e-mail OTP and not TOTP/authenticator?** No app to install for evaluators, we already needed SMTP for GDPR notices, and the code is generated server-side and single-use. `django_otp` is installed but unused — a TOTP upgrade path.
3. **Where is the code stored and for how long?** DB-backed cache key `otp_<user_id>` for 10 minutes (`settings.py:296-303`). It is deleted on successful verification.
4. **Why was the code rejected before / why the DB cache now?** Per-process LocMemCache × 3 Gunicorn workers. The DB cache is shared with zero new infrastructure; Redis would be the scale-up option.
5. **Why is the e-mail sent in a thread and not Celery?** A single short SMTP call per login does not justify a broker + worker; a daemon thread inside the Gunicorn worker returns the response immediately and `EMAIL_TIMEOUT` bounds the thread. Trade-off: if the process dies mid-send the mail is lost, and the user is told "check your e-mail" even if SMTP later fails (it is logged).
6. **What is in the JWT?** SimpleJWT claims: `token_type`, `exp`, `iat`, `jti`, `user_id`; signed HS256 with Django `SECRET_KEY`. Access 60 min, refresh 7 days.
7. **Where do you store the JWT and why?** `localStorage`, so the games (separate JS modules) can attach `Authorization: Bearer`. Cookies would be safer against XSS; the unused `oauth_callback` shows the HttpOnly-cookie variant. We mitigate with HTTPS and no third-party scripts except CDNs.
8. **Which endpoints validate the JWT?** All DRF views using the default auth classes (match/friends/GDPR). `profile_view` uses session auth — so the browser session and the JWT are both needed for a full UI session. Logout clears the session and localStorage; access tokens expire naturally.
9. **How do you refresh?** `POST /api/auth/token/refresh/ {refresh}` (SimpleJWT `TokenRefreshView`), scheduled 1 min before expiry by `scheduleTokenRefresh`. 🆕 the SPA previously posted to a wrong URL.
10. **How do you prevent brute-forcing the 6-digit code?** Currently only the 10-min TTL and single use — admit no attempt limit; propose `cache.incr('otp_attempts_<id>')` with lockout.
