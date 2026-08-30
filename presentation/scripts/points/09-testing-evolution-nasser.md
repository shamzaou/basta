# 09 · Testing & Evolution — Nasser (slides 35–39, about 3.5 minutes)

## Slide 35 — Section divider

## Slide 36 — Testing strategy
- **Unit tests** — `make test`: 54 tests (userapp 30, gameapp 14, tournaments 10): 2FA flow incl. slow/failing mail backends, GDPR export/anonymize/delete, inactive-account command, tiebreaker rounds, matchmaking + moves, SSR.
- **Integration** — scripted API flow: register → login → profile → matches → friends → export → tournament → delete.
- **Browser walkthrough** — headless Chrome on every page, desktop + phone, both games, 0 JS errors.
- **Manual / acceptance** — cross-testing each other's features in Chrome and Firefox.

## Slide 37 — Pre-evaluation audit (Aug 2026): two root-caused bugs
- **"2FA code sometimes rejected"** → OTP in per-process LocMemCache × 3 Gunicorn workers → ~2/3 of verifications hit a worker without the code. Fix: DatabaseCache shared by all workers; reuse an unexpired code; TTL 10 min; string normalisation. Regression tests.
- **"2FA e-mail very slow"** → `send_mail` synchronous in the request, no timeout, 500 on SMTP error. Fix: background thread + `EMAIL_TIMEOUT=10` → login ~80 ms.
- Also fixed: `make test` settings, stale static files, refresh URL, "The Champion" display-name bug, ball gliding on the wall, stale avatar after switching users.
- Second sweep: 30 bugs (silent JWT expiry, secrets in logs, duplicate registration, tournament persistence, Save Settings, 2FA toggle, Pong resize/touch/pause, validation).
- Third pass vs the subject: stored XSS via nicknames, AI simulated keys at player speed + bounce prediction, DB creds in `.env`, tournament API login, next-match, anonymization, matchmaking, real SSR. 54/54 green.

## Slide 38 — Challenges and lessons
- Tournament logic; state management in vanilla JS; async flows (OAuth, 2FA, polling); Docker networking; multi-process bugs only visible on the real deployment.
- Lessons: clear API, mature framework, disciplined Git, security from day one.

## Slide 39 — Limitations and next steps (say them before they are asked)
- Pong local only (online exists for Tic-Tac-Toe); polling not WebSockets; JWT in localStorage; no OAuth `state`; no OTP rate limit; CDN assets; Gmail app password needed; client-reported Pong scores.
- Next: WebSockets (Channels) for online Pong + chat; OAuth state + rate limiting; server-authoritative scores; AI difficulty selector; leaderboards, achievements, 2FA recovery codes.
- Hand over to Ali for the team and conclusion.
