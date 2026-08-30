# FAST_PONG — Final Report of the Evaluation-Prep Audit (24 Aug 2026)

Everything below was done on `master` in small commits. `make build && make up` works from a
clean checkout with a fresh database volume, the site serves at https://localhost, and
`make test` passes (54 tests). Screenshots of every page were captured from the running site
with headless Chrome (0 JavaScript errors).

## 1. What was fixed (with root causes)

| Fix | Root cause | Where |
|-----|-----------|-------|
| **2FA code "sometimes rejected"** | OTP stored in Django's default `LocMemCache`, which is per-process; Gunicorn runs 3 workers, so `/verify-otp/` usually ran in a worker that never saw the code (reproduced: worker A stores → worker B reads `None`). Secondary: re-clicking *Sign In* regenerated the code, comparison was type/whitespace-strict, `refresh_token` missing from the response. | `backend/settings.py` (`CACHES` → `DatabaseCache`, `OTP_TTL_SECONDS`), `scripts/entrypoint.sh` (`createcachetable`), `userapp/views.py` (`login_view`, `verify_otp`) |
| **2FA email "very slow"** | `send_mail()` ran synchronously in the request with no `EMAIL_TIMEOUT`; the login response waited for the whole SMTP round-trip and returned 500 on any SMTP error. | `userapp/views.py::send_otp_email_async` (daemon thread + logging), `backend/settings.py` (`EMAIL_TIMEOUT=10`, `EMAIL_BACKEND` from `.env`) |
| `make test/migrate/shell` crashed | compose pointed `exec` at `production_settings`, which set `SECRET_KEY` to an unset env var | `docker-compose.yml`, `production_settings.py` |
| Stale JS served to browsers | entrypoint skipped `collectstatic`; WhiteNoise serves `staticfiles/`, which had drifted | `scripts/entrypoint.sh`, `staticfiles/` regenerated |
| Failing tournament tests | tests never called `get_winner()` (the only place tiebreakers are created) | `tournaments/tests.py` |
| Settings saved the placeholder display name "The Champion" | template hard-coded `value="The Champion"`; `loadSettingsData` only overwrote it when a display name already existed | `templates/frontend/index.html`, `static/frontend/js/script.js::loadSettingsData` |
| Pong ball stuck gliding along a wall | wall bounce in `GamePhysics.updatePhysics` flipped `velocity.z` after the move without clamping the ball back inside, so an overshooting ball re-flipped every frame until its vertical speed decayed to 0; serves could also be nearly flat | `static/frontend/js/pong.js::GamePhysics` (`updatePhysics`, `resetBall`) |
| Avatar of the previous account stayed after switching users | nav/settings avatar `src` was only set when the current account had a picture; never reset inside the SPA | `static/frontend/js/script.js` (`updateNavAvatar`, `loadSettingsData`, `handleLogout`) |
| Silent token refresh broken | wrong URL + undefined `logout()` | `static/frontend/js/script.js` |
| GDPR cron not runnable | no cron in the image | `Makefile` (`gdpr-cleanup`, `gdpr-cleanup-run`) |
| **Subject-compliance batch (30 Aug 2026)** — stored XSS via tournament nicknames | `innerHTML` with user strings | `script.js` `loadTournamentData` (DOM + `textContent`) |
| AI paddle faster/slower than a player; AI moved the paddle directly; straight-line prediction | `MAX_SPEED`, `executeMove`, no wall folding | `pong.js` `InputHandler.aiKeys`, `PongAI.predictZ/pressKeys` — simulated keys at `paddleSpeed` 0.15, bounce-aware |
| DB password committed in `docker-compose.yml` | hard-coded env | `${DB_*}` substituted from `.env` |
| Tournament API open to anyone with a CSRF cookie | no auth check | `tournaments/views.py` `require_login` (401) |
| No "next fight" announcement | — | `#next-match` + highlighted row |
| GDPR anonymization missing (module bullet 1) | removed earlier | `POST /api/auth/anonymize-account/` + Settings button; 42-safe via `get_or_create_42_user` |
| Second game "matchmaking" | an online TicTacToe queue was built, then removed at the team's request — matchmaking is the tournament system (pairings, next match, tiebreakers); TicTacToe stays local | `tournaments/`, `tictactoe.js` (local), `gameapp` migration `0003` |
| 42 OAuth had no `state` (login-CSRF) | none generated/verified | `userapp/views.py::redirect_uri` / `get_token`, `script.js::checkOAuthLogin`, `OAUTH_STATE_SECRET` |
| SSR was only the empty SPA shell | no server-rendered content | `gameapp.views.index` route-aware context (`ssr_*`), template renders title/meta/active page/profile |
| **Second sweep (30 bugs, 30 Aug 2026)** — auth: app silently broke after the 60-min JWT expiry | refresh timer only armed after 42 login; `getAccessToken()` unused | `script.js` `window.authFetch` (fresh token, 401 retry), `scheduleTokenRefresh` after every login, refresh on page load |
| Registration / email validation | raw DB error on duplicates, case-sensitive email, no format check, similarity validator skipped | `userapp/views.py` (`register_view`, `login_view`, `verify_otp`, `profile_view`) |
| Secrets in the server log | debug `print`s of passwords, headers, OTP codes | `userapp/views.py` |
| Tournaments: bracket corruption, blank/long names, string score comparison, unresolved second tie, lost on refresh | no input validation, single tiebreak round, id only in memory | `tournaments/views.py`, `tournaments/models.py::get_winner`, `script.js::setCurrentTournament` |
| Settings: Save button did nothing, no way to toggle 2FA | handler only alerted; no endpoint/UI | `script.js`, `index.html` Security section, `profile_view` PUT `two_factor_enabled` |
| Pong: canvas broke on resize, no touch controls, pause key leak, no winner text, dead AI difficulty code, stuck keys on alt-tab | duplicate `handleResize`, keyboard-only input, listeners never removed, `scoreDiff = 0` | `static/frontend/js/pong.js` (`GameRenderer.dispose`, `InputHandler` pointer events, `PongAI`, `showWinner`) |
| TicTacToe cleanup was a no-op; bogus state POSTs from both games | unbound handlers, leftover calls | `static/frontend/js/tictactoe.js`, `pong.js` |
| GDPR cleanup never deleted while email failed | deletion mail sent before `delete()` in the same `try` | `delete_inactive_users.py` |
| Misc: double page initialisation / double Back, OTP modal (Enter, Cancel), avatar size/type checks, logged-out access to game pages, save-match validation, inactive users listed, invalid dates in Firefox, alert/logout ordering, `make clean` | — | `script.js`, `index.html`, `userapp/views.py`, `Makefile` |

