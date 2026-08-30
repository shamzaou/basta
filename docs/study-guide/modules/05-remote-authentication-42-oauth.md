# Module — User Management: Implementing a remote authentication (42 OAuth) (Major)

**Verdict: Implemented end-to-end ✅ — final verification blocked by the expired 42 client key 🔒.** The whole flow (authorize link → 42 consent → SPA callback → server-side code exchange → user creation → JWT) is in place and the generated authorize URL was verified; the last step needs the rotated key in `.env`.

## What the module requires (42 subject wording)
Implement a secure remote-authentication system (OAuth 2.0 with the 42 intranet): obtain credentials from the provider, a user-friendly login/authorization flow, secure exchange of the authentication token and user information, following security best practices.

## What it does in FAST_PONG
"Sign in with 42" on the login page sends the user to `api.intra.42.fr/oauth/authorize`; after consent 42 redirects to `https://localhost/oauth/callback?code=…`, the SPA posts the code to the backend, the backend exchanges it for an access token, reads `/v2/me`, creates or finds the user by e-mail, logs them in and returns JWTs. No password is ever stored for 42 users.

## Exactly where it is implemented

| Step | File → function | Ref |
|---|---|---|
| Button handler | `initiate42OAuth()` — clears `oauth_state`/`oauth_pending`, `POST /api/auth/redirect_uri/`, stores `oauth_pending`, `window.location.href = data.oauth_link` | `static/frontend/js/script.js:939-979` |
| Authorize URL builder | `redirect_uri` (POST, `@csrf_exempt`) builds `https://api.intra.42.fr/oauth/authorize?client_id=<FORTYTWO_CLIENT_ID>&redirect_uri=<FORTYTWO_REDIRECT_URI>&response_type=code&state=<signed>e` | `userapp/views.py:480-512`, route `userapp/urls.py:16` |
| Settings | `FORTYTWO_CLIENT_ID`, `FORTYTWO_CLIENT_SECRET`, `FORTYTWO_REDIRECT_URI` from `.env`; legacy `JWT_SETTINGS['CLIENT_ID'/'REDIRECT_URI']` also read (`:238-240`) and must exist in `.env` | `backend/settings.py:274-276` |
| Callback landing | 42 redirects to `https://localhost/oauth/callback` → Django catch-all (`backend/urls.py:16`) renders the SPA → `showPage('oauth/callback')` detects the path, reads `?code=`, calls `checkOAuthLogin()` and shows `home` | `script.js:25-46` |
| Code exchange (client side) | `checkOAuthLogin()` reads `?code=` and `?state=` (`script.js:1069`), strips the query string with `history.replaceState`, `POST /api/auth/get-token/ {code, state}`; stores `authToken`, `refreshToken`, `userData`, `isLoggedIn`; `scheduleTokenRefresh()`; hard-navigates to `/` | `script.js:982-1050` |
| Code exchange (server side) | `get_token` (POST, `@csrf_exempt`): `requests.post('https://api.intra.42.fr/oauth/token', grant_type=authorization_code, client_id, client_secret, code, redirect_uri)` → `requests.get('https://api.intra.42.fr/v2/me', Bearer)` → `User.objects.get_or_create(email=…, defaults={username: login, is_42_user: True, intra_id: id})` → `login(request, user)` → `RefreshToken.for_user` → JSON `{access_token, refresh_token, user}` | `userapp/views.py:584-670`, route `urls.py:18` |
| User model fields | `is_42_user`, `intra_id` | `userapp/models.py:10-11` |
| Unused variant | `oauth_callback` view (GET, server-side redirect flow that sets `jwt_token`/`refresh_token` **HttpOnly cookies** and hard-codes `redirect_uri=https://localhost:443/home`) — not wired to the SPA; the 42 app redirect URI points to the SPA route, not to this view | `userapp/views.py:514-582`, route `urls.py:17` |
| Error handling | non-200 from 42 → `401` with the provider's message (`:612-615`, `:625-628`); exceptions → `500` (`:668-670`); SPA falls back to `showPage('login')` (`script.js:1046-1048`) | |

## How it interacts with the rest
* Produces the same session + JWT pair as password login (`login()` → session cookie for `profile_view`; JWT for DRF endpoints) — see module 09.
* 42 users share the `User` table: friends, match history, GDPR export/delete all apply (`delete_account` `views.py:851` cascades like for any other account).
* A 42 user has `two_factor_enabled=False` and an unusable password (never set), so they cannot use the password form.

