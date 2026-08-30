# 08 · GDPR & Accessibility — Salim (slides 32–34, about 2.5 minutes)

---

## Slide 32 — Section divider

Thanks, Ali. Two short topics from me: the GDPR minor module, and the two accessibility minors — browser compatibility and server-side rendering.

---

## Slide 33 — GDPR compliance

The module title lists three things: anonymization, local data management and account deletion. We have all three, plus retention.

**Anonymization.** "Anonymize My Account" in Settings strips every personal identifier: the username and e-mail become `anon_` plus a random token, the avatar file is deleted, the display name is cleared, the 42 link is removed, the friends lists are cleared, the password is made unusable and the account is disabled and logged out. The non-personal game statistics stay in the database — that is the point of anonymization versus deletion. It works for 42 accounts too: because the 42 e-mail and intra id are removed, the next 42 login creates a fresh account.

**Local data management.** "Download my data" returns a JSON file with the profile, the statistics and the full match history; the SPA adds the avatar as base64. Users can view and edit their display name, e-mail and avatar in Settings.

**Account deletion.** A hard delete after confirmation. The user row goes, and the database cascades: match history, friend links and tokens.

**Retention.** A management command, `delete_inactive_users`, warns by e-mail after five months of inactivity and deletes after six. A middleware stamps `last_activity` at most every fifteen minutes so it doesn't cost a write per request. It runs with `make gdpr-cleanup`.

And information: the privacy policy on the About page lists the data we collect, why, how long, and the user's rights.

---

## Slide 34 — Browser compatibility and server-side rendering

**Expanding browser compatibility.** Our primary browser is Chrome, with Edge as the same engine. The additional browser is **Firefox**. The application uses only standard web APIs — ES modules, `fetch`, `localStorage`, the History API, CSS Grid and Flexbox, WebGL 1 — with no vendor prefixes and no polyfills. We did hit Firefox-specific issues and fixed them: match dates are now ISO-8601 so `new Date()` parses them in Firefox, input uses pointer events instead of separate mouse and touch events, and fonts have fallbacks. Testing was manual in both browsers, plus an automated headless-Chrome walkthrough of every page.

**Server-side rendering.** Every URL is answered by Django's `index` view, which renders the *requested* page as complete HTML: the right section is already active, the navigation reflects whether you are logged in, the `<title>` and meta description are set per page, and for a logged-in user the profile — username, statistics, recent matches — is rendered into the HTML on the server before any JavaScript runs. Then the SPA hydrates and takes over routing. If you view-source `/profile` while logged in, you see real content, not an empty `div`. That gives a faster first paint and crawlable public pages.

**Responsive layout** is on the slide because people will ask: breakpoints at 1100, 920, 768 and 480 pixels, a hamburger menu, a fluid game canvas and touch controls. We kept it as a feature; "support on all devices" is not a module we claim.

Nasser closes with testing and evolution.

---

## If they ask

- *"Anonymize or delete — which one satisfies the module?"* — Both exist; anonymization is what the title names, deletion is the stricter "right to be forgotten".
- *"Is the cleanup cron running in the container?"* — Honestly: the crontab file is provided and the command works, but cron is not installed in the image; retention is enforced when `make gdpr-cleanup-run` is executed. That's a listed limitation.
- *"Is consent collected?"* — Registration implies acceptance; the policy is public. An explicit checkbox and cookie notice would be the improvement; we only use first-party functional cookies.
- *"Why not a real SSR framework?"* — The subject forbids front-end frameworks beyond the toolkit; Django's template engine is the sanctioned server renderer, and it now renders page state, not just a shell.
- *"What breaks on old browsers?"* — ES modules and `aspect-ratio` on IE or very old Safari — out of scope.
