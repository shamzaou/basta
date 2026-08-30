# Module — Cybersecurity: GDPR compliance — anonymization, local data management, account deletion (Minor)

**Verdict: Works end-to-end ✅** — JSON export, permanent account deletion, inactivity cleanup command, activity tracking and a privacy policy all exist and are tested. Caveat: the cleanup cron is not scheduled inside the container. **Note on wording:** the 42 module title lists *anonymization*; the team chose **full deletion** instead (see "Why no anonymization?" below).

## What the module requires (42 subject wording)
Users can request anonymization of their personal data, manage their local data (view/edit/delete), and permanently delete their account; the system must be GDPR-aware (clear information, data retention).

## What it does in FAST_PONG
| Right | Feature | Endpoint / place |
|---|---|---|
| Access / portability ("local data management") | "Download My Data" → JSON with profile, statistics, full match history, export date (SPA adds avatar as base64) | `GET /api/auth/export-data/` |
| Rectification | edit display name / e-mail / avatar in Settings | `PUT /api/auth/profile/` |
| Erasure | "Delete My Account": hard delete of the user row, cascades to `MatchHistory`, friend links and the DRF token | `DELETE /api/auth/delete-account/` |
| Retention | warn after 5 months, delete after 6 months of inactivity; `last_activity` maintained by middleware | `manage.py delete_inactive_users` |
| Information | Privacy Policy sections 1-6 + legal disclaimer on the About page | `templates/frontend/index.html` (About) |

## Exactly where it is implemented

| Concern | Symbol | Ref |
|---|---|---|
| Export | `export_user_data` — user_information, profile.avatar_url, statistics (W/L/D, win rate), match_history, `export_date` | `userapp/views.py:930-989` (`export_date` `:981`) |
| Export frontend | `handleDownloadUserData` (fetches export, embeds avatar base64, adds `export_metadata`, triggers download) | `static/frontend/js/script.js:1515-1626` |
| Delete | `delete_account` → `user.delete()` (FK cascade on `MatchHistory.user`, `userapp/models.py:78`) | `userapp/views.py:849-857`; frontend `deleteAccount()` `script.js:795-830`; button `templates/frontend/index.html:236` |
| Inactivity cleanup | `Command.handle`: thresholds `:36-37`, warn queryset `:41-42`, delete queryset `:48-49`, skips staff/superusers, `--dry-run`, `--notify-only`, warning/deletion e-mails `:91-122` | `userapp/management/commands/delete_inactive_users.py` |
| Retention settings | `INACTIVE_USER_DELETE_MONTHS=6`, `INACTIVE_USER_WARNING_MONTHS=5`, `LAST_ACTIVITY_UPDATE_WINDOW=15` | `backend/settings.py:307-309` |
| Activity tracking | `UserActivityMiddleware` updates `User.last_activity` at most every 15 min | `userapp/middleware.py:6-29`; model fields `userapp/models.py:15-16`, `update_last_activity` `:61` |
| Cron definition | `0 0 * * 0 python manage.py delete_inactive_users` — **file only, not installed** | `gdpr_cleanup_crontab` |
| 🆕 Make targets | `make gdpr-cleanup` (dry run) / `make gdpr-cleanup-run` | `Makefile:84-90` |
| Privacy policy text | "Data We Collect / How We Use / Your Rights / Retention 6 months / Third parties / Changes" | `templates/frontend/index.html` About page (search "Privacy Policy") |
| Tests | `GdprTests`: export content, delete cascades, cleanup command dry-run vs real | `userapp/tests.py:189-232` |

## How it interacts with the rest
* Export and delete require an authenticated user (`IsAuthenticated`); the SPA sends the JWT from localStorage plus the CSRF token.
* Deletion removes the `MatchHistory` rows with the user (FK cascade), so statistics disappear together with the identity — nothing personal is retained.
* The cleanup command uses the same `send_mail` path as 2FA, so it needs a working `EMAIL_BACKEND` (with Gmail down it logs the failure and skips that user).

**🆕 Changed in Aug-2026 audit:** the Makefile targets and the GDPR tests were added. An "Anonymize My Account" endpoint/button was prototyped during the audit and **removed again at the team's request** — the module is delivered as export + deletion + retention cleanup. Everything else in this module is original team code.

## Status after audit
Works ✅ (unit tests + curl + UI screenshot `09-settings`). Limitations to state: the crontab is not installed in the Docker image (no `cron` package in `Dockerfile`), so retention is enforced only when someone runs `make gdpr-cleanup-run`; e-mail notifications depend on Gmail credentials; export does not include the friends list; no cookie banner (only first-party functional cookies are used).

## Likely evaluator questions
1. **What personal data do you store?** Username, e-mail, optional display name, avatar file, 42 login/id when using OAuth, last activity/login timestamps, match history (opponent nickname, score, date). Listed in the About page's privacy policy.
2. **Why no anonymization? The module says "anonymization".** We implemented the strictest form of erasure instead: "Delete My Account" removes the user row and everything that references it (`views.py:851`, FK cascade). Anonymization (keeping statistics under a pseudonym) was prototyped during the pre-evaluation audit and deliberately removed — the team preferred one unambiguous "right to be forgotten" action over two similar buttons. If staff insist, explain that the export + delete pair still gives the user full control of their data.
3. **Show me deletion.** Settings → Danger Zone → "Delete My Account" → confirm → `DELETE /api/auth/delete-account/` → user gone, `MatchHistory` gone (`GdprTests.test_delete_account_removes_user_and_history`). Demo with a throw-away account.
4. **How is retention enforced?** Middleware stamps `last_activity` (`middleware.py:23`); `delete_inactive_users` warns at 5 months and deletes at 6 (`settings.py:307-308`). Scheduled by the provided crontab on the host — admit it is not running inside the container.
5. **Why throttle `last_activity` writes?** To avoid a DB write per request; it only updates when older than 15 min (`settings.py:309`).
6. **What is in the export and in what format?** JSON (`export_user_data`), downloaded as `user_data_<username>_<date>.json` with avatar as base64 (`script.js:1597`).
7. **Is consent collected?** Registration implies acceptance; the policy is public on the About page. Improvement: explicit checkbox and cookie notice.
8. **How do you protect the data?** HTTPS only, hashed passwords (PBKDF2), HttpOnly session cookie, CSRF protection, authenticated-only endpoints, DB in a private Docker network.
