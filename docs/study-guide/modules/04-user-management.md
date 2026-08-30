# Module — User Management: standard user management, authentication, users across tournaments (Major)

**Verdict: Works end-to-end ✅ (two subject bullets remain partial: unique display name, friends' online status)** (register/login/logout, profile + avatar, display name, friends, match history & stats, 42 OAuth code path). ⚠️ "Users across tournaments" is satisfied loosely: tournaments use per-tournament nicknames, not accounts.

## What the module requires (42 subject wording)
Users can securely subscribe, log in, choose a unique display name for tournaments, update information, upload an avatar (with default), add friends and see their status, view stats (wins/losses) and a match history (1v1, dates, details) accessible to logged-in users.

## What it does in FAST_PONG
| Feature | Implemented as |
|---|---|
| Subscribe | e-mail + username + password (+ optional 2FA checkbox) → `register_view` |
| Log in / out | e-mail + password → session **and** JWT pair; optional e-mail OTP; 42 OAuth |
| Display name | `User.display_name`, editable in Settings; used in friend lists |
| Avatar | base64 upload via `PUT /api/auth/profile/`, served by `/api/auth/avatar/<id>/` with default `man.png` |
| Avatar reset 🆕 | **Changed in Aug-2026 audit:** `updateNavAvatar()` / `loadSettingsData()` in `script.js` now fall back to `man.png` when the account has no avatar and `handleLogout()` resets the navbar picture — previously the previous account's picture stayed visible after switching users inside the SPA |
| Friends | non-symmetric self M2M; add/remove/list; "Find Users" tab lists everybody |
| Stats & history | `MatchHistory` rows → games played, win rate (pie chart), best score, last 5 matches with date and game type |
| Tournaments | logged-in user creates a tournament, enters 3–8 nicknames (aliases); round-robin matches; tournament matches are *not* written to personal history |

## Exactly where it is implemented

| Concern | Symbol | Ref |
|---|---|---|
| User model | `User(AbstractUser)`: `display_name`, unique `email`, `profile_picture`, `is_42_user`, `intra_id`, `two_factor_enabled`, `last_activity`, `friends` M2M; `USERNAME_FIELD='email'` | `userapp/models.py:6-38` |
| `add_friend` / `remove_friend` / `get_display_name` | methods | `userapp/models.py:43-59` |
| Register | `register_view` (GET sets CSRF cookie; POST validates fields, `validate_password`, `create_user`, `login`) | `userapp/views.py:364-461`; `validate_password` `:409`; `create_user` `:418`; `login` `:428` |
| Password rules | `AUTH_PASSWORD_VALIDATORS` (similarity, min 10, common, numeric, custom upper/special/digit) | `backend/settings.py:107-130`, `userapp/validators.py:5-31` |
| Login | `login_view` (authenticate → 2FA branch or `login()` + `RefreshToken.for_user`) | `userapp/views.py:239-290`; `login(request,user)` `:272`; tokens `:275-280` |
| Logout | `logout_view` | `userapp/views.py:465` |
| Profile GET (stats, last 5 non-tournament matches) / PUT (username, email, display_name, base64 avatar) | `profile_view` — auth classes Token + **Session** | `userapp/views.py:73-204`; stats `:82-111`; avatar decode/save `:180-181` |
| Settings alt endpoint | `user_settings_view` (uses first/last name — legacy, frontend uses `profile_view`) | `userapp/views.py:699-742` |
| Avatar serving | `get_avatar_image` (FileResponse, default `static/frontend/assets/man.png`) | `userapp/views.py:860-896` |
| Friends | `get_all_users` (with `is_friend`), `get_friends`, `add_friend`, `remove_friend` | `userapp/views.py:991-1109` |
| Match history | `match_history_view` (last 10), `save_match_view` (POST from games) | `userapp/views.py:744-821`; `game_type` default PONG `:787` |
| Export | `export_user_data` | `userapp/views.py:930-989` |
| 42 OAuth | `redirect_uri` builds authorize URL `:481-511`; `get_token` exchanges code, `/v2/me`, `get_or_create` by e-mail, `login`, JWT | `userapp/views.py:586-671`; token URL `:601`; me `:621`; get_or_create `:639` |
| URLs | `/api/auth/register/ login/ logout/ profile/ settings/ match-history/ save-match/ match/create/ delete-account/ avatar/<id>/ export-data/ users/ friends/ friends/add|remove/<id>/ redirect_uri/ get-token/ token/ token/refresh/ verify-otp/` | `userapp/urls.py:12-51` |
| Frontend | `handleRegister` `script.js:414`, `handleLogin` `:256`, `handleLogout` `:378`, `loadProfileData` `:1054`, avatar upload (FileReader → base64) `:723-776`, settings edit buttons `:645-701`, friends `:1697-1911`, pie chart `:1914`, OAuth `initiate42OAuth` `:940`, `checkOAuthLogin` `:983` | `static/frontend/js/script.js` |
| Tournament aliases | `Tournament.participants_count`, `Player.nickname` unique per tournament, `add_players` rejects duplicates | `tournaments/models.py:9`, `:88-93`; `tournaments/views.py:41-72` |
| Login gate for tournament/game pages | `showPage` redirects logged-out users; Play/Tournament buttons check `isLoggedIn` | `script.js:13-21`, `:858-904` |

## How it interacts with the rest
* Registration and login call Django's `login()` → a **session cookie** (HttpOnly) *and* return SimpleJWT tokens that the SPA stores in `localStorage` (`script.js:291-294`). DRF views accept either (see `07-cybersecurity-2fa-jwt.md`).
* Games post results to `save-match/` with `Authorization: Bearer <jwt>` (`pong.js:925`, `tictactoe.js:222`); profile aggregates them.
* `UserActivityMiddleware` (`userapp/middleware.py:6`) refreshes `last_activity` for GDPR inactivity cleanup.
* Tournaments (`tournaments/views.py`) do not use the account at all beyond the front-end login gate; matches are Pong PvP with the two nicknames shown as player names (`pong.js:727-742`).

**🆕 Changed in Aug-2026 audit:** `verify_otp` now also returns `refresh_token` (`userapp/views.py:337`); `refreshAccessToken` calls the correct `/api/auth/token/refresh/` (`script.js:1434`) and `handleLogout()` on failure (`:1451`); the Settings page bug that saved the placeholder display name was fixed (see below); the OTP login path is fixed (see 2FA module).

**🆕 Fixed in Aug-2026 audit — display name "The Champion":** `templates/frontend/index.html` shipped the Settings display-name input with a hard-coded `value="The Champion"` (and the read-only box with the text "nickname"), and `loadSettingsData` only overwrote them when the user *already had* a display name (`if (… && data.display_name)`). A user without one therefore saw "The Champion" pre-filled after clicking *Edit* and saved it unchanged. Fix: the template value is now empty with a placeholder (`index.html:196`) and `loadSettingsData` always syncs both elements from the server (`data.display_name || ''`, `script.js:1274-1281`). The About page now lists Ali as "Backend Developer".

## Status after audit
Works ✅ for everything listed above (verified by the curl smoke flow and a headless-Chrome walkthrough; screenshots `08-profile`, `09-settings`, `15-find-users`).

**🆕 Changed in the Aug-2026 second sweep (`userapp/views.py` unless noted):**
* Registration: duplicate e-mail/username → 400 "Email already registered" / "Username already taken" (`:430-433`, case-insensitive) instead of a 500 with raw DB text; e-mail validated with `validate_email` (`:427`) and lower-cased; the similarity validator now runs (`validate_password(..., user=User(...))` `:442`).
* Login/OTP: e-mail normalised and matched case-insensitively (`verify_otp` `:341`).
* Profile PUT: e-mail validated and checked case-insensitively (`:166-169`); `two_factor_enabled` is returned by GET (`:137`) and settable by PUT (`:177-178`) — the Settings page has a **Security** checkbox and the **Save Settings** button really saves (`script.js`); avatar uploads are limited to png/jpg/gif/webp, ≤ 2 MB and verified with Pillow (`:195-210`), served with the right content-type (`:896`).
* `save-match` validates `game_type`/`result`/`score` (`:799-815`); match dates are ISO 8601 (`:127`, `:783`); "Find Users" hides inactive accounts (`:1013`); no secrets are printed to the log.
* Tournaments (`tournaments/views.py`): `add_players` rejects blank/too-long/duplicate nicknames and a second registration (`:42-81`, atomic); `finish_match` casts scores to `int`, rejects negatives and ties (`:174-200`); `Tournament.get_winner` plays further tiebreaker rounds until one winner remains (`tournaments/models.py:18-99`); the SPA keeps the tournament id in `localStorage` so a refresh no longer loses it.
* Previous account's avatar / "The Champion" display-name bugs (first sweep) remain fixed.

Caveats to admit if asked:
* **Friend "online status"** is not implemented (friends list shows name/username only).
* **Display name uniqueness** is not enforced (only `username`/`email` are unique).
* **Tournament players are aliases**, not linked to accounts; stats exclude tournament games by design (`profile_view` `.exclude(game_type='TOURNAMENT')` `:82-86`).
* **42 OAuth** cannot be verified live until the new client key is in `.env` (`FORTYTWO_CLIENT_ID/SECRET`, redirect `https://localhost/oauth/callback`).
* `check_auth` (`userapp/views.py:470`) and `user_settings_view` are dead/legacy endpoints; `update_profile` (`:207`) is not routed.
* Password change/reset does not exist (the About page says "contact support").

## 🆕 Subject-compliance pass (30 Aug 2026)
* **Tournament API requires login** — `require_login` (`tournaments/views.py:14-21`) on every tournament view → 401 JSON; the SPA shows "Please log in" (`script.js:2224`).
* **Next fight announced** — `#next-match` under the tournament status ("Next match: A vs B" / "All matches played") and `.next-match-row` highlight (`script.js:2350`, `index.html:545`).
* **XSS-safe rendering** — nicknames/winners/players lists are built with `createElement` + `textContent` (`script.js:2249-2360`); a nickname `<b id=xss-probe>` is displayed literally.
* **Anonymization** back in Settings (see `modules/08-cybersecurity-gdpr.md`).
* **Remaining gaps (be honest):** `display_name` is not unique (no constraint; tournaments use per-tournament nicknames instead) and there is **no online status** for friends — both are listed in the subject bullets.

## Likely evaluator questions
1. **How is the user model customised?** `AbstractUser` subclass with e-mail as the login field (`USERNAME_FIELD='email'`, `userapp/models.py:37`) and extra fields (display name, avatar, 42 fields, 2FA flag, GDPR timestamps, friends M2M).
2. **What are the password rules?** ≥10 chars, not similar to username/email, not common, not all numeric, plus ≥1 uppercase, ≥1 digit, ≥1 special (`userapp/validators.py:14-26`). Errors are returned as a list to the SPA (`views.py:411-415`).
3. **How does the avatar upload work?** The browser reads the file as a data-URL (`script.js:776`), PUTs it as JSON; the view base64-decodes and saves `profile_pictures/user_<id>.<ext>` (`views.py:177-181`); `/api/auth/avatar/<id>/` streams it or the default (`:860-896`).
4. **Why serve avatars through an API instead of `/media/`?** `static(settings.MEDIA_URL…)` only serves media when `DEBUG=True`; the endpoint works in production and lets us fall back to `man.png`.
5. **How do friends work? Is it mutual?** Non-symmetric M2M (`models.py:35`): A adding B does not add A to B's list. "Find Users" shows `is_friend` per user (`views.py:993-1019`).
6. **Where do stats come from?** `MatchHistory` rows created by the games; `profile_view` computes games played, win rate and best score (largest margin) excluding tournament games (`views.py:82-111`).
7. **Is the display name unique for tournaments?** Within a tournament, nicknames are unique (`Player.unique_together`, `models.py:92-93`; duplicate check `tournaments/views.py:58-59`). Globally, `username` is unique.
8. **How does 42 login work?** Button → `POST /api/auth/redirect_uri/` returns the authorize URL (`views.py:500-505`) → 42 redirects to `https://localhost/oauth/callback?code=…` → SPA catch-all → `checkOAuthLogin` posts the code to `get-token/` (`script.js:1001`) → server exchanges it (`views.py:601`), fetches `/v2/me` (`:621`), `get_or_create`s the user by e-mail (`:639`), logs in, returns JWTs.
9. **What happens on logout?** `POST /api/auth/logout/` clears the session; SPA removes `isLoggedIn/authToken/refreshToken/userData` from localStorage (`script.js:397-400`). The JWT itself is not revoked (stateless) until expiry (60 min).
10. **Why both session and JWT?** Session came first (Django default, needed for CSRF-protected views like profile PUT); JWT was added for the 2FA/JWT module and for API calls from the games. Honest answer — see 2FA/JWT module for which endpoints check which.

**🆕 Changed in Aug-2026 audit — online status & unique display name:** friends' presence is implemented without any online play: every logged-in tab POSTs `/api/auth/heartbeat/` once a minute (`startHeartbeat()` in `script.js`, armed from `scheduleTokenRefresh()`), the server stores it in `User.last_activity`, and `is_online()` in `userapp/views.py` reports a friend as online when seen within `ONLINE_WINDOW` (2 min); logout pushes `last_activity` outside the window so the friend goes offline at once; `/api/auth/friends/` and `/users/` return `online`, rendered as a green/grey dot. Display names are now unique (case-insensitive) — profile PUT answers 400 "Display name already taken" — and the tournament form prefills the first alias with the logged-in user's display name. 42-OAuth accounts have no 2FA toggle.

**🆕 JWT on profile/settings:** the explicit Token/Session authentication classes were removed from `profile_view` and `user_settings_view`, so they use the DRF defaults (JWT Bearer first, session fallback) like every other endpoint.
