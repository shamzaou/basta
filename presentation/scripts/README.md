# Speaker scripts — FAST_PONG staff evaluation

Deck: `presentation/FAST_PONG-presentation.pdf` (36 slides, rebuilt with `python presentation/build_pdf_deck.py`).
Every section divider names its presenter and every content slide repeats it in the footer.

**Organised by person:** `by-person/` has one file per teammate with all of their sections stitched together in speaking order — `by-person/<name>-points.md` (hold this) and `by-person/<name>-full.md` (rehearse this). Start there. The per-section files below stay for anyone who prefers them split by topic.

Two versions of every section:

| Folder | Use it for |
|---|---|
| `points/` | Bullet points only — what to cover on each slide. Print this and keep it in your hand. |
| `full/` | Word-for-word script + "If they ask" answers. Read it several times; do not read it aloud on the day. |

## Running order

| # | Section | Slides | Presenter | Time |
|---|---|---|---|---|
| 01 | Introduction | 3–5 | **Nour** | 1.5 min |
| 02 | Software Development Life Cycle | 6–10 | **Ali** | 2.5 min |
| 03 | Selected Modules & Design | 11–15 | **Salim** | 3.5 min |
| 04 | Authentication & Security | 16–19 | **Nasser** | 3.5 min |
| 05 | Games & Graphics | 20–23 | **Salim** | 3.5 min |
| 06 | Tournaments | 24–26 | **Nour** | 2 min |
| 07 | Profiles, Statistics & Friends | 27–29 | **Ali** | 2.5 min |
| 08 | GDPR & Accessibility | 30–32 | **Nasser** | 2.5 min |
| 09 | Team & Conclusion | 33–36 | **Ali** | 1.5 min |

Total ≈ 23 minutes with hand-overs. Slides 1–2 (title, contents): Nour says one sentence — "This is our team and here is the plan" — then starts section 01.

Per person: Nour ≈ 3.5 min · Ali ≈ 6.5 min · Salim ≈ 6.5 min · Nasser ≈ 6 min.

Section 02 (SDLC) now includes a "Challenges and Lessons Learned" slide (the microservices attempt and the Git-collaboration lesson). There is no separate Testing section any more.

## Why this split

* Nour and Ali present the parts with the least technical Q&A risk and the parts they built (introduction and tournaments; SDLC, profile / statistics / user data, and the closing). Their scripts use short sentences and plain vocabulary.
* Nasser takes the sections most likely to draw hard security questions: authentication (OAuth, 2FA, JWT) and GDPR / accessibility.
* Salim takes the module table and design, and both games and graphics.

Questions can come at any time. If a question lands on the wrong person, say "Good question — <name> owns that part" and hand it over; the "If they ask" lists at the end of every full script say who can answer what.

## Before the day

1. `make up`, open https://localhost in Chrome **and** Firefox, accept the self-signed certificate in both.
2. `make test` → "Ran 54 tests … OK".
3. 42 OAuth: the new client key must be in `.env` (`FORTYTWO_CLIENT_ID/SECRET`, redirect URI exactly `https://localhost/oauth/callback`).
4. 2FA e-mail: a valid Gmail app password in `.env`, or `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` and read the code from `gunicorn-error.log`.
5. Two browser profiles logged in as two accounts, to show friends and the online / offline status (there is no online play).
6. Fill in the evaluation date on the title slide (`build_pdf_deck.py`, first slide) and rebuild.