## 🆕 Account matching (`get_or_create_42_user`, `userapp/views.py:132-158`)
Both OAuth views now call one helper: it looks up an **active** account by the 42 e-mail (case-insensitive) and otherwise creates one with `create_user(password=None)` (unusable password, `is_42_user=True`, `intra_id`). If the 42 login is already taken as a username, `<login>_<intra_id>` is used. Because anonymized accounts are inactive and no longer carry the e-mail, a returning 42 user gets a fresh account instead of being re-linked (tested in `userapp/tests.py`).

## Security notes (be ready for these)
* **Authorization-code grant**, exchange performed **server-side** with the client secret, which never reaches the browser ✅.
* **🆕 OAuth `state` (CSRF protection on the callback):** `redirect_uri` (`userapp/views.py:586-618`) signs a random value (`signing.dumps({'n': secrets.token_hex(8)}, key=settings.OAUTH_STATE_SECRET, salt='oauth-state')`, `:604`), keeps it in `request.session['oauth_state']` (`:605`) and appends `&state=` to the authorize URL (`:612`). 42 echoes it back on the callback; `checkOAuthLogin()` reads it (`script.js:1069`) and posts `{code, state}` (`:1089`). `get_token` (`views.py:679-704`) pops the session value, requires an exact match and verifies the signature with `max_age=JWT_SETTINGS['STATE_TTL']` (600 s) — otherwise 400 "Invalid OAuth state" and 42 is never contacted; the state is single-use. Setting `OAUTH_STATE_SECRET` (`backend/settings.py:275`, from `.env`, defaults to `SECRET_KEY`). Tests: `OAuthStateTests` (`userapp/tests.py:548`).
* Account linking is **by e-mail**: a 42 login whose e-mail matches an existing password account logs into that account. Acceptable because 42 e-mails are verified, but say it.
* The redirect URI registered on the 42 app must be exactly `https://localhost/oauth/callback` (HTTPS, no port, no trailing slash) and match `FORTYTWO_REDIRECT_URI`.
* `get_token` prints the client id and user data to the log (`:597-598`, `:636`) — log hygiene issue (audit report #16).

## Status after audit
Code path verified: `POST /api/auth/redirect_uri/` returns the correct authorize URL with the configured client id and redirect URI; the SPA route and exchange were exercised in the browser walkthrough up to the point where 42 rejects the expired key. **To finish:** rotate the key on the intra, put the new values in `.env` as `FORTYTWO_CLIENT_ID`/`FORTYTWO_CLIENT_SECRET` (and mirror them in `CLIENT_ID`/`CLIENT_SECRET`), keep `FORTYTWO_REDIRECT_URI=https://localhost/oauth/callback`, then `make down && make up` (`.env` is read only at container start).

## Likely evaluator questions
1. **Walk me through the OAuth flow.** Button → backend builds authorize URL → user consents on 42 → 42 redirects with `code` to our SPA route → SPA posts the code → backend exchanges it with the client secret → reads `/v2/me` → `get_or_create` user → `login()` + JWTs → SPA stores tokens and reloads home.
2. **Why is the code exchanged on the server?** The client secret must stay secret; the browser only ever sees the one-time `code`.
3. **Which OAuth grant?** Authorization code (`response_type=code`, `grant_type=authorization_code`).
4. **What if the same e-mail already has a local account?** `get_or_create(email=…)` links to it; `is_42_user` is only set on creation.
5. **Where is the `state` parameter?** Issued by `redirect_uri` (signed with `OAUTH_STATE_SECRET`, stored in the session, 10-minute TTL, single-use), echoed by 42 on the callback, sent by the SPA with the code and verified by `get_token` before any call to 42 — this blocks login-CSRF on the callback.
6. **What happens if 42 returns an error?** `redirect_uri` sends the user back to `/login`; `get_token` returns 401 with the provider message; the SPA shows the login page.
7. **Why did the demo fail / what changed?** The 42 client key expired after a year; keys are per-app and rotate on the intra. Everything else is unchanged.
8. **Why both an `oauth_callback` view and an SPA route?** Two approaches were tried during development (server-side redirect with cookies vs. SPA + JSON tokens); the SPA one was kept because it fits the token model of the rest of the app. The other view is dead code.
9. **Does a 42 user go through 2FA?** No — 2FA is per-account (`two_factor_enabled`) and defaults to off; 42 already authenticated them.
10. **Why keep tokens in localStorage rather than the cookies the other view sets?** Uniform `Authorization: Bearer` for every fetch, including the ES-module games; the trade-off (XSS exposure) is a listed limitation.
