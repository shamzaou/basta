# 09 · Testing & Evolution — Nasser (slides 35–39, about 3.5 minutes)

---

## Slide 35 — Section divider

Thanks, Salim. Last technical section: how we test, what the pre-evaluation audit found, what we learned, and what we would do next.

---

## Slide 36 — Testing strategy

Four levels.

**Unit tests** — the Django test suite, `make test`. Fifty-four tests across the three apps: thirty in `userapp`, fourteen in `gameapp`, ten in `tournaments`. They cover login and the whole 2FA flow — including a slow mail backend and a failing one — GDPR export, anonymize and delete, the inactive-account command, tournament tiebreaker rounds, Tic-Tac-Toe matchmaking and move validation, and server-side rendering.

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

And a third pass checked every module against the subject text: a stored XSS through tournament nicknames was fixed, the AI now presses simulated keys at player speed and anticipates bounces, database credentials moved to `.env`, the tournament API requires login, the next-match announcement was added, and GDPR anonymization, online Tic-Tac-Toe matchmaking and real SSR were completed. Fifty-four of fifty-four tests pass, zero JavaScript errors.

---

## Slide 38 — Challenges and lessons learned

Tournament logic — fair schedules and correct tie resolution needed careful modelling. State in vanilla JS — without a framework, login state, routing and views are managed by hand. Asynchronous flows — OAuth redirects, 2FA, matchmaking polling. Docker networking. And the one I'd underline: **multi-process bugs** — the 2FA cache bug does not exist with one worker; it only appears on the real deployment. Test on what you ship.

Lessons: a well-defined API, a mature framework, a disciplined Git workflow and security from day one all paid off.

---

## Slide 39 — Limitations and future enhancements

I'd rather state these than have you find them.

Pong is local multiplayer only — online play exists for Tic-Tac-Toe, not Pong. Matchmaking and online moves use one-to-two-second polling, not WebSockets. JWTs are in `localStorage`. The 42 OAuth flow has no `state` parameter. There is no rate limit on the 2FA code. Third-party assets come from CDNs. The 2FA mailbox needs a valid Gmail app password. Pong scores are reported by the client.

Next steps, in order: real-time online Pong and live chat with WebSockets through Django Channels; the OAuth `state` parameter and rate limiting on login and 2FA; server-authoritative Pong scores; a selectable AI difficulty; and leaderboards, achievements and 2FA recovery codes.

Ali will close with the team and the conclusion.

---

## If they ask

- *"Show me the tests."* — `make test` → "Ran 54 tests … OK". Files: `userapp/tests.py`, `gameapp/tests.py`, `tournaments/tests.py`.
- *"How do you demo 2FA if Gmail is down?"* — `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` in `.env`, restart, read the code from `gunicorn-error.log`. The code path is identical.
- *"Why a thread and not Celery?"* — One short SMTP call per login doesn't justify a broker and a worker; the thread returns immediately and the timeout bounds it. Trade-off: if the process dies mid-send the mail is lost — it's logged.
- *"Why not Redis for the cache?"* — Zero new infrastructure; the DB cache is shared and fast enough for a code per login. Redis is the scale-up.
- *"Why is the tournament API session-based and the games JWT-based?"* — History: the tournament app predates the JWT module. Both require login now; unifying on JWT is on the backlog.
