# 04 · Authentication & Security — Nasser (slides 16–19, about 3.5 minutes)

## Slide 16 — Section divider

## Slide 17 — Registration, login and 2FA (screenshots)
- Register: e-mail + username + password; policy ≥ 10 chars, upper-case, digit, symbol, not similar to the username, not common — every failing rule is reported separately.
- Duplicate e-mail/username → clear 400 error (case-insensitive).
- Login: e-mail + password, or "Sign in with 42".
- 2FA: optional at registration; password accounts can toggle it in Settings (42 accounts: no toggle); 6-digit code by e-mail, 10 min, single use.

## Slide 18 — How a login works (three flows, one outcome)
1. **Password + 2FA**
   - `POST /login/` → `authenticate()` (PBKDF2).
   - 2FA on → code stored in a **shared database cache** (10 min), e-mail sent from a background thread → `requires_2fa`.
   - `POST /verify-otp/` → compare, delete code → session + JWT pair.
2. **42 OAuth (authorization-code grant)**
   - Backend builds the authorize URL (client id, redirect URI, `response_type=code`) + a signed `state` kept in the session.
   - Consent on the Intra → redirect to `/oauth/callback?code=…&state=…` (our SPA route).
   - SPA posts code + state → **server** checks the state (single use, 10 min) and exchanges the code with the client secret → `/v2/me` → `get_or_create` user by e-mail → `login()` → JWTs. Secret never reaches the browser; no password stored for 42 users.
3. **JWT**
   - SimpleJWT: access 60 min, refresh 7 days, HS256 with Django `SECRET_KEY`; claims `user_id, exp, iat, jti`.
   - `Authorization: Bearer` on every API call; `authFetch` refreshes 1 min before expiry and retries once on 401.
- Both paths end the same: HttpOnly session cookie + JWT pair.

## Slide 19 — Cybersecurity features
- Password storage: PBKDF2 hash + salt, validator.
- 2FA + JWT (above). 42 OAuth: signed `state` (login CSRF) + server-side exchange.
- SQL injection: ORM only, parameterised queries.
- CSRF: Django token on every state-changing request; XSS: user text via `textContent` (tournament nicknames fixed in the last pass).
- Transport & access: HTTPS on 443; every game / tournament / profile API requires login; secrets in `.env`.

## Be ready for
- Why e-mail OTP and not TOTP? No app to install for evaluators; SMTP already needed; single-use server-side code.
- Why DB cache? 3 Gunicorn workers — LocMem is per process (the bug we fixed).
- OAuth `state` parameter — implemented: signed with `OAUTH_STATE_SECRET`, stored in the session, single use, 10-minute expiry; a missing/forged state → 400 “Invalid OAuth state” and 42 is never contacted.
- JWT in localStorage vs cookies — trade-off; games are separate ES modules that need the Bearer header.
- Rate limiting on OTP — not implemented; attempt counter in cache would be the fix.
- Unique display name — case-insensitive, 400 “Display name already taken”.
- Hand over to Salim: games and graphics.
