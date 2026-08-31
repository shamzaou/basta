# Nasser — speaking script (full)

You present **2 section(s)**, total ≈ **7 min** of speaking time. They come in this order during the talk:

| Order | Your section | Slides | Time |
|---|---|---|---|
| 04 | Authentication & Security | 18–21 | 3.5 min |
| 09 | Testing & Evolution | 35–39 | 3.5 min |

Other people speak between your sections — wait for the hand-over, then take the clicker. The `full/` wording is to rehearse, not to read aloud on the day; keep the `points/` version in your hand.



---
---

# 04 · Authentication & Security — Nasser (slides 18–21, about 3.5 minutes)

---

## Slide 18 — Section divider

Thanks, Salim. I'm Nasser. I built authentication: the accounts, the 42 OAuth login, two-factor authentication and the JWT layer. This section covers three modules: standard authentication, remote authentication, and 2FA + JWT.

---

## Slide 19 — Registration, login and 2FA

Three screens.

**Registration.** E-mail, username and password. The password policy is enforced server-side by Django validators: at least ten characters, an upper-case letter, a digit and a symbol; not similar to the username or e-mail; not a common password. Every failing rule is reported separately, so the user sees exactly why a password was refused. Duplicate e-mails or usernames — compared case-insensitively — return a clear 400 error instead of a database exception. During registration the user can tick "Enable two-factor authentication"; password accounts can toggle it later in Settings. 42 accounts have no 2FA toggle — their login is the Intra's.

**Login.** E-mail and password, or "Sign in with 42".

**Second factor.** If 2FA is on, a six-digit code is e-mailed. It is valid for ten minutes and single-use; the modal accepts Enter and has a Cancel button.

---

## Slide 20 — How a login works

Three flows, one outcome: a logged-in user with a session and a JWT pair.

**Flow one — password plus 2FA.** `POST /api/auth/login/` with e-mail and password calls Django's `authenticate()`, which checks the PBKDF2 hash. If 2FA is off, we call `login()` and return the tokens. If 2FA is on, we generate a six-digit code and store it in a **database-backed cache** for ten minutes — the cache is shared by all Gunicorn workers, which matters, and I'll come back to why in the testing section. The e-mail is sent from a background thread, so the response comes back in about eighty milliseconds with `requires_2fa: true`. No session, no token yet. The SPA shows the modal; `POST /verify-otp/` compares the code, deletes it so it cannot be replayed, then creates the session and returns the JWT pair.

**Flow two — remote authentication with 42.** It's the OAuth 2.0 authorization-code grant. Clicking "Sign in with 42" asks the backend for the authorize URL — client id, redirect URI, `response_type=code` — plus a `state`: a signed, random, time-limited value that the backend also remembers in the session. The browser goes to the Intra. The student consents; 42 redirects to `https://localhost/oauth/callback?code=…&state=…`, which is a route of our SPA. The SPA posts code and state to `/get-token/`; the **server** first checks that the state is the one it issued to this browser — single use, ten-minute expiry, otherwise 400 and 42 is never contacted — then exchanges the code with the client secret — the secret never reaches the browser — then calls `/v2/me`, finds or creates the user by e-mail, calls `login()`, and returns the same JWT pair. A 42 user has no password at all.

**Flow three — the tokens.** SimpleJWT issues an access token valid sixty minutes and a refresh token valid seven days, signed HS256 with the Django secret; the claims are `user_id`, `exp`, `iat` and `jti`. The SPA stores them and sends `Authorization: Bearer` on every API call — games, profile, friends, GDPR. A helper called `authFetch` refreshes the access token one minute before it expires and retries once after a 401, so a session no longer dies silently after an hour.

Both paths end in the same state: an HttpOnly session cookie plus the JWT pair. After login, a 42 user and a password user are indistinguishable.

---

## Slide 21 — Cybersecurity features

Security in layers.

**Password storage** — PBKDF2 with a salt, never plaintext, plus the validator I mentioned.

**2FA and JWT** — as described.

**42 OAuth** — a signed `state` protects the callback against login CSRF; the server does the exchange; we never see a 42 password.

