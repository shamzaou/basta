# Modules — Accessibility: responsive design, expanded browser compatibility, multiple languages, SSR (4 Minors)

| Minor | Verdict |
|---|---|
| Support on all devices (responsive) | Works ✅ — custom media queries + hamburger menu; verified at 1280×800 and 390×844 |
| Expanded browser compatibility | Works on Chrome/Edge/Firefox ✅ — modern-browser features only, no polyfills ⚠️ |
| Multiple language support | Works ✅ 🆕 — EN/FR/RU switcher added in the Aug-2026 audit |
| Server-Side Rendering integration | Partial ⚠️ — Django renders the SPA shell template; no per-route data rendering |

## 1. Responsive design

**Requirement:** the site works on desktops, tablets and phones; layout and games adapt.

| Concern | Where | Ref |
|---|---|---|
| Viewport meta | `<meta name="viewport" content="width=device-width, initial-scale=1.0">` | `templates/frontend/index.html:8` |
| Breakpoints | `@media (max-width: 768px)` ×8 (`:730`, `:763`, `:873`, `:980`, `:1138`, `:1736`, `:1816`, `:1854`), `480px` (`:816`, `:2166`), `920px` (`:1541`), `1100px` (`:1572`) | `static/frontend/css/styles.css` |
| Base font scaling | `body,html { font-size: 14px }` under 768 px | `styles.css:765` |
| Hamburger menu | `.hamburger` hidden on desktop `:222`, shown ≤768 px `:772`; nav lists hidden until `.active` `:776-790`; JS toggle + click-outside close | `styles.css`, `static/frontend/js/script.js:600-633` |
| Fluid grids | profile stats `repeat(auto-fit, minmax(200px,1fr))` `:366`; profile/friends `2fr 320px` → `1fr` at 920 px `:1369`, `:1543`; team grid `:1684` | `styles.css` |
| Game canvas | `calculateSize()` keeps 4:3 within the container, max 800×600 | `static/frontend/js/pong.js:316-331` |
| TicTacToe board | CSS grid `max-width:300px`, `aspect-ratio:1` cells | `static/frontend/js/tictactoe.js:33-53` |
| Tables | `.table-container` wrappers for tournament tables | `templates/frontend/index.html:533-568` |
| Bootstrap `.container` | responsive max-widths | `index.html` (37 uses) |

Verified: screenshots `16-mobile-home`, `17-mobile-menu-open`, `18-mobile-profile` (390 px wide) and desktop set. 🆕 the language `<select>` sits inside both nav lists so it collapses into the hamburger menu on mobile (`index.html:34`, `:43`; CSS `styles.css:206-219`).

Q&A: *How do you handle phones?* Media queries at 768/480 px, hamburger nav, fluid grids, viewport meta. *Can you play Pong on a phone?* It renders and scales, but controls are keyboard-only (W/S, arrows) — limitation; touch controls are a listed improvement. *Why custom breakpoints instead of Bootstrap grid?* CSS Grid/Flexbox gave finer control for the arcade layout.

## 2. Expanded browser compatibility

**Requirement:** support an additional browser beyond the primary one, with consistent behaviour.

* Primary: Chrome/Chromium (Edge). Additional: Firefox. Tested in the audit with headless Chrome; the code uses only standard APIs.
* Features relied on and their support: ES modules `type="module"` (`index.html:604`), `fetch` + `AbortController` (`script.js:327`), `localStorage`, `history.pushState/popstate` (`script.js:67`, `:121`), CSS Grid/Flexbox/custom properties, `aspect-ratio` (tictactoe cells — Firefox ≥ 89), WebGL 1 (Three.js r128), `FileReader.readAsDataURL` (`script.js:776`), `URL.createObjectURL` for the GDPR download (`script.js:1590`), `<select>`/`textContent` for i18n.
* No transpilation or polyfills; no vendor prefixes needed for these features in current browsers.
* Self-signed certificate: each browser must accept the `localhost.pem` warning once.
* Known differences: Firefox blocks third-party-cookie-less CDN fonts more aggressively (falls back to `cursive`/sans-serif); `alert()`/`confirm()` dialogs look different; nothing functional.

