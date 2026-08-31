# Nasser — speaking script (full)

You present **2 section(s)**, total ≈ **~6 min** of speaking time, in this order during the talk:

| Order | Your section | Slides | Time |
|---|---|---|---|
| 04 | Authentication & Security | 16–19 | 3.5 min |
| 08 | GDPR & Accessibility | 30–32 | 2.5 min |

Other people speak between your sections — wait for the hand-over, then take the clicker. The `full/` wording is to rehearse, not to read aloud; keep the `points/` version in your hand.



---
---

# 04 · Authentication & Security — Nasser (slides 16–19, about 3.5 minutes)

---

## Slide 16 — Section divider

Thanks, Salim. I'm Nasser. I built authentication: the accounts, the 42 OAuth login, two-factor authentication and the JWT layer. This section covers three modules: standard authentication, remote authentication, and 2FA + JWT.

---

## Slide 17 — Registration, login and 2FA

Three screens.

**Registration.** E-mail, username and password. The password policy is enforced server-side by Django validators: at least ten characters, an upper-case letter, a digit and a symbol; not similar to the username or e-mail; not a common password. Every failing rule is reported separately, so the user sees exactly why a password was refused. Duplicate e-mails or usernames — compared case-insensitively — return a clear 400 error instead of a database exception. During registration the user can tick "Enable two-factor authentication"; password accounts can toggle it later in Settings. 42 accounts have no 2FA toggle — their login is the Intra's.

**Login.** E-mail and password, or "Sign in with 42".

**Second factor.** If 2FA is on, a six-digit code is e-mailed. It is valid for ten minutes and single-use; the modal accepts Enter and has a Cancel button.

---

## Slide 18 — How a login works

Three flows, one outcome: a logged-in user with a session and a JWT pair.

**Flow one — password plus 2FA.** `POST /api/auth/login/` with e-mail and password calls Django's `authenticate()`, which checks the PBKDF2 hash. If 2FA is off, we call `login()` and return the tokens. If 2FA is on, we generate a six-digit code and store it in a **database-backed cache** for ten minutes — the cache is shared by all Gunicorn workers, which matters, and I'll come back to why in the testing section. The e-mail is sent from a background thread, so the response comes back in about eighty milliseconds with `requires_2fa: true`. No session, no token yet. The SPA shows the modal; `POST /verify-otp/` compares the code, deletes it so it cannot be replayed, then creates the session and returns the JWT pair.

**Flow two — remote authentication with 42.** It's the OAuth 2.0 authorization-code grant. Clicking "Sign in with 42" asks the backend for the authorize URL — client id, redirect URI, `response_type=code` — plus a `state`: a signed, random, time-limited value that the backend also remembers in the session. The browser goes to the Intra. The student consents; 42 redirects to `https://localhost/oauth/callback?code=…&state=…`, which is a route of our SPA. The SPA posts code and state to `/get-token/`; the **server** first checks that the state is the one it issued to this browser — single use, ten-minute expiry, otherwise 400 and 42 is never contacted — then exchanges the code with the client secret — the secret never reaches the browser — then calls `/v2/me`, finds or creates the user by e-mail, calls `login()`, and returns the same JWT pair. A 42 user has no password at all.

**Flow three — the tokens.** SimpleJWT issues an access token valid sixty minutes and a refresh token valid seven days, signed HS256 with the Django secret; the claims are `user_id`, `exp`, `iat` and `jti`. The SPA stores them and sends `Authorization: Bearer` on every API call — games, profile, friends, GDPR. A helper called `authFetch` refreshes the access token one minute before it expires and retries once after a 401, so a session no longer dies silently after an hour.

Both paths end in the same state: an HttpOnly session cookie plus the JWT pair. After login, a 42 user and a password user are indistinguishable.

---

## Slide 19 — Cybersecurity features

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

# 08 · GDPR & Accessibility — Nasser (slides 30–32, about 2.5 minutes)

---

## Slide 30 — Section divider

Thanks, Ali. Nasser again — I will continue on the privacy and accessibility side: the GDPR minor module, and the two accessibility minors — browser compatibility and server-side rendering.

---

## Slide 31 — GDPR compliance

The module title lists three things: anonymization, local data management and account deletion. We have all three, plus retention.

**Anonymization.** "Anonymize My Account" in Settings strips every personal identifier: the username and e-mail become `anon_` plus a random token, the avatar file is deleted, the display name is cleared, the 42 link is removed, the friends lists are cleared, the password is made unusable and the account is disabled and logged out. The non-personal game statistics stay in the database — that is the point of anonymization versus deletion. It works for 42 accounts too: because the 42 e-mail and intra id are removed, the next 42 login creates a fresh account.

**Local data management.** "Download my data" returns a JSON file with the profile, the statistics and the full match history; the SPA adds the avatar as base64. Users can view and edit their display name, e-mail and avatar in Settings.

**Account deletion.** A hard delete after confirmation. The user row goes, and the database cascades: match history, friend links and tokens.

**Retention.** A management command, `delete_inactive_users`, warns by e-mail after five months of inactivity and deletes after six. A middleware stamps `last_activity` at most every fifteen minutes so it doesn't cost a write per request. It runs with `make gdpr-cleanup`.

And information: the privacy policy on the About page lists the data we collect, why, how long, and the user's rights.

---

## Slide 32 — Browser compatibility and server-side rendering

**Expanding browser compatibility.** Our primary browser is Chrome, with Edge as the same engine. The additional browser is **Firefox**. The application uses only standard web APIs — ES modules, `fetch`, `localStorage`, the History API, CSS Grid and Flexbox, WebGL 1 — with no vendor prefixes and no polyfills. We did hit Firefox-specific issues and fixed them: match dates are now ISO-8601 so `new Date()` parses them in Firefox, input uses pointer events instead of separate mouse and touch events, and fonts have fallbacks. Testing was manual in both browsers, plus an automated headless-Chrome walkthrough of every page.

**Server-side rendering.** Every URL is answered by Django's `index` view, which renders the *requested* page as complete HTML: the right section is already active, the navigation reflects whether you are logged in, the `<title>` and meta description are set per page, and for a logged-in user the profile — username, statistics, recent matches — is rendered into the HTML on the server before any JavaScript runs. Then the SPA hydrates and takes over routing. If you view-source `/profile` while logged in, you see real content, not an empty `div`. That gives a faster first paint and crawlable public pages.

**Responsive layout** is on the slide because people will ask: breakpoints at 1100, 920, 768 and 480 pixels, a hamburger menu, a fluid game canvas and touch controls. We kept it as a feature; "support on all devices" is not a module we claim.

Now Ali will close with the team and the conclusion.

---

## If they ask

- *"Anonymize or delete — which one satisfies the module?"* — Both exist; anonymization is what the title names, deletion is the stricter "right to be forgotten".
- *"Is the cleanup cron running in the container?"* — Honestly: the crontab file is provided and the command works, but cron is not installed in the image; retention is enforced when `make gdpr-cleanup-run` is executed. That's a listed limitation.
- *"Is consent collected?"* — Registration implies acceptance; the policy is public. An explicit checkbox and cookie notice would be the improvement; we only use first-party functional cookies.
- *"Why not a real SSR framework?"* — The subject forbids front-end frameworks beyond the toolkit; Django's template engine is the sanctioned server renderer, and it now renders page state, not just a shell.
- *"What breaks on old browsers?"* — ES modules and `aspect-ratio` on IE or very old Safari — out of scope.
