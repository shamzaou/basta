# Ali — speaking script (full)

You present **3 section(s)**, total ≈ **6.5 min** of speaking time. They come in this order during the talk:

| Order | Your section | Slides | Time |
|---|---|---|---|
| 02 | Software Development Life Cycle | 7–11 | 2.5 min |
| 07 | Profiles, Statistics & Friends | 29–31 | 2.5 min |
| 10 | Team & Conclusion | 40–43 | 1.5 min |

Other people speak between your sections — wait for the hand-over, then take the clicker. The `full/` wording is to rehearse, not to read aloud on the day; keep the `points/` version in your hand.



---
---

# 02 · Software Development Life Cycle — Ali (slides 7–11, about 2.5 minutes)

> Plain English, short sentences. This section is about *how* we worked, not about code.

---

## Slide 7 — Section divider

Thank you, Nour. My name is Ali. I will explain how we organised the development — our software development life cycle.

---

## Slide 8 — Chosen SDLC model: Agile

We chose an **Agile** model. It is iterative and incremental.

What does that mean for us? We worked in **short cycles**. Each cycle delivered one working feature. We merged it, tested it, and then started the next one.

Why Agile? We were four students. It was a learning project. Our requirements changed while we learned. A fixed plan, like the waterfall model, would not work for us.

Four ideas describe our process.

**First, iterative development.** We split the work into features: authentication, the Pong core, tournaments, profiles. Each feature had its own short cycle.

**Second, incremental delivery.** After every merge, the application still worked and could be tested. The functionality grew step by step.

**Third, flexibility.** When we understood the project better, we changed our plans and our technical approach.

**Fourth, collaboration and feedback.** We had daily check-ins. We worked in pairs on the difficult parts. Every merge was reviewed by another team member.

You can see the evidence in the repository: 86 commits between February and April 2025, and 15 pull requests merged from feature branches. In 2026 we added the pre-evaluation sweeps, which Nasser will present later.

---

## Slide 9 — Phases and iterations

We did not use formal sprints with fixed dates. But every feature went through the same six phases.

**One — planning.** We discussed the next feature, for example 2FA or the tournament logic, and agreed what "done" means.

**Two — design.** We sketched the data models, the API endpoints, and simple wireframes before writing code.

**Three — implementation.** Each feature was developed in its own Git branch, so it did not break the main code.

**Four — developer testing.** Unit tests for the backend logic, and manual checks by the developer.

**Five — integration and review.** A teammate reviewed the code in a pull request, then we merged the branch into master.

**Six — system testing.** We tested the feature inside the whole application, to find regressions.

---

## Slide 10 — Team collaboration and version control

Four people worked in parallel, so we needed clear rules and tools.

**Version control.** We used Git, with GitHub as the central repository. Every change is tracked and can be reverted.

**Branching strategy.** Feature branches — OAuth, tournaments, profile-page, and so on. Work in progress stayed away from master.

**Code reviews.** Every branch went through a pull request before merging. Fifteen pull requests in total.

**Communication.** A WhatsApp group for quick questions, and regular meetings on campus.

---

## Slide 11 — Gantt chart

This is our Gantt chart. It shows the project over time.

We started with planning and setup. Then the core frontend and the core backend. Then the feature implementation — this is the longest part. Then testing and integration. And finally, deployment.

The chart shows how long each task took, which tasks depended on other tasks, and the milestones.

That is our process. Now **Salim** will present the modules we selected and the design of the system.

---

## If they ask you a question

- *"Why not Scrum with sprints?"* — "We had irregular schedules because of other 42 projects. Feature cycles fit better than fixed two-week sprints."
- *"How did you handle merge conflicts?"* — "Small branches, frequent merges from master, and the reviewer checked the diff before merging."
- *"Did you write tests during development?"* — "Yes for the backend logic — tournaments and user views. Most of the current 54 tests were added in the 2026 audit."


---
---

# 07 · Profiles, Statistics & Friends — Ali (slides 29–31, about 2.5 minutes)

> Plain English. This is your own work — user data, history and statistics.

---

## Slide 29 — Section divider

Thank you, Nour. I'm Ali again. I worked on the user data — the profile information, the match history and the statistics. This section covers the user-management module and the stats-dashboard module, seen from the user's side.

---

## Slide 30 — Player profile and stats dashboard

Every finished game is saved: Pong against a player, Pong against the AI, and Tic-Tac-Toe. Each game creates one row in the **MatchHistory** table.

The profile page is the **user dashboard**. It shows three numbers.

**Games played** — the number of matches.

**Win rate** — wins divided by games, as a percentage. It is also drawn as a pie chart: green for wins, red for losses.

**Best score** — the win with the biggest difference, for example 3–0 is better than 3–2.

Below, the **recent matches**: a badge with the game type — PONG or TICTACTOE — the opponent, the score, the result, and the date.

On the right, the **friends** panel with a "Find Users" button. Every friend has a small dot: green means online, grey means offline.

