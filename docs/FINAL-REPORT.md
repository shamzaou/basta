# FAST_PONG — Final Report of the Evaluation-Prep Audit (24 Aug 2026)

Everything below was done on `master` in small commits. `make build && make up` works from a
clean checkout with a fresh database volume, the site serves at https://localhost, and
`make test` passes (19 tests). Screenshots of every page were captured from the running site
with headless Chrome (0 JavaScript errors).

## 1. What was fixed (with root causes)

| Fix | Root cause | Where |
|-----|-----------|-------|
| **2FA code "sometimes rejected"** | OTP stored in Django's default `LocMemCache`, which is per-process; Gunicorn runs 3 workers, so `/verify-otp/` usually ran in a worker that never saw the code (reproduced: worker A stores → worker B reads `None`). Secondary: re-clicking *Sign In* regenerated the code, comparison was type/whitespace-strict, `refresh_token` missing from the response. | `backend/settings.py` (`CACHES` → `DatabaseCache`, `OTP_TTL_SECONDS`), `scripts/entrypoint.sh` (`createcachetable`), `userapp/views.py` (`login_view`, `verify_otp`) |
| **2FA email "very slow"** | `send_mail()` ran synchronously in the request with no `EMAIL_TIMEOUT`; the login response waited for the whole SMTP round-trip and returned 500 on any SMTP error. | `userapp/views.py::send_otp_email_async` (daemon thread + logging), `backend/settings.py` (`EMAIL_TIMEOUT=10`, `EMAIL_BACKEND` from `.env`) |
| `make test/migrate/shell` crashed | compose pointed `exec` at `production_settings`, which set `SECRET_KEY` to an unset env var | `docker-compose.yml`, `production_settings.py` |
| Stale JS served to browsers | entrypoint skipped `collectstatic`; WhiteNoise serves `staticfiles/`, which had drifted | `scripts/entrypoint.sh`, `staticfiles/` regenerated |
| Failing tournament tests | tests never called `get_winner()` (the only place tiebreakers are created) | `tournaments/tests.py` |
| Missing GDPR anonymization (the selected GDPR module requires it) | not implemented | `userapp/views.py::anonymize_account`, `userapp/urls.py`, settings page + `script.js` |
| Silent token refresh broken | wrong URL + undefined `logout()` | `static/frontend/js/script.js` |
| GDPR cron not runnable | no cron in the image | `Makefile` (`gdpr-cleanup`, `gdpr-cleanup-run`) |

Regression tests: `userapp/tests.py` (16 tests: 2FA flow, slow/failing email backends, GDPR
export/anonymize/delete/cleanup command, plain login) and `tournaments/tests.py` (3).
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
4. **Review the new anonymize endpoint** so you can explain it as your own; it is flagged 🆕
   throughout the study guide. (A language switcher built during the audit was removed again after
   the team confirmed *Multiple language support* is not a selected module.)
5. Optional before the demo: pre-create the accounts listed on the demo cheat-sheet slide.

## 3. How to use each deliverable

| Deliverable | How to use |
|-------------|-----------|
| `docs/audit-report.md` | Read §1 for the two bug stories (staff will ask), §3 for the honest limitations, §5 for the external blockers. |
| `docs/study-guide/00-overview.md` | Start here; 15-minute re-orientation on stack, run commands and request flow. |
| `docs/study-guide/architecture/` | Mermaid diagrams (render in GitHub/VS Code): containers, backend apps + URL table, ER diagram, request lifecycle, sequence diagrams for login / 42 OAuth / 2FA / games / tournaments / GDPR. |
| `docs/study-guide/modules/01…11` | One file per selected module (Web ×3, user management, remote auth/42 OAuth, AI opponent, stats dashboards, GDPR, 2FA+JWT, 3D, accessibility): what it requires, where it is implemented (`path:line`), status, and 5–10 likely evaluator questions with answers. |
| `docs/study-guide/SPA-routing-and-frontend.md` | Client-side router, games, Three.js + AI opponent, stats dashboard rendering, token handling. |
| `docs/study-guide/quick-drill.md` | 40+ rapid-fire Q&As ordered by likelihood, plus demo commands. Drill this the night before. |
| `presentation/FAST_PONG-presentation.pdf` | The slide deck as a normal PDF (18 slides, 16:9) — open in any PDF viewer / projector. |
| `presentation/index.html` | Same deck as an HTML slideshow (clean light theme): ← → / Space navigate, `Home`/`End` jump, `P` shows all slides stacked. Regenerate the PDF with headless Chrome: `chrome --headless=new --no-pdf-header-footer --print-to-pdf=FAST_PONG-presentation.pdf index.html`. |
| `presentation/screenshots/` | Raw screenshots (also embedded in the deck). |
| `make test` | Run before the evaluation to show the green suite. |

## 4. Verification evidence

* Fresh build: `docker-compose -p bastaclean up -d --build` with a new volume → migrations,
  `django_cache` table, collectstatic, Gunicorn on 443; `GET /` → 200; test suite OK; torn down.
* Live 2FA on the real 3-worker Gunicorn (console email backend): 5/5 login→verify rounds OK,
  including cross-worker rounds; login latency ~80 ms (was 1.9 s / HTTP 500).
* Scripted API flow (register → login → profile → save-match → history → users/friends → export →
  profile PUT → tournament create/add players/view/start/finish → logout → delete): all 2xx.
* Headless-Chrome walkthrough: 17 screenshots, desktop + mobile, 0 JS errors.
