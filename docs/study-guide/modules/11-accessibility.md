# Modules — Accessibility: support on all devices, expanded browser compatibility, SSR integration (3 Minors)

| Minor | Verdict |
|---|---|
| Support on all devices (responsive) | Works ✅ — custom media queries + hamburger menu; verified at 1280×800 and 390×844 |
| Expanding browser compatibility | Works on Chrome/Edge/Firefox ✅ — modern-browser features only, no polyfills ⚠️ |
| Server-Side Rendering integration | Partial ⚠️ — Django renders the SPA shell template; no per-route data rendering |

(*Multiple language support* is **not** a selected module. A switcher built during the audit was removed again in the follow-up; nothing of it remains in the code.)

## 1. Support on all devices (responsive design)

**Requirement:** the website works on desktops, laptops, tablets and phones; layout and interaction adapt (touch, screen size).

| Concern | Where | Ref |
|---|---|---|
| Viewport meta | `<meta name="viewport" content="width=device-width, initial-scale=1.0">` | `templates/frontend/index.html:8` |
| Breakpoints | `@media (max-width: 768px)` ×8, `480px` ×2, `920px`, `1100px` | `static/frontend/css/styles.css` (grep `@media`; first at `:714`) |
| Base font scaling | `body,html { font-size: 14px }` under 768 px | `styles.css` (inside the first 768 px block) |
| Hamburger menu | `.hamburger` hidden on desktop (`:206`), shown ≤768 px (`:756`); nav lists hidden until `.active`; JS toggle + click-outside close | `styles.css`, `static/frontend/js/script.js:600-633` |
| Fluid grids | profile stats `repeat(auto-fit, minmax(200px,1fr))`; profile/friends two columns → one column at 920 px; team grid | `styles.css` (grep `auto-fit`, `920px`) |
| Game canvas | `calculateSize()` keeps 4:3 inside the container, max 800×600; `resize` listener | `static/frontend/js/pong.js:316-331`, `:117` |
| TicTacToe board (extra feature) | CSS grid `max-width:300px`, `aspect-ratio:1` cells | `static/frontend/js/tictactoe.js:33-53` |
| Tables | `.table-container` wrappers for tournament tables | `templates/frontend/index.html:530-565` |
| Bootstrap `.container` | responsive max-widths | `index.html` (37 uses) |

Verified: screenshots `16-mobile-home`, `17-mobile-menu-open`, `18-mobile-profile` (390 px wide) and the desktop set.

Q&A: *How do you handle phones?* Media queries at 768/480 px, hamburger nav, fluid grids, viewport meta. *Can you play Pong on a phone?* It renders and scales, but controls are keyboard-only (W/S, arrows) — limitation; touch controls are a listed improvement. *Why custom breakpoints instead of the Bootstrap grid?* CSS Grid/Flexbox gave finer control for the arcade layout; Bootstrap supplies `.container` and buttons.

## 2. Expanding browser compatibility

**Requirement:** support an additional web browser beyond the primary one, with consistent behaviour and fixes for browser-specific issues.

* Primary: Chrome/Chromium (Edge). Additional: Firefox. The audit ran an automated headless-Chrome walkthrough (0 console errors); the code uses only standard APIs.
* Features relied on and their support: ES modules `type="module"` (`index.html:601`), `fetch` + `AbortController` (`script.js:327`), `localStorage`, `history.pushState/popstate` (`script.js:67`, `:121`), CSS Grid/Flexbox/custom properties, `aspect-ratio` (TicTacToe cells — Firefox ≥ 89), WebGL 1 (Three.js r128), `FileReader.readAsDataURL` (`script.js:776`), `URL.createObjectURL` for the GDPR download (`script.js:1627`).
* No transpilation or polyfills; no vendor prefixes needed for these features in current browsers.
* Self-signed certificate: each browser must accept the `localhost.pem` warning once.
* Known differences: Firefox may block CDN fonts more aggressively (falls back to `cursive`/sans-serif); `alert()`/`confirm()` dialogs look different; nothing functional.

Q&A: *Which browsers?* Chrome + Firefox (+Edge as Chromium). *What would break on old browsers?* ES modules and `aspect-ratio` on IE/old Safari — out of scope. *How did you test?* Manual runs in both browsers during development; the audit added an automated headless-Chrome walkthrough of every page.

## 3. Server-Side Rendering (SSR) integration

**Requirement:** integrate SSR to improve initial load/SEO while keeping SPA behaviour.

What exists:
* Every route is answered by Django's catch-all (`backend/urls.py:16`) → `gameapp/views.py:3` `index()` → `render(request, 'frontend/index.html')`. The full page (all eight `.page` sections, nav, OTP modal, privacy-policy text) is **rendered server-side by the Django template engine** (`backend/settings.py` `TEMPLATES`), including `{% static %}` URLs resolved through the WhiteNoise manifest (hashed file names, `index.html:14`, `:599-606`) and the `{% csrf_token %}` hidden input (`:17`).
* The browser therefore receives complete HTML on the first request for any deep link (`/profile`, `/tournament`); then `script.js` (`window 'load'` → `showPage`, `script.js:132-138`) takes over routing without further full-page loads.
* Auth-dependent data (profile, friends, tournaments) is fetched client-side after load.

Honest framing: "template-level SSR of the application shell with server-resolved asset URLs and CSRF, not per-route data hydration." Improvement path: render the initial page state (user) into the template context, or pre-render profile data into a `<script type="application/json">` block.

Q&A: *Where is SSR?* `index()` + Django templates; view-source shows full HTML, not an empty `<div id="root">`. *Why not Next/Nuxt?* The subject forbids front-end frameworks beyond the toolkit; Django templates are the sanctioned server renderer. *What is rendered on the server vs client?* Shell/markup/text/asset URLs server-side; user data client-side. *Does SEO benefit?* Public pages (home, about incl. privacy policy) are fully crawlable.

## Status after audit (all three)
Responsive ✅, browsers ✅, SSR partial ⚠️. Nothing in these modules was changed by the audit.
