# Module — Web: PostgreSQL database (Minor)

**Verdict: Works end-to-end ✅** — a `postgres:13` container is the only datastore; every model, session, DRF token, and (🆕) the 2FA cache table live in it.

## What the module requires (42 subject wording)
"Use a database for the backend" — all persistent data must be in PostgreSQL, consistently across the backend.

## What it does in FAST_PONG
Stores users (custom `User`), match history, tournaments/players/matches, Django sessions, DRF auth tokens, SimpleJWT outstanding tokens, django_otp tables, admin logs and the `django_cache` table.

## Exactly where it is implemented

| What | Where | Ref |
|---|---|---|
| DB container | `db` service, `image: postgres:13`, volume `postgres_data:/var/lib/postgresql/data`, env `POSTGRES_DB/USER/PASSWORD=basta_db/postgres/postgres`, on `basta-network` | `docker-compose.yml:24-33` |
| Web waits for DB | `while ! nc -z db 5432` | `scripts/entrypoint.sh:4-9` |
| Django connection | `DATABASES['default']` → `django.db.backends.postgresql`, values `DB_NAME/DB_USER/DB_PASSWORD/DB_HOST=db/DB_PORT=5432` from `.env` | `backend/settings.py:93-102` |
| Driver | `psycopg2-binary` | `requirements.txt` |
| Custom user table | `class User(AbstractUser)` … `db_table = 'userapp_user'` | `userapp/models.py:6`, `:40` |
| Match history | `class MatchHistory` (user FK, game_type, opponent, result, score, date_played) | `userapp/models.py:66-83` |
| Tournament tables | `Tournament`, `Player`(unique_together tournament+nickname), `Match` | `tournaments/models.py:7`, `:88`, `:102` |
| Unused tables | `gameapp.Game/Player/Score` | `gameapp/models.py:5-30` |
| Migrations | `userapp/migrations/0001…0007`, `tournaments/migrations/0001…0006`, `gameapp/migrations/0001` | applied by `entrypoint.sh:45-46` |
| Sessions in DB | `SESSION_ENGINE = 'django.contrib.sessions.backends.db'` | `backend/settings.py:179` |
| 🆕 Cache in DB | `CACHES` → `DatabaseCache`, `LOCATION='django_cache'`; table created by `createcachetable` | `backend/settings.py:296-301`, `scripts/entrypoint.sh:48` |
| psql shortcut | `make db` → `docker-compose exec db psql -U postgres -d basta_db` | `Makefile:92` |
| Tests | Django creates `test_basta_db` (needs the postgres superuser — it is) | `make test` |

Key columns: `User.email` unique (`USERNAME_FIELD='email'`, `userapp/models.py:8`,`:37`), `User.friends` self‑M2M non‑symmetric (`:35`), `User.last_activity`/`last_warned_date` for GDPR (`:15-16`), `MatchHistory.score` is a `"x-y"` string (`:82`).

## How it interacts with the rest
Only Django talks to PostgreSQL (through the ORM). Gunicorn's three worker processes share state *only* through the DB: sessions, JWT blacklist tables, and — after the fix — the OTP cache. `MatchHistory` is written by `save_match_view` (`userapp/views.py:775`) and read by `profile_view`/`match_history_view`/`export_user_data`.

**🆕 Changed in Aug-2026 audit:** the `django_cache` table now exists and is the shared store for pending 2FA codes (root-cause fix for "correct code rejected"). `docker-compose.yml:18` switched to `backend.settings` so `make migrate`/`make db`-adjacent commands work.

## Status after audit
Works ✅. Notes: DB credentials are the default `postgres/postgres` (fine for local evaluation, flag as a limitation); the DB port is not published to the host (only reachable via `make db`); no backups; `makemigrations` runs at every start (would silently create migrations from model drift).

## Likely evaluator questions
1. **Why PostgreSQL?** Required by the subject; production-grade, transactional, well supported by Django's ORM (`django.db.backends.postgresql`), and trivial to run as a Docker service.
2. **How does the app find the DB?** Docker DNS: host `db` on the `basta-network` bridge (`docker-compose.yml:39`), port 5432, from `.env` (`DB_HOST=db`).
3. **What happens on `make up` before the DB is ready?** `entrypoint.sh` loops on `nc -z db 5432` (`:4-9`) then runs migrations.
4. **Where is data persisted?** Named volume `postgres_data` (`docker-compose.yml:36`). `make clean` (`down -v`) destroys it.
5. **Show me the schema.** ER diagram in `docs/study-guide/architecture/`; or `make db` then `\dt`.
6. **Why is `score` a string like "3-1"?** Simplicity for display; `profile_view` parses it to compute "best score" (`userapp/views.py:92-111`).
7. **Do tournaments reference users?** No — `tournaments.Player` has a free-text `nickname` per tournament (`tournaments/models.py:88-93`); accounts are only needed to open the page.
8. **Why is there a cache table in Postgres?** 🆕 Because Gunicorn runs 3 processes and the default in-memory cache is per-process; a DB-backed cache is shared with zero new infrastructure (no Redis).
9. **Any raw SQL?** None; ORM only. Password hashes use Django's PBKDF2 default.