**SQL injection** — every database access goes through the ORM, which parameterises queries. There is no raw SQL in the project.

**CSRF and XSS** — Django's CSRF middleware requires the token on every state-changing request; the SPA reads it from the cookie. For XSS, user-supplied text — names, nicknames — is inserted with `textContent`, never as HTML. A stored XSS through tournament nicknames was found and fixed in the last compliance pass.

**Transport and access control** — HTTPS everywhere, Gunicorn terminating TLS on 443; every game, tournament and profile API requires an authenticated user; secrets — database credentials, the 42 client secret, the mail password — live in `.env`, not in the code.

Salim will now show the games and the graphics.

---

## If they ask

- *"Why e-mail OTP and not an authenticator app?"* — No app to install for evaluators; we already needed SMTP for the GDPR notices; the code is generated and checked server-side and is single-use. TOTP is a straightforward upgrade.
- *"Why is the code in a database cache?"* — Because Gunicorn runs three worker processes and Django's default cache is per-process. A code stored by worker A was invisible to worker B — that was our "code sometimes rejected" bug. The DB cache is shared with no new infrastructure; Redis would be the scale-up.
- *"Where is the OAuth `state` parameter?"* — In `redirect_uri`: `signing.dumps` of a random nonce with `OAUTH_STATE_SECRET`, stored in the session and appended to the authorize URL. `get_token` pops it from the session, compares it with the posted value and checks the signature and a ten-minute `max_age`. Missing or forged → 400 "Invalid OAuth state"; it is single-use. Three tests cover it.
- *"Why JWT in localStorage?"* — The games are separate ES modules that need the Bearer header; cookies would be safer against XSS. We mitigate with HTTPS, textContent rendering and no third-party scripts except CDNs. Listed as a limitation.
- *"Why no 2FA for 42 accounts?"* — They have no password on our side; the Intra authenticates them (with its own 2FA). Settings hides the toggle and the API refuses it for 42 accounts.
- *"Brute-forcing the six-digit code?"* — Only the 10-minute TTL and single use today; an attempt counter in the cache with lockout is the fix.
- *"Which endpoints validate the JWT?"* — All DRF views with the default authentication classes: matches, friends, GDPR, heartbeat. Profile and settings accept the JWT or the session, so the browser session and the JWT together make a full UI session. Logout clears both; access tokens expire naturally.
- *"What's in a JWT?"* — Header, payload with `user_id / exp / iat / jti / token_type`, HMAC-SHA256 signature over both with the server secret. The server verifies the signature and expiry on every request; no DB lookup for the token itself.


---
---

# 09 · Testing & Evolution — Nasser (slides 35–39, about 3.5 minutes)

---

## Slide 35 — Section divider

Thanks, Salim. Last technical section: how we test, what the pre-evaluation audit found, what we learned, and what we would do next.

---

## Slide 36 — Testing strategy

Four levels.

**Unit tests** — the Django test suite, `make test`. Fifty-four tests across the three apps: forty-one in `userapp`, ten in `tournaments`, three in `gameapp`. They cover login and the whole 2FA flow — including a slow mail backend and a failing one — the OAuth `state` check, the presence heartbeat, unique display names, rule-by-rule password feedback, the missing 2FA toggle for 42 accounts, JWT on the profile, GDPR export, anonymize and delete, the inactive-account command, tournament tiebreaker rounds, and server-side rendering.

**Integration** — a scripted end-to-end API flow: register, login, profile, matches, friends, export, tournament, delete — every step expected 2xx.

**Browser walkthrough** — headless Chrome drives every page at desktop and phone sizes, plays both games and asserts zero JavaScript errors.

**Manual acceptance** — we tested each other's features as end users, in Chrome and Firefox.

---

## Slide 37 — Pre-evaluation audit

Before the evaluation we audited the code end-to-end. Two bugs that users had reported were traced to root causes and fixed with regression tests — I'll tell both stories because they're instructive.

