# Module — Web: Front-end toolkit, Bootstrap (Minor)

**Verdict: Works, but usage is light ⚠️** — Bootstrap 4.5.2 is loaded from a CDN and a handful of its utility/button classes are used; the retro look comes from the team's own `static/frontend/css/styles.css` (2 200 lines).

## What the module requires (42 subject wording)
"Use a front-end framework or toolkit" — the front-end must be built with the chosen toolkit (Bootstrap) on top of vanilla JavaScript. No other front-end framework (React/Vue) is used, which satisfies the "vanilla JS" base rule.

## What it does in FAST_PONG
* Bootstrap CSS provides the grid/container reset, `.btn*` base styles and the responsive `.container` widths.
* Bootstrap JS (+ jQuery slim + Popper) is loaded for completeness; no Bootstrap JS component (modal, dropdown, collapse) is actually initialised — the OTP modal, avatar dropdown and hamburger menu are hand-written in `styles.css`/`script.js`.
* Everything else (neon theme, Press Start 2P font, pong animation, profile cards, tournament tables, hamburger) is custom CSS.

## Exactly where it is implemented

| What | Where | Ref |
|---|---|---|
| Bootstrap CSS from CDN | `<link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">` | `templates/frontend/index.html:10` |
| Bootstrap JS + jQuery + Popper (CDN) | `<script>` tags at the end of body | `templates/frontend/index.html:612-614` |
| Google Fonts (Press Start 2P, Roboto, Orbitron) | `<link>` | `templates/frontend/index.html:11-12` |
| Custom stylesheet (overrides Bootstrap) | `{% static 'frontend/css/styles.css' %}` | `templates/frontend/index.html:14` |
| Bootstrap classes actually used | `.container` (37×), `.btn` (7×), `.btn-group` + `.text-center` (home CTA, `:72-73`), `.btn-primary` (`:232`), `.btn-secondary` (`:220`, `:238`), `.btn-danger` (`:245`) | `templates/frontend/index.html` |
| Custom theme variables | `:root { --primary-color:#00ff00; --secondary-color:#ff00ff; --background-color:#000 }` | `static/frontend/css/styles.css:18-21` |
| Hand-made components | header/nav `:81-135`, `.hamburger` `:206`, `.modal`/OTP, profile grid `:366`, tournament tables | `static/frontend/css/styles.css` |
| Responsive breakpoints | `@media (max-width: 768px)` ×8, `480px` ×2, `920px`, `1100px` | `static/frontend/css/styles.css:730-2166` |

No `.row`/`.col-*` grid classes are used — layout is CSS Grid/Flexbox in `styles.css`.

## How it interacts with the rest
Bootstrap only affects presentation. The SPA router (`script.js` → `showPage`) toggles `.page` divs; Bootstrap's `.container` keeps content widths consistent across the eight pages; `.btn*` classes give the Settings/GDPR buttons their base box model before `styles.css` recolours them.

**🆕 Changed in Aug-2026 audit:** the Danger Zone gained an "Anonymize My Account" `.btn.btn-secondary` (`index.html:236`). (A language switcher was briefly added and then removed in the audit follow-up — it is not a selected module.)

## Status after audit
Works ✅ visually on desktop and mobile (screenshots in `presentation/screenshots/`). Caveats: (1) all toolkit assets come from CDNs — the evaluation machine needs internet or the page loses Bootstrap CSS/JS, fonts and **Three.js**; (2) Bootstrap usage is shallow — be ready to justify it honestly.

## Likely evaluator questions
1. **Why Bootstrap?** It is the toolkit the subject lists for the minor module; it gave us a normalised base (`.container`, `.btn`) and responsive defaults without adding a build step — the project has no bundler, everything is plain `<script>`/`<link>` tags.
2. **Show me where Bootstrap is used.** `index.html:10` (CSS), `:612-614` (JS); classes `container`, `btn`, `btn-group`, `text-center`, `btn-primary/secondary/danger`.
3. **Why does most styling live in `styles.css`?** The retro-arcade theme (neon green/magenta, pixel font) is not achievable with Bootstrap defaults; we override with CSS variables (`styles.css:18`).
4. **Is Bootstrap JS actually needed?** Not by any component today; the modal/dropdown/hamburger are custom. It is kept to satisfy the toolkit requirement and for future use — say this rather than claiming Bootstrap powers the modal.
5. **What happens offline?** Bootstrap, fonts, jQuery and Three.js fail to load; the SPA still routes and calls the API, but Pong (Three.js) will not start. Recommended improvement: vendor these files into `static/`.
6. **Is it responsive because of Bootstrap?** Partly (`.container`), but the breakpoints and hamburger are custom media queries (`styles.css:763-816`). See `10-accessibility.md`.
7. **Do you use Bootstrap's grid?** No — CSS Grid (`grid-template-columns`, `styles.css:366`, `:1369`) and Flexbox.
