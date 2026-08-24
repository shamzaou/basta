# SPA routing and the frontend

> **Why this matters at the evaluation.** The subject requires a single-page application with working browser Back/Forward, and our Graphics (Three.js), Accessibility (responsive, browsers, languages, SSR) modules are all frontend. Staff will click around and then ask "how does the URL change without a reload?" and "where is the 3D?". Everything is in three hand-written files plus 🆕 `i18n.js`.

## Files

| File | Size | Role |
|---|---|---|
| `templates/frontend/index.html` | ~615 lines | The only HTML document. Server-rendered by Django (`{% static %}`, `{% csrf_token %}`). Contains **every page as a hidden `<div class="page">`** plus the OTP modal |
| `static/frontend/js/script.js` | ~2 300 lines | Router, auth, profile, settings, friends, tournament UI, avatar/data export, token refresh. Plain script (global functions), loaded first |
| `static/frontend/js/pong.js` | ~1 190 lines | ES module: `GamePhysics`, `GameRenderer`, `InputHandler`, `PongAI`, `PongGame` (default export) |
| `static/frontend/js/tictactoe.js` | ~325 lines | ES module: `TicTacToeGame` (default export) |
| 🆕 `static/frontend/js/i18n.js` | ~220 lines | Translations + language switcher |
| `static/frontend/css/styles.css` | ~2 200 lines | Retro neon theme (`--primary-color #00ff00`, `--secondary-color #ff00ff`, fonts Press Start 2P / Roboto / Orbitron), responsive breakpoints at 1100/920/768/480 px |
| `templates/frontend/index.html:601-614` | | Script loading order: `i18n.js` → `script.js` → three.js r128 (CDN) → `<script type="module">` importing `pong.js` and `tictactoe.js` and exposing `window.PongGame` / `window.TicTacToeGame` → jQuery slim, Popper, Bootstrap JS |

## The router (`script.js`)

```mermaid
flowchart TD
    L[window 'load' :132] --> SP
    Click[document click on a href starting with '/' :154<br/>preventDefault] --> SP
    Pop[popstate :121 → event.state.pageId] --> SP
    Prog[programmatic showPage('x') from handlers] --> SP
    SP{"showPage(pageId, pushState=true) :13"}
    SP --> Gate["auth gating :14-21<br/>logged in & login/register → home<br/>logged out & profile/settings → login"]
    Gate --> OAuth["oauth/callback special case :25-46<br/>?code= → checkOAuthLogin()"]
    OAuth --> Exists{"#pageId exists? :57-62"}
    Exists -- no --> Home[pageId = 'home']
    Exists -- yes --> Push["history.pushState({pageId}, '', '/'+pageId) :65-68"]
    Home --> Push
    Push --> Show["hide all .page, show target (display:block) :80-88<br/>update .active nav link"]
    Show --> Side["side effects :90-116<br/>profile→loadProfileData · settings→loadSettingsData<br/>cleanup window.currentGame · initializeGameIfNeeded<br/>tournament→sub-section"]
```

Key points to say:

* **One HTML document, many `<div class="page">`** (`#home #profile #settings #game #tictactoe #about #login #register #tournament`, plus `#otp-modal` outside `<main>`). `showPage` toggles `display` and `.active`.
* **URL sync without reload**: `history.pushState({pageId}, '', '/profile')` (`script.js:67`). Back/Forward fire `popstate` (`:121-130`) → `showPage(event.state.pageId, false)` (no new history entry). On initial load the path is read (`:133-138`) and `replaceState` seeds the state object.
* **Deep links work** because Django's catch-all route returns `index.html` for any path (`backend/urls.py:16`); the SPA then shows the page named by the path.
* **Login state is client-side**: `localStorage.isLoggedIn === 'true'` (`checkLoginState :163`) switches between the two `<ul class="nav-links logged-in|logged-out">` and adds `body.is-logged-in`. Server-side, the session cookie/JWT decide whether API calls succeed; a stale `isLoggedIn` just leads to 401s and a redirect to login (`:1233-1237`).
* Nav links have both `href="/x"` and `onclick="showPage('x'); return false;"` — belt and braces; the global click handler (`:154-161`) covers any other internal link.
* Two `DOMContentLoaded`-time initialisations (`:546-974`): form handlers, hamburger menu, settings edit buttons, avatar upload, delete/anonymize account, OTP verify, OAuth button, PLAY NOW / TOURNAMENT gating, tournament forms, download data, TicTacToe gating.

