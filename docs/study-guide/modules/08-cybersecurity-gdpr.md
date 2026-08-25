# Module — Cybersecurity: GDPR compliance — anonymization, local data management, account deletion (Minor)

**Verdict: Works end-to-end ✅ (after audit)** — export, anonymize 🆕, delete, inactivity cleanup command, activity tracking and a privacy policy all exist and are tested. Caveat: the cleanup cron is not scheduled inside the container.

## What the module requires (42 subject wording)
Users can request anonymization of their personal data, manage their local data (view/edit/delete), and permanently delete their account; the system must be GDPR-aware (clear information, data retention).

## What it does in FAST_PONG
| Right | Feature | Endpoint / place |
|---|---|---|
| Access / portability | "Download My Data" → JSON with profile, statistics, full match history, export date (SPA adds avatar as base64) | `GET /api/auth/export-data/` |
| Rectification | edit display name / e-mail / avatar in Settings | `PUT /api/auth/profile/` |
| Anonymization 🆕 | "Anonymize My Account": username/e-mail replaced with `anon_<hex>`, display name, names, avatar, 42 ids, 2FA flag removed, friends cleared, password made unusable, account disabled; match statistics kept | `POST /api/auth/anonymize-account/` |
| Erasure | "Delete My Account": hard delete, cascades to `MatchHistory` | `DELETE /api/auth/delete-account/` |
| Retention | warn after 5 months, delete after 6 months of inactivity; `last_activity` maintained by middleware | `manage.py delete_inactive_users` |
| Information | Privacy Policy sections 1-6 + legal disclaimer on the About page | `templates/frontend/index.html` (About) |

## Exactly where it is implemented

| Concern | Symbol | Ref |
|---|---|---|
| Export | `export_user_data` — user_information, profile.avatar_url, statistics (W/L/D, win rate), match_history, `export_date` | `userapp/views.py:970-1029` (`export_date` `:1021`) |
| Export frontend | `handleDownloadUserData` (fetches export, embeds avatar base64, adds `export_metadata`, triggers download) | `static/frontend/js/script.js:1550-1660` |
| 🆕 Anonymize | `anonymize_account` — `uuid4().hex[:10]` `:858`, deletes avatar file, rewrites identity fields, `set_unusable_password()` `:876`, `is_active=False`, clears `friends`/`friend_of`, deletes DRF token, `logout(request)` `:882` | `userapp/views.py:849-887` |
| 🆕 Anonymize frontend | `anonymizeAccount()` with translated confirm, clears localStorage, redirects to `/login` | `static/frontend/js/script.js:832-865`; button `templates/frontend/index.html:238` |
| Delete | `delete_account` → `user.delete()` (FK cascade on `MatchHistory.user`, `userapp/models.py:78`) | `userapp/views.py:889-897`; frontend `deleteAccount()` `script.js:795-830` |
| Inactivity cleanup | `Command.handle`: thresholds `:36-37`, warn queryset `:41-42`, delete queryset `:48-49`, skips staff/superusers, `--dry-run`, `--notify-only`, warning/deletion e-mails `:91-122` | `userapp/management/commands/delete_inactive_users.py` |
| Retention settings | `INACTIVE_USER_DELETE_MONTHS=6`, `INACTIVE_USER_WARNING_MONTHS=5`, `LAST_ACTIVITY_UPDATE_WINDOW=15` | `backend/settings.py:307-309` |
| Activity tracking | `UserActivityMiddleware` updates `User.last_activity` at most every 15 min | `userapp/middleware.py:6-29`; model fields `userapp/models.py:15-16`, `update_last_activity` `:61` |
| Cron definition | `0 0 * * 0 python manage.py delete_inactive_users` — **file only, not installed** | `gdpr_cleanup_crontab` |
| 🆕 Make targets | `make gdpr-cleanup` (dry run) / `make gdpr-cleanup-run` | `Makefile:84-90` |
| Privacy policy text | "Data We Collect / How We Use / Your Rights / Retention 6 months / Third parties / Changes" | `templates/frontend/index.html` About page (search "Privacy Policy") |
| Tests | `GdprTests`: export, anonymize (PII gone, stats kept, login blocked), auth required, delete cascades, cleanup command dry-run vs real | `userapp/tests.py:189-259` |

## How it interacts with the rest
* All three actions require an authenticated user (`IsAuthenticated`); the SPA sends the JWT from localStorage plus the CSRF token.
* Anonymization keeps `MatchHistory` rows so aggregate stats remain but no longer identify anyone; other users' friend lists lose the link (M2M cleared both directions).
* The cleanup command uses the same `send_mail` path as 2FA, so it needs a working `EMAIL_BACKEND` (with Gmail down it logs the failure and skips that user).

**🆕 Changed in Aug-2026 audit:** anonymization did not exist (only hard delete); the endpoint, button, tests and Makefile targets were added. Everything else in this module is original team code.

## Status after audit
Works ✅ (unit tests + curl + UI screenshot `09-settings`). Limitations to state: the crontab is not installed in the Docker image (no `cron` package in `Dockerfile`), so retention is enforced only when someone runs `make gdpr-cleanup-run`; e-mail notifications depend on Gmail credentials; export does not include friends list; no cookie banner (only first-party functional cookies are used).

## Likely evaluator questions
1. **What personal data do you store?** Username, e-mail, optional display name, avatar file, 42 login/id when using OAuth, last activity/login timestamps, match history (opponent nickname, score, date). Listed in the About page's privacy policy.
2. **Show me anonymization vs deletion.** Settings → Danger Zone: "Anonymize" rewrites identity fields and disables the account but keeps statistics (`views.py:851`); "Delete" removes the row and cascades (`:891`). Demo with two throw-away accounts.
3. **Can an anonymized user come back?** No — password unusable, `is_active=False`, e-mail replaced; they would register a new account. That is the intended "right to be forgotten" while keeping non-personal aggregates.
4. **How is retention enforced?** Middleware stamps `last_activity` (`middleware.py:23`); `delete_inactive_users` warns at 5 months and deletes at 6 (`settings.py:307-308`). Scheduled by the provided crontab on the host — admit it is not running inside the container.
5. **Why throttle `last_activity` writes?** To avoid a DB write per request; it only updates when older than 15 min (`settings.py:309`).
6. **What is in the export and in what format?** JSON (`export_user_data`), downloaded as `user_data_<username>_<date>.json` with avatar as base64 (`script.js:1594`).
7. **Is consent collected?** Registration implies acceptance; the policy is public on the About page. Improvement: explicit checkbox and cookie notice.
8. **How do you protect the data?** HTTPS only, hashed passwords (PBKDF2), HttpOnly session cookie, CSRF protection, authenticated-only endpoints, DB in a private Docker network.