**"The 2FA code is sometimes rejected."** The one-time code was stored in Django's default cache, `LocMemCache`, which is memory private to each process. Gunicorn runs three workers. Login stored the code in worker A; the verify request landed on worker B or C, which had never seen it — so roughly two out of three correct codes were rejected. We reproduced it inside the container: worker A sets, worker B reads `None`. The fix is a database-backed cache shared by all workers, plus three secondary fixes: re-clicking Sign In reuses the still-valid code instead of generating a new one, the TTL went from five to ten minutes, and the comparison normalises whitespace and type. There's a test asserting the cache backend is not LocMem, and five out of five live rounds across different worker PIDs passed.

**"The 2FA e-mail is very slow."** `send_mail` ran synchronously inside the login request with no timeout. The response waited for the full SMTP round trip — 1.9 seconds just to be rejected by Gmail — and any SMTP error became a 500. With three sync workers, one slow mail call also blocked a third of the server. The fix: send from a daemon thread with `EMAIL_TIMEOUT` of ten seconds; failures are logged. Login now answers in about eighty milliseconds; a test with a 1.5-second fake mail backend proves the response returns first.

Then the smaller items — `make test` configuration, stale static files, the token-refresh URL, a settings bug that saved the placeholder "The Champion" as the display name, the Pong ball gliding along the wall, the previous account's avatar staying visible.

A second sweep found and fixed thirty more bugs — the silent JWT expiry after sixty minutes, secrets in logs, duplicate-registration errors, tournament persistence, Save Settings, the 2FA toggle, Pong resize, touch and pause leaks, input validation.

And a third pass checked every module against the subject text: a stored XSS through tournament nicknames was fixed, the AI now presses simulated keys at player speed and anticipates bounces, database credentials moved to `.env`, the tournament API requires login, the next-match announcement was added, GDPR anonymization was made 42-safe, 42 accounts lost the 2FA toggle, password errors became rule-specific, and real SSR was completed. A final pass added the OAuth `state` parameter, the online/offline status of friends, unique display names and JWT on the profile — and removed an online Tic-Tac-Toe prototype again, because the project has no online play by design and matchmaking is the tournament system. Fifty-four of fifty-four tests pass, zero JavaScript errors.

---

## Slide 38 — Challenges and lessons learned

Tournament logic — fair schedules and correct tie resolution needed careful modelling. State in vanilla JS — without a framework, login state, routing and views are managed by hand. Asynchronous flows — OAuth redirects, 2FA, the presence heartbeat. Docker networking. And the one I'd underline: **multi-process bugs** — the 2FA cache bug does not exist with one worker; it only appears on the real deployment. Test on what you ship.

Lessons: a well-defined API, a mature framework, a disciplined Git workflow and security from day one all paid off.

---

## Slide 39 — Limitations and future enhancements

I'd rather state these than have you find them.

Both games are local by design — the remote-players module is not selected, so there is no online play; friends only get an online status. JWTs are in `localStorage`. There is no rate limit on the 2FA code. Third-party assets come from CDNs. The 2FA mailbox needs a valid Gmail app password. Pong scores are reported by the client. The GDPR cleanup command is run by hand, not by a cron inside the image.

Next steps, in order: rate limiting on login and 2FA, plus recovery codes; server-authoritative Pong scores; a selectable AI difficulty; leaderboards and achievements; and — only if the remote-players module were added — real-time online play with WebSockets through Django Channels.

Ali will close with the team and the conclusion.

---

## If they ask

- *"Show me the tests."* — `make test` → "Ran 54 tests … OK". Files: `userapp/tests.py`, `gameapp/tests.py`, `tournaments/tests.py`.
- *"How do you demo 2FA if Gmail is down?"* — `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` in `.env`, restart, read the code from `gunicorn-error.log`. The code path is identical.
- *"Why a thread and not Celery?"* — One short SMTP call per login doesn't justify a broker and a worker; the thread returns immediately and the timeout bounds it. Trade-off: if the process dies mid-send the mail is lost — it's logged.
- *"Why not Redis for the cache?"* — Zero new infrastructure; the DB cache is shared and fast enough for a code per login. Redis is the scale-up.
- *"Why is the tournament API session-based and the games JWT-based?"* — History: the tournament app predates the JWT module. Both require login now; unifying on JWT is on the backlog.
