# 04 · Authentication & Security — Nasser (slides 18–21, about 3.5 minutes)

---

## Slide 18 — Section divider

Thanks, Salim. I'm Nasser. I built authentication: the accounts, the 42 OAuth login, two-factor authentication and the JWT layer. This section covers three modules: standard authentication, remote authentication, and 2FA + JWT.

---

## Slide 19 — Registration, login and 2FA

Three screens.

**Registration.** E-mail, username and password. The password policy is enforced server-side by Django validators: at least ten characters, an upper-case letter, a digit and a symbol; not similar to the username or e-mail; not a common password. Duplicate e-mails or usernames — compared case-insensitively — return a clear 400 error instead of a database exception. During registration the user can tick "Enable two-factor authentication"; it can also be toggled later in Settings.

**Login.** E-mail and password, or "Sign in with 42".

**Second factor.** If 2FA is on, a six-digit code is e-mailed. It is valid for ten minutes and single-use; the modal accepts Enter and has a Cancel button.

---

## Slide 20 — How a login works

Three flows, one outcome: a logged-in user with a session and a JWT pair.

**Flow one — password plus 2FA.** `POST /api/auth/login/` with e-mail and password calls Django's `authenticate()`, which checks the PBKDF2 hash. If 2FA is off, we call `login()` and return the tokens. If 2FA is on, we generate a six-digit code and store it in a **database-backed cache** for ten minutes — the cache is shared by all Gunicorn workers, which matters, and I'll come back to why in the testing section. The e-mail is sent from a background thread, so the response comes back in about eighty milliseconds with `requires_2fa: true`. No session, no token yet. The SPA shows the modal; `POST /verify-otp/` compares the code, deletes it so it cannot be replayed, then creates the session and returns the JWT pair.

**Flow two — remote authentication with 42.** It's the OAuth 2.0 authorization-code grant. Clicking "Sign in with 42" asks the backend for the authorize URL — client id, redirect URI, `response_type=code` — and the browser goes to the Intra. The student consents; 42 redirects to `https://localhost/oauth/callback?code=…`, which is a route of our SPA. The SPA posts the code to `/get-token/`, and the **server** exchanges it with the client secret — the secret never reaches the browser — then calls `/v2/me`, finds or creates the user by e-mail, calls `login()`, and returns the same JWT pair. A 42 user has no password at all.

**Flow three — the tokens.** SimpleJWT issues an access token valid sixty minutes and a refresh token valid seven days, signed HS256 with the Django secret; the claims are `user_id`, `exp`, `iat` and `jti`. The SPA stores them and sends `Authorization: Bearer` on every API call — games, friends, matchmaking, GDPR. A helper called `authFetch` refreshes the access token one minute before it expires and retries once after a 401, so a session no longer dies silently after an hour.

Both paths end in the same state: an HttpOnly session cookie plus the JWT pair. After login, a 42 user and a password user are indistinguishable.

---

## Slide 21 — Cybersecurity features

Security in layers.

**Password storage** — PBKDF2 with a salt, never plaintext, plus the validator I mentioned.

**2FA and JWT** — as described.

**42 OAuth** — the server does the exchange; we never see a 42 password.

**SQL injection** — every database access goes through the ORM, which parameterises queries. There is no raw SQL in the project.

**CSRF and XSS** — Django's CSRF middleware requires the token on every state-changing request; the SPA reads it from the cookie. For XSS, user-supplied text — names, nicknames — is inserted with `textContent`, never as HTML. A stored XSS through tournament nicknames was found and fixed in the last compliance pass.

**Transport and access control** — HTTPS everywhere, Gunicorn terminating TLS on 443; every game, tournament and profile API requires an authenticated user; secrets — database credentials, the 42 client secret, the mail password — live in `.env`, not in the code.

Salim will now show the games and the graphics.

---

## If they ask

- *"Why e-mail OTP and not an authenticator app?"* — No app to install for evaluators; we already needed SMTP for the GDPR notices; the code is generated and checked server-side and is single-use. TOTP is a straightforward upgrade.
- *"Why is the code in a database cache?"* — Because Gunicorn runs three worker processes and Django's default cache is per-process. A code stored by worker A was invisible to worker B — that was our "code sometimes rejected" bug. The DB cache is shared with no new infrastructure; Redis would be the scale-up.
- *"Where is the OAuth `state` parameter?"* — Not implemented. The risk is login CSRF; the fix is a random value stored in the session, appended to the authorize URL and verified on callback. I'd put it first on the security backlog.
- *"Why JWT in localStorage?"* — The games are separate ES modules that need the Bearer header; cookies would be safer against XSS. We mitigate with HTTPS, textContent rendering and no third-party scripts except CDNs. Listed as a limitation.
- *"Brute-forcing the six-digit code?"* — Only the 10-minute TTL and single use today; an attempt counter in the cache with lockout is the fix.
- *"Which endpoints validate the JWT?"* — All DRF views with the default authentication classes: matches, friends, GDPR, matchmaking. `profile_view` accepts the session too, so the browser session and the JWT together make a full UI session. Logout clears both; access tokens expire naturally.
- *"What's in a JWT?"* — Header, payload with `user_id / exp / iat / jti / token_type`, HMAC-SHA256 signature over both with the server secret. The server verifies the signature and expiry on every request; no DB lookup for the token itself.
