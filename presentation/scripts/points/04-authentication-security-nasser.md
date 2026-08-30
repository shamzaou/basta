# 04 · Authentication & Security — Nasser (slides 18–21, about 3.5 minutes)

## Slide 18 — Section divider

## Slide 19 — Registration, login and 2FA (screenshots)
- Register: e-mail + username + password; policy ≥ 10 chars, upper-case, digit, symbol, not similar to the username, not common.
- Duplicate e-mail/username → clear 400 error (case-insensitive).
- Login: e-mail + password, or "Sign in with 42".
- 2FA: optional at registration, can be toggled in Settings; 6-digit code by e-mail, 10 min, single use.

## Slide 20 — How a login works (three flows, one outcome)
1. **Password + 2FA**
   - `POST /login/` → `authenticate()` (PBKDF2).
   - 2FA on → code stored in a **shared database cache** (10 min), e-mail sent from a background thread → `requires_2fa`.
   - `POST /verify-otp/` → compare, delete code → session + JWT pair.
2. **42 OAuth (authorization-code grant)**
   - Backend builds the authorize URL (client id, redirect URI, `response_type=code`).
   - Consent on the Intra → redirect to `/oauth/callback?code=…` (our SPA route).
   - SPA posts the code → **server** exchanges it with the client secret → `/v2/me` → `get_or_create` user by e-mail → `login()` → JWTs. Secret never reaches the browser; no password stored for 42 users.
3. **JWT**
   - SimpleJWT: access 60 min, refresh 7 days, HS256 with Django `SECRET_KEY`; claims `user_id, exp, iat, jti`.
   - `Authorization: Bearer` on every API call; `authFetch` refreshes 1 min before expiry and retries once on 401.
- Both paths end the same: HttpOnly session cookie + JWT pair.

## Slide 21 — Cybersecurity features
- Password storage: PBKDF2 hash + salt, validator.
- 2FA + JWT (above). 42 OAuth: server-side exchange.
- SQL injection: ORM only, parameterised queries.
- CSRF: Django token on every state-changing request; XSS: user text via `textContent` (tournament nicknames fixed in the last pass).
- Transport & access: HTTPS on 443; every game / tournament / profile API requires login; secrets in `.env`.

## Be ready for
- Why e-mail OTP and not TOTP? No app to install for evaluators; SMTP already needed; single-use server-side code.
- Why DB cache? 3 Gunicorn workers — LocMem is per process (the bug we fixed).
- OAuth `state` parameter — not implemented; explain the fix (random value in session, verified on callback).
- JWT in localStorage vs cookies — trade-off; games are separate ES modules that need the Bearer header.
- Rate limiting on OTP — not implemented; attempt counter in cache would be the fix.
- Hand over to Salim: games and graphics.