## Page inventory and the API each one calls

| Page div | Populated by | API calls |
|---|---|---|
| `#home` | static (CSS pong animation) | — |
| `#login` | `handleLogin :256`, `handleOTPVerification :310`, `initiate42OAuth :976` | `/api/auth/login/`, `/api/auth/verify-otp/`, `/api/auth/redirect_uri/` |
| `#register` | `handleRegister :414` | GET+POST `/api/auth/register/` |
| `#profile` | `loadProfileData :1090` → `loadFriendsList :1731`, `loadAllUsers :1779`, `createWinratePieChart :1948` | `/api/auth/profile/`, `/api/auth/friends/`, `/api/auth/users/`, `/api/auth/friends/add|remove/<id>/` |
| `#settings` | `loadSettingsData :1248`, edit buttons `:645-701`, avatar upload `:704-783`, `handleDownloadUserData :1550`, `deleteAccount :795`, 🆕 `anonymizeAccount :833` | PUT `/api/auth/profile/`, `/api/auth/export-data/`, `/api/auth/avatar/<id>/`, DELETE `/api/auth/delete-account/`, 🆕 POST `/api/auth/anonymize-account/` |
| `#game` | `initializeGameIfNeeded :199` → `PongGame.initializeGame` | `/api/auth/save-match/` or `/tournaments/api/tournaments/<id>/finish/` |
| `#tictactoe` | `new TicTacToeGame` | `/api/auth/match/create/`, `/api/auth/save-match/` |
| `#tournament` | `handleTournamentCreation :1394`, `handleAddPlayers :2087`, `loadTournamentData :2159`, `startTournamentMatch :481` | `/tournaments/api/tournaments/…` |
| `#about` | static (team, tech, features, privacy policy, disclaimer) | — |
| `#otp-modal` | shown by `handleLogin` when `requires_2fa` | — |

## Where the games live

### Pong (`pong.js`)

