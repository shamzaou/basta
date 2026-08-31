# Nasser — speaking script (points)

You present **2 section(s)**, total ≈ **7 min** of speaking time. They come in this order during the talk:

| Order | Your section | Slides | Time |
|---|---|---|---|
| 04 | Authentication & Security | 18–21 | 3.5 min |
| 09 | Testing & Evolution | 35–39 | 3.5 min |

Bullet points only — what to cover on each of your slides. Print this and hold it. Other people speak between your sections.



---
---

# 04 · Authentication & Security — Nasser (slides 18–21, about 3.5 minutes)

## Slide 18 — Section divider

## Slide 19 — Registration, login and 2FA (screenshots)
- Register: e-mail + username + password; policy ≥ 10 chars, upper-case, digit, symbol, not similar to the username, not common — every failing rule is reported separately.
- Duplicate e-mail/username → clear 400 error (case-insensitive).
- Login: e-mail + password, or "Sign in with 42".
- 2FA: optional at registration; password accounts can toggle it in Settings (42 accounts: no toggle); 6-digit code by e-mail, 10 min, single use.

## Slide 20 — How a login works (three flows, one outcome)
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

## Slide 21 — Cybersecurity features
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


---
---

# 09 · Testing & Evolution — Nasser (slides 35–39, about 3.5 minutes)

## Slide 35 — Section divider

## Slide 36 — Testing strategy
- **Unit tests** — `make test`: 54 tests (userapp 41, tournaments 10, gameapp 3): 2FA flow incl. slow/failing mail backends, OAuth `state`, presence, unique display name, password feedback, no 2FA for 42 accounts, JWT on profile, GDPR export/anonymize/delete, inactive-account command, tiebreaker rounds, SSR.
- **Integration** — scripted API flow: register → login → profile → matches → friends → export → tournament → delete.
- **Browser walkthrough** — headless Chrome on every page, desktop + phone, both games, 0 JS errors.
- **Manual / acceptance** — cross-testing each other's features in Chrome and Firefox.

## Slide 37 — Pre-evaluation audit (Aug 2026): two root-caused bugs
- **"2FA code sometimes rejected"** → OTP in per-process LocMemCache × 3 Gunicorn workers → ~2/3 of verifications hit a worker without the code. Fix: DatabaseCache shared by all workers; reuse an unexpired code; TTL 10 min; string normalisation. Regression tests.
- **"2FA e-mail very slow"** → `send_mail` synchronous in the request, no timeout, 500 on SMTP error. Fix: background thread + `EMAIL_TIMEOUT=10` → login ~80 ms.
- Also fixed: `make test` settings, stale static files, refresh URL, "The Champion" display-name bug, ball gliding on the wall, stale avatar after switching users.
- Second sweep: 30 bugs (silent JWT expiry, secrets in logs, duplicate registration, tournament persistence, Save Settings, 2FA toggle, Pong resize/touch/pause, validation).
- Third pass vs the subject: stored XSS via nicknames, AI simulated keys at player speed + bounce prediction, DB creds in `.env`, tournament API login, next-match, anonymization (42-safe), real SSR, no 2FA toggle for 42 accounts, rule-by-rule password errors.
- Final pass: OAuth `state` (signed, single use), online/offline status of friends, unique display name, JWT on profile/settings; the online Tic-Tac-Toe prototype removed — no online play by design, matchmaking = tournaments. 54/54 green.

## Slide 38 — Challenges and lessons
- Tournament logic; state management in vanilla JS; async flows (OAuth, 2FA, heartbeat); Docker networking; multi-process bugs only visible on the real deployment.
- Lessons: clear API, mature framework, disciplined Git, security from day one.

## Slide 39 — Limitations and next steps (say them before they are asked)
- Both games local by design (no remote-players module); JWT in localStorage; no OTP rate limit; CDN assets; Gmail app password needed; client-reported Pong scores; GDPR cleanup run by hand.
- Next: rate limiting + 2FA recovery codes; server-authoritative scores; AI difficulty selector; leaderboards, achievements; only if remote players were added — WebSockets (Channels).
- Hand over to Ali for the team and conclusion.
