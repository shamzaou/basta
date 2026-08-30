# 08 · GDPR & Accessibility — Salim (slides 32–34, about 2.5 minutes)

## Slide 32 — Section divider

## Slide 33 — GDPR compliance (Minor module: anonymization, local data management, deletion)
- **Anonymization** — "Anonymize My Account": username/e-mail → `anon_<token>`, avatar deleted, display name cleared, 42 link removed, friends cleared, password unusable, account disabled, logged out. Non-personal stats stay. Works for 42 accounts (next 42 login creates a fresh account).
- **Local data management** — "Download my data": JSON with profile, statistics, full match history (+ avatar as base64); edit display name / e-mail / avatar in Settings.
- **Account deletion** — hard delete with cascade (match history, friend links, tokens), after confirmation.
- **Retention** — `delete_inactive_users`: warn at 5 months, delete at 6; `last_activity` via middleware (`make gdpr-cleanup`).
- **Information** — privacy policy on the About page (data collected, use, retention, rights).

## Slide 34 — Browser compatibility and SSR (2 Minor modules) + responsive (feature)
- **Browser compatibility**: primary Chrome/Edge, additional **Firefox**. Standard APIs only (ES modules, fetch, localStorage, History API, Grid/Flexbox, WebGL 1). Fixes made for Firefox: ISO-8601 dates, pointer events, font fallbacks. Tested manually in both + headless-Chrome walkthrough.
- **SSR**: Django `index` view renders the *requested* page — active section, nav in the right login state, `<title>` + meta description, and for logged-in users the **profile data** (username, stats, recent matches) already in the HTML. SPA hydrates and takes over. View-source shows real content → faster first paint, SEO.
- **Responsive** (feature, not a claimed module): breakpoints 1100 / 920 / 768 / 480, hamburger menu, fluid canvas, touch controls.

## Be ready for
- "The module says anonymization" → yes, implemented; deletion also exists (stricter).
- Is the cron installed? The crontab file exists; the command runs via `make gdpr-cleanup-run` — say it honestly.
- Why not Next/Nuxt for SSR? Subject forbids front-end frameworks; Django templates are the sanctioned server renderer.
- Hand over to Nasser: testing and evolution.
