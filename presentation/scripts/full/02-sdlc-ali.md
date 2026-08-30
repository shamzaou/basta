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
