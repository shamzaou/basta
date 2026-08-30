# 10 · Team & Conclusion — Ali (slides 40–43, about 1.5 minutes)

> Plain English, short. This is the closing — end with energy.

---

## Slide 40 — Section divider

Thank you, Nasser. I'm Ali. I will close the presentation with the team and the conclusion.

---

## Slide 41 — Contribution of each member

Each member owned a group of modules from end to end — backend, frontend and tests — and reviewed the pull requests of the others.

**Salim** — the Graphics module: 3D Pong with Three.js and the physics. The Gameplay module: the second game, Tic-Tac-Toe, with online matchmaking and history. And Cybersecurity and GDPR: anonymization, data export, account deletion, the retention cleanup and the privacy policy.

**Nasser** — Authentication: registration, login and sessions. Remote authentication: the 42 OAuth flow. And the 2FA and JWT module: e-mail codes, SimpleJWT tokens and their automatic refresh in the SPA.

**Me** — user history and statistics: the match history, the dashboard and the win-rate chart. User information: username, avatar, display name, e-mail, friends. And the database module: PostgreSQL, the models and the migrations.

**Nour** — the mandatory part: the tournament system with round-robin scheduling and tiebreakers. The front end: the SPA and the Bootstrap toolkit module. And the backend framework module: the Django project structure and the REST API.

---

## Slide 42 — Conclusion

Ft_transcendence is a complete, secure and fun web gaming platform. It satisfies all the modules we selected: **seven Major and six Minor — ten major-equivalents**, where seven are required.

We learned full-stack development with Django, a JavaScript SPA, Three.js and PostgreSQL inside Docker. We learned online game logic, deployment and application security. Our Agile workflow with feature branches kept four developers productive, and the code reviewable.

The modular structure is a solid base for the next evolution: real-time online Pong, chat and a richer AI. And the pre-evaluation audit leaves the project with a green test suite and documented, root-caused fixes.

---

## Slide 43 — Thank you

Thank you for your attention. We are happy to answer your questions and to show you the demo.

---

## If they ask you a question

- *"Who did the most work?"* — "Everyone owned complete modules. Salim had the most commits because he integrated the frontend; the split on the slide is the ownership we agreed."
- *"What would you do differently?"* — "Write the tests from the first day, and test on the real multi-worker deployment early — that is where the 2FA bug came from."
- *"Can we see it running?"* — "Yes — `make up`, then https://localhost. Nasser will drive the demo."
