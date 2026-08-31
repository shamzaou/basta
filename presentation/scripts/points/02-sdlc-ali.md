# 02 · Software Development Life Cycle — Ali (slides 6–10, about 2.5 minutes)

## Slide 6 — Section divider
- Introduce yourself; you cover *how* the team worked.

## Slide 7 — Chosen SDLC model: Agile (iterative & incremental)
- We chose **Agile** — short cycles, one working feature per cycle.
- Why: 4 people, learning project, requirements changed while we learned.
- Four ideas:
  1. **Iterative** — features one by one: authentication, Pong, tournaments, profiles.
  2. **Incremental** — after every merge the app still runs and can be tested.
  3. **Flexibility** — we changed plans when we understood more.
  4. **Collaboration** — daily check-ins, pair work on hard parts, review of every merge.
- Evidence: 86 commits (Feb–Apr 2025), 15 pull requests from feature branches, plus the 2026 pre-evaluation sweeps.

## Slide 8 — Phases and iterations
- No formal sprints, but every feature went through the same 6 phases:
  1. Planning → 2. Design (models, endpoints, wireframes) → 3. Implementation (own branch)
  → 4. Developer testing → 5. Integration & review (pull request, merge to master) → 6. System testing.

## Slide 8 — Challenges and lessons learned
- **We aimed for microservices** — the DevOps module — but the containers could not communicate / coordinate well, and wiring them together ate our time.
- **We chose a modular monolith instead** — one Django backend, three clean apps (userapp, gameapp, tournaments): same separation of concerns, and it actually runs. A working monolith beats a half-built microservices setup.
- **We lost some work on GitHub** — early on we edited the same files without branches, so merges overwrote each other.
- **Lesson learned** — one branch per feature, pull before you push, merge only through a reviewed pull request. After that we never lost work again.

## Slide 10 — Gantt chart
- Phases: planning & setup → core frontend → core backend → features → testing & integration → deployment.
- Shows durations, dependencies and milestones.
- Hand over: "Salim will now present the modules we selected and the design."