| Class | Lines | Responsibility |
|---|---|---|
| `GAME_CONFIG` | `:4-10` | `maxBallSpeed 0.15`, `minBallSpeed 0.1`, `paddleSpeed 0.15`, **`pointsToWin 3`** |
| `GamePhysics` | `:27-92` | Ball velocity + **spin** vectors; `resetBall()`; `handlePaddleCollision()` computes bounce angle from where the ball hit the paddle (±45°), speeds up 5 % per hit up to the max, adds spin; `updatePhysics()` moves the ball, applies spin, bounces off side walls (z ±2.9, damped), detects paddle hits at x ±4.7 with a 0.9 hitbox, returns `'player1'`/`'player2'` when x passes ±5 |
| `GameRenderer` | `:95-504` | Everything Three.js (below) + DOM UI (score, instructions, player names, restart/next button) + injected CSS |
| `InputHandler` | `:507-582` | keydown/keyup Set; W/S move paddle 1, ↑/↓ paddle 2 (ignored in AI mode); Space handled in `PongGame.setupEventHandlers` (pause overlay) |
| `PongAI` | `:585-676` | Re-reads ball position/velocity once per second (`UPDATE_INTERVAL 1000` — the subject's "AI refreshes its view once per second" constraint), predicts the intercept z, adds prediction error (`ACCURACY`) and a 10 % `MISTAKE_CHANCE`, moves at ≤ `MAX_SPEED`; `updateDifficulty()` placeholder |
| `PongGame` | `:679-1188` | State (`score`, `gameStatus playing/paused/finished`, `matchId`, `tournamentId`), constructs the above, `animate()` loop via `requestAnimationFrame` (`:1111`), `updateScore()` → `finishMatch()` at 3 points, `saveMatchHistory()` or tournament `finish`, restart / next-game buttons, `cleanup()` (removes key listeners, cancels the animation frame). Static `initializeGame(container, mode)` (`:1123`) shows the PvP/AI mode selection unless a tournament match is pending; `startGame` (`:1175`) instantiates and stores `window.currentGame` |

### TicTacToe (`tictactoe.js`)

`TicTacToeGame(container)`: injects its CSS, builds a 3×3 grid of `.cell` divs, status line and RESET button (`:91-122`); `handleCellClick` → `checkResult` against the 8 winning lines (`:265-304`); X starts, players alternate on the same device; on win/draw `finishMatch()` posts to `/api/auth/save-match/` as WIN (X wins), LOSS (O wins) or DRAW with scores `1-0/0-1/0-0`; `initializeMatch()` obtains a UUID `match_id` from `/api/auth/match/create/`. `cleanup()` is called by the router when leaving the page.

## How the 3D graphics are done (Three.js r128, WebGL)

All in `GameRenderer` (`pong.js:95-504`):

1. **Scene & camera** — `new THREE.Scene()` with background `0x0a0a0a`; `PerspectiveCamera(75°, 4:3, 0.1, 1000)` positioned at `(0, 6, 6)` looking at the origin (`:333-337`) — an elevated, angled view of the table.
2. **Renderer** — `WebGLRenderer({ antialias: true })`, sized to the container while keeping 4:3 (`calculateSize :316-331`, max 800×600); canvas appended to `.game-container` (`:339-350`). Window `resize` re-computes size and `camera.updateProjectionMatrix()`.
3. **Lights** — `AmbientLight(0x333333)` + `SpotLight(0xffffff, 0.5)` at `(0,10,0)` (`:359-366`) → Phong shading with specular highlights.
4. **Table** — `BoxGeometry(10, 0.2, 6)` with `MeshPhongMaterial` black/specular; neon border from `EdgesGeometry` + `LineSegments` in `0x00ff00` (`:368-383`); net `BoxGeometry(0.05, 0.4, 6)` (`:460-470`).
5. **Ball** — `SphereGeometry(0.2, 32, 32)`; material uses a **procedurally drawn `CanvasTexture`** (`createBallTexture :411-441`: pink base, 8 white wedges, 12 dots) plus `emissive 0xff00aa` so it glows; the ball *rotates* with its velocity and spin (`GamePhysics.updatePhysics :68-69`) so the texture visibly spins.
6. **Paddles** — `BoxGeometry(0.2, 0.8, 1.4)`, cyan emissive Phong material (`:443-458`).
7. **Loop** — `requestAnimationFrame` → `update()` (input, AI, physics, scoring) → `renderer.render(scene, camera)` (`:1111-1121`).
8. **Physics feel** — angle-of-incidence bounce, acceleration per hit, spin curving the ball, wall damping (`GamePhysics :45-91`).

If asked "why Three.js and not Babylon.js": the subject allows Three.js/WebGL for the Graphics module; Three.js was familiar, has a tiny API surface for what we need (geometries, Phong materials, one camera), and loads from a CDN with no build step, matching our no-bundler frontend.

## 🆕 How i18n works (`i18n.js`)

* `TRANSLATIONS` (`i18n.js:19`) — a `{ en, fr, ru }` table of ~75 keys covering nav, home, profile, settings, about headings, login/register, tournament, OTP modal, and two JS confirm/alert strings.
* Every static string in `index.html` carries `data-i18n="key"` (or `data-i18n-placeholder="key"` for inputs) — 94 attributes.
* `applyLanguage(lang)` (`:178`) writes `localStorage.lang`, sets `<html lang>`, replaces `textContent`/`placeholder` for every tagged element, and syncs the two `<select class="lang-select">` elements (one in each nav list, `index.html:34,43`; on mobile they are inside the hamburger menu).
* `currentLanguage()` (`:163`) = saved choice → browser language → `en`; `t(key)` (`:172`) falls back to English for missing keys; exposed as `window.t` for `script.js`.
* Runs on `DOMContentLoaded`; because pages are static divs in one document, one pass translates every page. Dynamic strings produced by `script.js` (e.g. "No matches played yet.", `alert()` messages) are still English — a known partial coverage.
* Verified in the audit with headless Chrome: nav renders "Главная | О проекте | Войти | Регистрация" in RU; screenshots `presentation/screenshots/05-home-fr.jpg`, `06-home-ru.jpg`.

## Token handling

* After login the SPA stores `authToken` (access), `refreshToken`, `userData`, `isLoggedIn`. Most `fetch` calls add `Authorization: Bearer <authToken>`; tournament calls send `Token <authToken>` (wrong scheme, harmless because those views do not authenticate).
* `getAccessToken()` (`:1438`) decodes the JWT payload (`atob` of the middle segment) and refreshes if `exp` passed; `refreshAccessToken()` (`:1459`) posts `{refresh}` to **🆕 `/api/auth/token/refresh/`** (`:1468`; it previously pointed at `/api/token/refresh/`, which the catch-all answered with HTML, and on failure called an undefined `logout()` — now `handleLogout()` `:1485`); `scheduleTokenRefresh()` (`:1490`) sets a timer 1 min before expiry — only wired in the OAuth path (`:1071`).
* `handleLogout()` (`:378`) posts to `/api/auth/logout/` (clears the session) and wipes localStorage; the JWT itself simply expires (no blacklist).

## Avatars, friends, chart, export

* `fixImageUrl()` (`:1509`) turns any `profile_pictures` URL into `/api/auth/avatar/<userData.id>/?t=<timestamp>` so avatars work without Django media serving and bypass browser caching; `updateNavAvatar` / `clearAvatarCache` keep the nav image fresh. Upload: file → `FileReader` data URL → `PUT /api/auth/profile/ {profile_picture: dataURL}` (`:704-783`); the backend decodes base64 into `media/profile_pictures/user_<id>.<ext>`.
* Friends panel (`:1663-1946`): two tabs (My Friends / Find Users), client-side filtering, Add/Remove buttons calling the friends endpoints and re-rendering.
* Win-rate pie chart is a hand-built inline **SVG** (`createWinratePieChart :1948-2057`): arc paths for wins (green) / losses (red), centre text "WIN RATE x% / n GAMES".
* Download-my-data (`:1550-1660`): fetches the export JSON, fetches the avatar and embeds it as base64, adds `export_metadata`, and triggers a browser download via a Blob URL.

## Responsive / browser notes

* Breakpoints in `styles.css` (`@media (max-width: 1100px | 920px | 768px | 480px)`): at ≤768 px the nav collapses behind `#hamburger-menu` (`.hamburger` `:222` hidden on desktop, shown in the 768 px block), font size drops to 14 px, profile header stacks, settings field containers stack. Verified at 390×844 (screenshots `16-`, `17-`, `18-`).
* The Pong canvas keeps 4:3 inside `.game-container` (`height: 600px`, resize handler).
* Browser compatibility: plain ES2017+ (async/await, modules, optional chaining `?.`), no transpiler; works in current Chrome, Edge, Firefox and Safari. Three.js r128 requires WebGL 1.

## Known frontend quirks (be ready to acknowledge)

* Merge-conflict marker **comments** (`// <<<<<<< master`, `// =======`, `// >>>>>>> 8ec6d59`) remain at `script.js:23,49,56,139,149,151,1323,1392-1393,1437,2060,2089` — harmless (commented out) leftovers from a merge.
* `loadTournamentData` is defined twice (`:239` and `:2159`); the later definition wins (function hoisting), which is the full one.
* Feedback is `alert()`-based; the OTP modal closes on outside click.
* External CDN dependencies (Bootstrap, jQuery, Popper, Three.js, Google Fonts) — the demo machine needs internet, or these must be vendored.
* `pong.js` `initializeMatch()`/`updateMatchState()` and `tictactoe.js` `updateMatchState()` post to non-existent or no-op endpoints; errors are swallowed.
* `check-auth` is never called; auth state is inferred from localStorage plus API 401s.
