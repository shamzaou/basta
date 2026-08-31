# 02 · Software Development Life Cycle — Ali (slides 6–10, about 2.5 minutes)

> Plain English, short sentences. This section is about *how* we worked, not about code.

---

## Slide 6 — Section divider

Thank you, Nour. My name is Ali. I will explain how we organised the development — our software development life cycle.

---

## Slide 7 — Chosen SDLC model: Agile

We chose an **Agile** model. It is iterative and incremental.

What does that mean for us? We worked in **short cycles**. Each cycle delivered one working feature. We merged it, tested it, and then started the next one.

Why Agile? We were four students. It was a learning project. Our requirements changed while we learned. A fixed plan, like the waterfall model, would not work for us.

Four ideas describe our process.

**First, iterative development.** We split the work into features: authentication, the Pong core, tournaments, profiles. Each feature had its own short cycle.

**Second, incremental delivery.** After every merge, the application still worked and could be tested. The functionality grew step by step.

**Third, flexibility.** When we understood the project better, we changed our plans and our technical approach.

**Fourth, collaboration and feedback.** We had daily check-ins. We worked in pairs on the difficult parts. Every merge was reviewed by another team member.

You can see the evidence in the repository: 86 commits between February and April 2025, and 15 pull requests merged from feature branches. In 2026 we also did several pre-evaluation sweeps to fix bugs and tighten security.

---

## Slide 8 — Phases and iterations

We did not use formal sprints with fixed dates. But every feature went through the same six phases.

**One — planning.** We discussed the next feature, for example 2FA or the tournament logic, and agreed what "done" means.

**Two — design.** We sketched the data models, the API endpoints, and simple wireframes before writing code.

**Three — implementation.** Each feature was developed in its own Git branch, so it did not break the main code.

**Four — developer testing.** Unit tests for the backend logic, and manual checks by the developer.

**Five — integration and review.** A teammate reviewed the code in a pull request, then we merged the branch into master.

**Six — system testing.** We tested the feature inside the whole application, to find regressions.

---

## Slide 9 — Challenges and Lessons Learned

Not everything went to plan. Two problems taught us the most.

**First, we wanted microservices.** DevOps has a module to design the backend as microservices — many small services instead of one. We tried it. But the containers could not communicate and coordinate well, and making them work together took too much of our time.

So we made a decision. We built a **modular monolith** instead: one Django backend with three clean apps — userapp, gameapp and tournaments. It gives the same separation of concerns, and — most important — it actually runs. A working monolith is better than a half-built microservices system.

**Second, we lost some work on GitHub.** At the start we did not use Git well together. We edited the same files without branches. So when we merged, our changes overwrote each other, and some progress was lost.

The **lesson** we learned: one branch for each feature, always pull before you push, and merge only through a pull request that a teammate reviews. After we followed these rules we never lost work again — and it is exactly why we can trust our git history today.

## Slide 10 — Gantt chart

This is our Gantt chart. It shows the project over time.

We started with planning and setup. Then the core frontend and the core backend. Then the feature implementation — this is the longest part. Then testing and integration. And finally, deployment.

The chart shows how long each task took, which tasks depended on other tasks, and the milestones.

That is our process. Now **Salim** will present the modules we selected and the design of the system.

---

## If they ask you a question

- *"Why not Scrum with sprints?"* — "We had irregular schedules because of other 42 projects. Feature cycles fit better than fixed two-week sprints."
- *"How did you handle merge conflicts?"* — "Small branches, frequent merges from master, and the reviewer checked the diff before merging."
- *"Why didn't you do the microservices module?"* — "We tried it, but our containers could not communicate and coordinate reliably in the time we had. A working modular monolith — one Django backend, three apps — was the better choice, and it is not a module we claim."
- *"How exactly did you lose work on GitHub?"* — "Early on we edited the same files without branches, so a merge overwrote a teammate's changes. We then moved to one branch per feature and reviewed pull requests, and it stopped happening."
- *"What would you do differently?"* — "Set up the Git discipline — branches, pull-before-push, pull requests — from day one, and decide the architecture up front instead of trying microservices late."
- *"Did you write tests during development?"* — "Yes for the backend logic — tournaments and user views. Most of the current 54 tests were added in the 2026 audit."
