# Speaker scripts — FAST_PONG staff evaluation

Deck: `presentation/FAST_PONG-presentation.pdf` (43 slides, rebuilt with `python presentation/build_pdf_deck.py`).
Every section divider names its presenter and every content slide repeats it in the footer.

Two versions of every section:

| Folder | Use it for |
|---|---|
| `points/` | Bullet points only — what to cover on each slide. Print this and keep it in your hand. |
| `full/` | Word-for-word script + "If they ask" answers. Read it several times; do not read it aloud on the day. |

## Running order

| # | Section | Slides | Presenter | Time |
|---|---|---|---|---|
| 01 | Introduction | 3–6 | **Nour** | 2 min |
| 02 | Software Development Life Cycle | 7–11 | **Ali** | 2.5 min |
| 03 | Selected Modules & Design | 12–17 | **Salim** | 3.5 min |
| 04 | Authentication & Security | 18–21 | **Nasser** | 3.5 min |
| 05 | Games & Graphics | 22–25 | **Salim** | 3.5 min |
| 06 | Tournaments | 26–28 | **Nour** | 2 min |
| 07 | Profiles, Statistics & Friends | 29–31 | **Ali** | 2.5 min |
| 08 | GDPR & Accessibility | 32–34 | **Salim** | 2.5 min |
| 09 | Testing & Evolution | 35–39 | **Nasser** | 3.5 min |
| 10 | Team & Conclusion | 40–43 | **Ali** | 1.5 min |

Total ≈ 27 minutes with hand-overs. Slides 1–2 (title, contents): Nour says one sentence — "This is our team and here is the plan" — then starts section 01.

Per person: Nour 4 min · Ali 6.5 min · Salim 9.5 min · Nasser 7 min.

## Why this split

* Nour and Ali present the parts with the least technical Q&A risk and the parts they built (tournaments; profile / statistics / user data). Their scripts use short sentences and plain vocabulary.
* Nasser takes the sections most likely to draw hard questions: authentication (OAuth, 2FA, JWT) and the audit / limitations.
* Salim takes what remains: the module table, design, both games and graphics, GDPR and accessibility.

Questions can come at any time. If a question lands on the wrong person, say "Good question — <name> owns that part" and hand it over; the "If they ask" lists at the end of every full script say who can answer what.

## Before the day

1. `make up`, open https://localhost in Chrome **and** Firefox, accept the self-signed certificate in both.
2. `make test` → "Ran 54 tests … OK".
3. 42 OAuth: the new client key must be in `.env` (`FORTYTWO_CLIENT_ID/SECRET`, redirect URI exactly `https://localhost/oauth/callback`).
4. 2FA e-mail: a valid Gmail app password in `.env`, or `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` and read the code from `gunicorn-error.log`.
5. Two browser profiles logged in as two accounts for the online Tic-Tac-Toe demo.
6. Fill in the evaluation date on the title slide (`build_pdf_deck.py`, first slide) and rebuild.
