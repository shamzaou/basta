# FAST_PONG — ft_transcendence (42 Abu Dhabi)

Single-page web app: 3D Pong (Three.js) + TicTacToe, tournaments, profiles/friends/stats,
42 OAuth + email 2FA + JWT, GDPR tools. Django 4.2 / DRF / PostgreSQL 13 / Gunicorn (HTTPS on 443).

## Quick start

```bash
make build && make up      # https://localhost  (self-signed cert)
make test                  # 19 tests
make logs                  # follow container logs
make gdpr-cleanup          # dry run of the inactive-user GDPR cleanup
```

Configuration lives in `.env` (read at container start — run `make down && make up` after
editing). To demo 2FA without working Gmail credentials, add
`EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` to `.env` and read the code
from `gunicorn-error.log`.

## Documentation (Aug 2026 evaluation prep)

| Document | Purpose |
|----------|---------|
| `docs/FINAL-REPORT.md` | What was fixed, what remains for the team, how to use everything |
| `docs/audit-report.md` | Full issue log (root causes, severity, fixed/deferred) |
| `docs/study-guide/` | Revision guide: overview, architecture + Mermaid diagrams, per-module deep dives, `quick-drill.md` |
| `presentation/index.html` | Slide deck for the staff evaluation (open in a browser, arrow keys) |

## Repository layout (original notes)

.
├── backend/
│   ├── __init__.py
│   ├── __pycache__/
│   │   ├── __init__.cpython-313.pyc
│   │   └── settings.cpython-313.pyc
│   ├── asgi.py
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── gameapp/
│   ├── __init__.py
│   ├── admin.py
│   ├── apps.py
│   ├── migrations/
│   │   └── __init__.py
│   ├── models.py
│   ├── tests.py
│   └── views.py
├── manage.py
├── static/
│   └── frontend/
│       ├── assets/
│       ├── css/
│       │   └── styles.css
│       ├── index.html
│       └── js/
├── templates/
├── tenv/
│   ├── .gitignore
│   ├── Include/
│   ├── Lib/
│   │   └── site-packages/
│   ├── Scripts/
│   │   ├── activate
│   │   └── activate.bat
│   └── pyvenv.cfg
└── userapp/
    ├── __init__.py
    ├── admin.py
    ├── apps.py
    ├── migrations/
    │   └── ...
    ├── models.py
    ├── tests.py
    └── views.py