# Module — Cybersecurity: GDPR Compliance Options with User Anonymization, Local Data Management, and Account Deletion (Minor)

**Verdict: Works end-to-end ✅** — JSON export (local data management), **anonymization** (🆕 restored and made 42-safe in the Aug-2026 subject-compliance pass), permanent deletion, inactivity cleanup, activity tracking and a privacy policy.

## What the module requires (42 subject wording)
Let users (1) request anonymization of their personal data, (2) view / edit / delete their personal information (local data management), (3) permanently delete their account and all associated data, and (4) be clearly informed of their rights.

## What it does in FAST_PONG
| Right | Where the user does it | Backend |
|---|---|---|
| View / edit data | Settings page (display name, avatar, e-mail shown, 2FA toggle) | `profile_view` GET/PUT (`userapp/views.py:161-269`) |
| Export ("Download my data") | Settings → *Download My Data* → JSON file | `export_user_data` (`:1004-1063`) — profile, statistics, full match history, export date (`timezone.now()`) |
| **Anonymize** | Settings → Danger Zone → *Anonymize My Account* (confirm → logged out) | `anonymize_account` (`:886-925`) |
| Delete | Settings → Danger Zone → *Delete My Account* | `delete_account` (`:927-935`) — hard delete, cascades to `MatchHistory`, tokens, friend links |
| Automatic retention | `make gdpr-cleanup` / `-run` | `delete_inactive_users` command: warn after 5 months, delete after 6 (`INACTIVE_USER_*` settings); e-mail is best-effort, deletion always happens |
| Activity tracking | every authenticated request | `UserActivityMiddleware` updates `last_activity` at most every 15 min |
| Transparency | About page → Privacy Policy (data collected, use, rights, retention, contact) | template |

### What anonymization does (`userapp/views.py:886-925`)
Username → `anon_<10 hex>`, e-mail → `anon_<hex>@anonymized.invalid`, display/first/last name cleared, avatar file deleted, `is_42_user=False`, `intra_id=None`, 2FA off, `is_active=False`, unusable password, friends removed both ways, DRF tokens deleted, session logged out. `MatchHistory` rows are kept — they contain no personal data (opponent strings are "AI"/"Player 2"/nicknames) and keep the statistics meaningful.

### Why it is safe for 42-OAuth accounts
A 42 user has no password, so the endpoint authenticates by session/JWT like everyone else. After anonymization the account no longer carries the 42 e-mail or `intra_id`, and the OAuth views look up accounts with `get_or_create_42_user` (`userapp/views.py:132-158`), which matches **only active accounts** by e-mail and falls back to `<login>_<intra_id>` on a username collision. Result (tested): a returning 42 user gets a fresh account; the anonymized row is never re-linked or de-anonymized.

## Exactly where it is implemented
| Piece | File / lines |
|---|---|
| Anonymize endpoint + route | `userapp/views.py:886-925`, `userapp/urls.py` (`anonymize-account/`) |
| Settings button + handler | `templates/frontend/index.html:249`, `static/frontend/js/script.js:858-885` |
| 42 helper used by `get_token` / `oauth_callback` | `userapp/views.py:132-158` |
| Delete endpoint | `userapp/views.py:927-935` |
| Export | `userapp/views.py:1004-1063` |
| Cleanup command | `userapp/management/commands/delete_inactive_users.py` |
| Tests | `userapp/tests.py` `GdprTests` (export, anonymize normal + 42 account, delete, cleanup with failing e-mail) |

## Status after audit
All four bullets covered; verified live in the UI (anonymize → logged out → old credentials rejected) and by tests.

## Likely evaluator questions
1. **Anonymize vs delete?** Anonymize keeps non-personal statistics and disables the account; delete removes everything. Both are one click behind a confirmation.
2. **Can an anonymized user come back?** Not to that account — it is inactive with an unusable password; a 42 user who logs in again gets a new account.
3. **What about data in other users' histories?** Opponent strings are nicknames or "AI"/"Player 2", never e-mails; tournament players are per-tournament aliases.
4. **How do you honour retention?** `delete_inactive_users` (6 months), scheduled by the host (`gdpr_cleanup_crontab`), runnable with `make gdpr-cleanup-run`.
5. **Where is the user informed?** Privacy policy on the About page + notices under each Danger-Zone button.
6. **Is the export complete?** Profile, statistics, every match with dates, avatar URL; the SPA also embeds the avatar as base64 in the downloaded file.
