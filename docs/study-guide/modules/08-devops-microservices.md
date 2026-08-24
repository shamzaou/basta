# Module — DevOps: backend designed as microservices (Major)

**Verdict: Weak ❌ — modular monolith, not microservices.** Two containers (`web` = one Django/Gunicorn process hosting three apps, `db` = PostgreSQL). Prepare the honest framing below; staff may not award this module.

## What the module requires (42 subject wording)
Divide the backend into loosely-coupled microservices, each with a single responsibility, communicating through well-defined interfaces (REST APIs / messaging), independently deployable and scalable.

## What actually exists

| Layer | Reality | Ref |
|---|---|---|
| Containers | `web` (python:3.11-slim + Gunicorn) and `db` (postgres:13) on one bridge network; only `web` publishes a port (443) | `docker-compose.yml:3-40`, `Dockerfile:1` |
| Process model | one Gunicorn master, 3 sync workers, one Django project | `scripts/entrypoint.sh:56-66` |
| Logical services (Django apps) | **userapp** = identity/auth/2FA/OAuth/profile/friends/match-history/GDPR (`/api/auth/*`), **tournaments** = tournament engine (`/tournaments/api/*`), **gameapp** = SPA shell view + (unused) game models | `backend/urls.py:11-16`, `userapp/urls.py`, `tournaments/urls.py`, `gameapp/views.py:3` |
| Interfaces | JSON over HTTPS; each app has its own `urls.py`, `views.py`, `models.py`, migrations, tests | app folders |
| Shared state | single PostgreSQL database; DB-backed cache 🆕 (`backend/settings.py:296`) — workers are stateless | |
| Coupling | `tournaments` imports nothing from `userapp` (uses nicknames, no FK to `User`) → it could be extracted as-is; `gameapp.models` imports `userapp.models.User` (`gameapp/models.py:3`) | `tournaments/models.py`, `gameapp/models.py` |
| Deployment | `make build && make up`; entrypoint waits for DB, migrates, creates cache table 🆕, collects static 🆕, starts Gunicorn with TLS | `Makefile:25-33`, `scripts/entrypoint.sh` |
| Config | `.env` via python-decouple; secrets not in the image (bind-mount `.:/app`) | `docker-compose.yml:5-8`, `backend/settings.py:27` |

Leftovers that *look* like alternatives but are not used: Dockerfile `ENTRYPOINT init_db.sh` / `CMD gunicorn basta.wsgi` (`Dockerfile:33-34`, overridden by compose `entrypoint`), `scripts/init_db.sh` (Daphne/ASGI path), `production_settings.py`, `wsgi_utils.py`, `check_wsgi.py`.

## Strongest defensible framing (use these words, do not overclaim)
* "The backend is **decomposed by bounded context** into three independently testable Django apps with their own REST interfaces and data models; the tournament service has **no dependency** on the user service (aliases instead of FKs). Today they are **co-deployed** in one container behind one TLS endpoint; the database and (🆕) the cache are already external shared services, and workers are stateless, so the web tier scales horizontally."
* "To finish the split we would: (1) give `tournaments` and `userapp` their own compose services and Dockerfiles from the same image, (2) route `/api/auth/*` and `/tournaments/api/*` through a gateway (nginx/Traefik) that terminates TLS, (3) move each service to its own database/schema, (4) replace the direct `MatchHistory` write from games with a message (RabbitMQ/Redis stream) consumed by the stats service, (5) share identity via the JWT (already stateless — a service only needs `SECRET_KEY` to verify `Authorization: Bearer`)."
* Time-box honesty: "We prioritised the security and gameplay modules; the microservice split was designed but not deployed."

## 🆕 Changed in Aug-2026 audit
`docker-compose.yml:18` (`DJANGO_SETTINGS_MODULE=backend.settings`), `scripts/entrypoint.sh:48,52` (`createcachetable`, `collectstatic`), `production_settings.py:35` fallback, `Makefile:84-90` GDPR targets. No architectural change — deliberately minimal.

## Status after audit
Builds and runs from clean with `make build && make up`; site on https://localhost; tests pass in-container. Module requirement **not met** as microservices; documented honestly in `docs/audit-report.md` and the presentation "Limitations".

## Likely evaluator questions
1. **Where are your microservices?** Answer with the framing above: three bounded contexts (`userapp`, `tournaments`, `gameapp`) with separate REST interfaces, co-deployed in one container. Do not claim separate processes.
2. **How do the services communicate?** Today in-process (Django URL routing); the contracts are the JSON endpoints in `userapp/urls.py` and `tournaments/urls.py`, which would not change after a split.
3. **How would a split service authenticate users?** By verifying the SimpleJWT `Authorization: Bearer` token with the shared signing key — no call to the user service needed.
4. **Why one database?** Simplicity; Django migrations per app make a per-service DB split mechanical (`--database` routers).
5. **What is stateless / what is shared?** Gunicorn workers hold no state; sessions, JWT bookkeeping, OTP codes 🆕 and all data are in PostgreSQL. This is what made the 3-worker OTP bug visible and fixable.
6. **How do you deploy?** `make build && make up` → compose builds the image, starts `db`, `web` waits on port 5432, migrates, collects static, starts Gunicorn with TLS on 443 (`scripts/entrypoint.sh`).
7. **Why Gunicorn on 443 directly, no reverse proxy?** Fewer moving parts for a local evaluation; TLS via the self-signed `localhost.pem`. A gateway would be the first step of the microservice split.
8. **Why is `gameapp` almost empty?** Games run client-side; results are stored through `userapp`'s `save-match`. `gameapp` only renders the SPA shell and reserves models for a future server-authoritative game service.
9. **What would you do with two more weeks?** Steps (1)-(5) above; add nginx gateway, health checks, per-service Dockerfiles, and a CI job running `make test`.