Regression tests: `userapp/tests.py` (38: 2FA flow, slow/failing email backends, GDPR export/anonymize (incl. a 42 account)/delete/cleanup, 42 user helper, registration/email/avatar validation, password feedback, presence, unique display name, JWT on profile, 42 accounts without 2FA, OAuth state), `gameapp/tests.py` (3: SSR) and `tournaments/tests.py` (10: tiebreak rounds, validation, login required).
Full details, severities and the deferred-issue list: `docs/audit-report.md`.

## 2. What remains for the humans

1. **42 OAuth key** — rotate it on the 42 intra, set `FORTYTWO_CLIENT_ID`, `FORTYTWO_CLIENT_SECRET`
   (and the legacy `CLIENT_ID`/`CLIENT_SECRET`, which `settings.py` also reads) in `.env`, keep the
   redirect URI exactly `https://localhost/oauth/callback`, then `make down && make up`. The code
   path and the generated authorize URL were verified; only the final exchange needs the new key.
2. **Gmail app password** — Google currently rejects it (`534 5.7.9 WebLoginRequired`). Log into
   `transcendance.2fa@gmail.com`, create a new App Password, set `EMAIL_HOST_PASSWORD`, restart.
   For the demo without Gmail: `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` in
   `.env`, restart, and read the code with `grep "OTP for login" gunicorn-error.log | tail -1`.
3. **Speaker names** — `presentation/index.html` uses *Speaker 1…4* placeholders on every section;
   the member-contribution slide is derived from git history and marked "team: adjust".
4. **Second-browser testing** — done by the team on Firefox (browser-compatibility module); re-check after any frontend change.
   A language switcher built during the audit was likewise removed after the team confirmed *Multiple
   language support* is not a selected module.
5. Optional before the demo: pre-create the accounts listed on the demo cheat-sheet slide.

## 3. How to use each deliverable

| Deliverable | How to use |
|-------------|-----------|
| `docs/audit-report.md` | Read §1 for the two bug stories (staff will ask), §3 for the honest limitations, §5 for the external blockers. |
| `docs/study-guide/00-overview.md` | Start here; 15-minute re-orientation on stack, run commands and request flow. |
| `docs/study-guide/architecture/` | Mermaid diagrams (render in GitHub/VS Code): containers, backend apps + URL table, ER diagram, request lifecycle, sequence diagrams for login / 42 OAuth / 2FA / games / tournaments / GDPR. |
| `docs/study-guide/modules/01…12` | One file per selected module (Web ×3, user management, remote auth/42 OAuth, AI opponent, stats dashboards, another game + matchmaking, GDPR, 2FA+JWT, 3D, accessibility): what it requires, where it is implemented (`path:line`), status, and 5–10 likely evaluator questions with answers. |
| `docs/study-guide/SPA-routing-and-frontend.md` | Client-side router, games, Three.js + AI opponent, stats dashboard rendering, token handling. |
| `docs/study-guide/quick-drill.md` | 40+ rapid-fire Q&As ordered by likelihood, plus demo commands. Drill this the night before. |
| `presentation/FAST_PONG-presentation.pdf` | The presentation (36 slides, 16:9, same visual style as the team's earlier capstone deck). Rebuild after edits with `python presentation/build_pdf_deck.py` (content and layout live in that script; photos in `presentation/assets/`). |
| `presentation/index.html` | Shorter HTML slideshow (18 slides, light theme): ← → / Space navigate, `Home`/`End` jump, `P` shows all slides stacked. |
| `presentation/screenshots/` | Raw screenshots (also embedded in the deck). |
| `make test` | Run before the evaluation to show the green suite. |

## 3b. Selected modules (final list)

7 Major — Django backend, standard user management, remote authentication (42 OAuth), another game with history and matchmaking (local TicTacToe + tournament matchmaking), AI opponent, 2FA + JWT, advanced 3D — and 6 Minor — Bootstrap, PostgreSQL, stats dashboards, GDPR, expanding browser compatibility, SSR — = **10 major-equivalents** (7 required). "Support on all devices" is no longer claimed (responsive layout and touch controls remain as features).

## 4. Verification evidence

* Fresh build: `docker-compose -p bastaclean up -d --build` with a new volume → migrations,
  `django_cache` table, collectstatic, Gunicorn on 443; `GET /` → 200; test suite OK; torn down.
* Live 2FA on the real 3-worker Gunicorn (console email backend): 5/5 login→verify rounds OK,
  including cross-worker rounds; login latency ~80 ms (was 1.9 s / HTTP 500).
* Scripted API flow (register → login → profile → save-match → history → users/friends → export →
  profile PUT → tournament create/add players/view/start/finish → logout → delete): all 2xx.
* Headless-Chrome walkthrough: 17 screenshots, desktop + mobile, 0 JS errors.
