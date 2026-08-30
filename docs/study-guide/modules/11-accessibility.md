# Modules — Accessibility: Expanding Browser Compatibility (Minor) · Server-Side Rendering (SSR) Integration (Minor)

("Support on all devices" is **not** a selected module any more — the responsive layout and the Pong touch controls remain as features; see `modules/10-graphics-3d.md`.)

## 1. Expanding browser compatibility (Minor)

**Verdict: Code is browser-neutral ✅ — cross-browser testing still to be done by the team ⚠️.**

*Subject:* add support for an additional browser, test and fix rendering discrepancies, keep a consistent experience.

What is in place: standard ES modules (`<script type="module">`), `fetch`, `localStorage`, WebGL through Three.js r128, CSS grid/flexbox, no vendor-prefixed or Chrome-only APIs; dates come from the API as ISO-8601 and are formatted with `toLocaleDateString()` (the old `"24 Aug 2026"` strings broke `new Date()` in Firefox — fixed in the second sweep); `touch-action: none` + pointer events for the game canvas. Console is clean in Chrome on every page.

**Before the defense:** open the site in Firefox (and Safari if available), walk through login → profile → Pong vs AI → tournament, note anything you fixed — the evaluator will ask which browser was added and what you tested.

## 2. Server-Side Rendering (SSR) integration (Minor) — 🆕 real SSR since the Aug-2026 subject-compliance pass

**Verdict: Works ✅.** *Subject:* pre-render content on the server for faster first paint and SEO, while keeping the SPA experience.

How it works:
1. Every URL falls into the catch-all `re_path(r'^.*$', index)` (`backend/urls.py:17`). `gameapp.views.index` (`gameapp/views.py:38-61`) maps the first path segment to one of the nine pages (`SSR_PAGES`, `:24-35`), sends anonymous visitors of login-only pages to the login view (`LOGIN_REQUIRED_PAGES`), and picks a per-page `<title>` and `<meta name="description">`.
2. For a logged-in session it computes the profile summary on the server (`build_profile_summary`, `userapp/views.py:80-130` — the same helper the `/api/auth/profile/` endpoint uses) and passes it as `ssr_profile`.
3. The template (`templates/frontend/index.html`) renders `<title>{{ ssr_title }}</title>` and the meta tag (`:9-10`), `<body data-ssr-page=… data-ssr-logged-in=…>` (`:17`), gives the requested page `class="page active"` (`:59`, `:84`, …) so it is visible before any JavaScript runs, pre-sets the nav lists (`:30`, `:38`) and fills the profile (username, joined, stats, last matches — `:93-120`) with Django's auto-escaping.
4. `script.js:152` starts the router from `document.body.dataset.ssrPage`, then hydrates (fetches fresh data and replaces the same elements).

Tests: `gameapp/tests.py` (title contains "Profile", username present in the HTML for a logged-in client; anonymous `/profile` renders the login page). Live: `curl -k https://localhost/about` returns the About title/description without JavaScript.

## Status after audit (both)
SSR ✅ verified; browser compatibility ⚠️ needs the team's manual test on a second browser.

## Likely evaluator questions
1. **What is server-rendered?** The page skeleton *with* the requested page active, per-route title/description, and the profile data for logged-in users — the HTML is meaningful before JS.
2. **Isn't a template-served SPA already SSR?** Before this change the server returned an empty shell; now the server decides the page and pre-renders its content — that's the difference.
3. **How does hydration avoid a flash?** The server-active page is the same one the router would show; `showPage(initial, pushState=false)` just re-applies it.
4. **Which second browser?** Firefox (say what you tested and fixed — e.g. ISO dates).
5. **Any browser-specific code?** None; feature detection is unnecessary because only baseline APIs are used.