Q&A: *Which browsers?* Chrome + Firefox (+Edge as Chromium). *What would break on old browsers?* ES modules and `aspect-ratio` on IE/old Safari — out of scope. *How did you test?* Manual runs in both browsers; audit added an automated headless-Chrome walkthrough with zero console errors.

## 3. Multiple language support 🆕

**Requirement:** at least three languages, a switcher, persisted preference, default language fallback.

**🆕 Changed in Aug-2026 audit:** this module did not exist in the code base; it was implemented client-side.

| Concern | Where | Ref |
|---|---|---|
| Translation table (en, fr, ru; ~80 keys each) | `TRANSLATIONS` | `static/frontend/js/i18n.js:19-160` |
| Language detection (saved `lang` → browser `navigator.language` → `en`) | `currentLanguage()` | `i18n.js:163-170` |
| Lookup with English fallback | `t(key, lang)` | `i18n.js:172-176` |
| Apply: swaps `textContent` of every `[data-i18n]`, `placeholder` of `[data-i18n-placeholder]`, sets `<html lang>`, saves to `localStorage.lang`, syncs selects | `applyLanguage(lang)` | `i18n.js:178-193` |
| Switcher | `<select class="lang-select">` in both nav lists, options built at load | `index.html:34`, `:43`; `buildSelectors` `i18n.js:195-207` |
| Attributes on static text | 94 `data-i18n` / `data-i18n-placeholder` attributes (nav, home, profile, settings, about headings, login, register, tournament, OTP modal) | `templates/frontend/index.html` |
| JS strings | `window.t('js.confirm_anonymize')`, `t('js.anonymized')` | `script.js:834`, `:854` |
| Load order | `i18n.js` before `script.js` | `index.html:601-602` |
| Style | `.lang-select` | `styles.css:206-219` |

Not translated (say so if asked): dynamic strings created in `script.js` (alerts, "Loading…", friend list empty states, tournament status text), the privacy policy body, e-mails. Django's own `USE_I18N=True`/`LANGUAGE_CODE='en-us'` (`backend/settings.py:139-143`) are defaults and not used for API messages.

Q&A: *How does switching work?* Change event → `applyLanguage` → DOM text swap, no reload; preference persists across reloads via localStorage. *Why client-side and not Django `gettext`?* The UI is a single static template; a JS dictionary translates instantly without a round-trip and works with the SPA router. *How would you add Arabic?* Add a table entry and handle `dir="rtl"` in `applyLanguage`. *Screenshots:* `05-home-fr`, `06-home-ru`.

## 4. Server-Side Rendering (SSR) integration

**Requirement:** integrate SSR to improve initial load/SEO while keeping SPA behaviour.

What exists:
* Every route is answered by Django's catch-all (`backend/urls.py:16`) → `gameapp/views.py:3` `index()` → `render(request, 'frontend/index.html')`. The full page (all eight `.page` sections, nav, OTP modal, privacy policy text) is **rendered server-side by the Django template engine** (`backend/settings.py:157` `TEMPLATES`), including `{% static %}` URLs resolved through the WhiteNoise manifest (hashed file names, `index.html:14`, `:601-606`) and the `{% csrf_token %}` hidden input (`:17`).
* The browser therefore receives complete HTML on first request for any deep link (`/profile`, `/tournament`), then `script.js` (`window 'load'` → `showPage`, `script.js:132-138`) takes over routing without further full-page loads.
* Auth-dependent data (profile, friends, tournaments) is fetched client-side after load.

Honest framing: "template-level SSR of the application shell with server-resolved asset URLs and CSRF, not per-route data hydration." Improvement path: render the initial page state (user, language) into the template context, or pre-render profile data into a `<script type="application/json">` block.

Q&A: *Where is SSR?* `index()` + Django templates; view-source shows full HTML, not an empty `<div id="root">`. *Why not Next/Nuxt?* Subject forbids front-end frameworks beyond the toolkit; Django templates are the sanctioned server renderer. *What is rendered on the server vs client?* Shell/markup/text/asset URLs server-side; user data client-side. *Does SEO benefit?* Public pages (home, about incl. privacy policy) are fully crawlable.

## Status after audit (all four)
Responsive ✅, browsers ✅, languages ✅ 🆕, SSR partial ⚠️. All static UI is translated; games and API messages remain English.