The second screenshot is the **Settings** page. Here the user can change the display name, the e-mail and the avatar, switch two-factor authentication on or off — only for password accounts, a 42 account has no switch — and use the GDPR tools: Download my data, Anonymize, and Delete account. Salim will explain the GDPR tools.

---

## Slide 31 — Friends, match history and user data

Some details.

**User information.** We use a custom Django user model. The **e-mail** is the login. The **username** is unique. The **display name** is optional — it is a label shown to other users, and it must be unique: two users cannot have the same display name, even with different capital letters. The **avatar** is uploaded from the browser; if there is no avatar, we show a default picture. We check the file type — PNG, JPEG, GIF or WebP — and the size, maximum two megabytes. The model also has the 2FA flag and the 42 link.

**Friends.** The "Find Users" page lists every active user with an Add or Remove button. Only active accounts are shown, so anonymized accounts disappear from the list. The friends panel on the profile shows the friends' names, avatars and their **online status**. The browser sends a small "heartbeat" request every minute. If a friend was seen in the last two minutes, the dot is green. When a user logs out, the dot becomes grey at once. This is only a status — we do not have online play.

**Match history.** One row per game. The profile shows the last five. The API gives the last ten. The JSON export gives the full list.

**Statistics.** The numbers are computed on the server in the profile endpoint. The pie chart is an SVG that we draw by hand — no chart library.

One design decision: **tournament games are kept separate**. Tournament players are nicknames, not accounts, so we cannot add a tournament match to a user's personal record. The tournament has its own score table.

Now Salim will present GDPR and accessibility.

---

## If they ask you a question

- *"How do you handle duplicate usernames or e-mails?"* — "Both are unique in the database, and we compare them case-insensitively. A duplicate gives a clear error message at registration. The display name is also unique, compared case-insensitively — the server answers 'Display name already taken'."
- *"How does the online status work?"* — "The browser calls `/api/auth/heartbeat/` every minute while you are logged in. The server stores the time. A friend is online if the time is less than two minutes ago. Logout clears it. It is only a status, for example in two browsers on one computer — the games are not played online."
- *"How is the avatar stored?"* — "The browser sends it as base64 in a JSON PUT. The server decodes it, checks it with Pillow, and saves it as a file. An API endpoint serves it, with the default picture as fallback."
- *"Where does the win rate come from?"* — "`GET /api/auth/profile/` counts the MatchHistory rows on the server: wins divided by total, excluding tournament games."
- *"Can a user see another user's stats?"* — "Only their own profile in this version. A public profile page is a possible improvement."


---
---

# 10 · Team & Conclusion — Ali (slides 40–43, about 1.5 minutes)

> Plain English, short. This is the closing — end with energy.

---

## Slide 40 — Section divider

Thank you, Nasser. I'm Ali. I will close the presentation with the team and the conclusion.

---

## Slide 41 — Contribution of each member

Each member owned a group of modules from end to end — backend, frontend and tests — and reviewed the pull requests of the others.

**Salim** — the Graphics module: 3D Pong with Three.js and the physics. The Gameplay module: the second game, Tic-Tac-Toe, with match history and tournament matchmaking. And Cybersecurity and GDPR: anonymization, data export, account deletion, the retention cleanup and the privacy policy.

**Nasser** — Authentication: registration, login and sessions. Remote authentication: the 42 OAuth flow. And the 2FA and JWT module: e-mail codes, SimpleJWT tokens and their automatic refresh in the SPA.

**Me** — user history and statistics: the match history, the dashboard and the win-rate chart. User information: username, avatar, display name, e-mail, friends. And the database module: PostgreSQL, the models and the migrations.

**Nour** — the mandatory part: the tournament system with round-robin scheduling and tiebreakers. The front end: the SPA and the Bootstrap toolkit module. And the backend framework module: the Django project structure and the REST API.

---

## Slide 42 — Conclusion

Ft_transcendence is a complete, secure and fun web gaming platform. It satisfies all the modules we selected: **seven Major and six Minor — ten major-equivalents**, where seven are required.

We learned full-stack development with Django, a JavaScript SPA, Three.js and PostgreSQL inside Docker. We learned game logic, deployment and application security. Our Agile workflow with feature branches kept four developers productive, and the code reviewable.

The modular structure is a solid base for the next evolution: remote play, chat and a richer AI. And the pre-evaluation audit leaves the project with a green test suite and documented, root-caused fixes.

---

## Slide 43 — Thank you

Thank you for your attention. We are happy to answer your questions and to show you the demo.

---

## If they ask you a question

- *"Who did the most work?"* — "Everyone owned complete modules. Salim had the most commits because he integrated the frontend; the split on the slide is the ownership we agreed."
- *"What would you do differently?"* — "Write the tests from the first day, and test on the real multi-worker deployment early — that is where the 2FA bug came from."
- *"Can we see it running?"* — "Yes — `make up`, then https://localhost. Nasser will drive the demo."
