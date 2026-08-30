# SPA routing and the frontend

> **Why this matters at the evaluation.** The subject requires a single-page application with working browser Back/Forward, and our Graphics (Three.js), AI opponent, stats dashboard and Accessibility (responsive, browsers, SSR) modules are all frontend. Staff will click around and then ask "how does the URL change without a reload?" and "where is the 3D?". Everything is in three hand-written files.

## Files

| File | Size | Role |
|---|---|---|
| `templates/frontend/index.html` | ~612 lines | The only HTML document. Server-rendered by Django (`{% static %}`, `{% csrf_token %}`). Contains **every page as a hidden `<div class="page">`** plus the OTP modal |
| `static/frontend/js/script.js` | ~2 300 lines | Router, auth, profile, settings, friends, tournament UI, avatar/data export, token refresh. Plain script (global functions), loaded first |
| `static/frontend/js/pong.js` | ~1 190 lines | ES module: `GamePhysics`, `GameRenderer`, `InputHandler`, `PongAI`, `PongGame` (default export) |
| `static/frontend/js/tictactoe.js` | ~325 lines | ES module: `TicTacToeGame` (default export) — bonus feature, not a claimed module |
| `static/frontend/css/styles.css` | ~2 200 lines | Retro neon theme (`--primary-color #00ff00`, `--secondary-color #ff00ff`, fonts Press Start 2P / Roboto / Orbitron), responsive breakpoints at 1100/920/768/480 px |
| `templates/frontend/index.html:599-611` | | Script loading order: `script.js` → three.js r128 (CDN) → `<script type="module">` importing `pong.js` and `tictactoe.js` and exposing `window.PongGame` / `window.TicTacToeGame` → jQuery slim, Popper, Bootstrap JS |

## The router (`script.js`)

```mermaid
flowchart TD
    L[window 'load' :132] --> SP
    Click[document click on a href starting with '/' :154<br/>preventDefault] --> SP
    Pop[popstate :121 → event.state.pageId] --> SP
    Prog[programmatic showPage('x') from handlers] --> SP
    SP{"showPage(pageId, pushState=true) :13"}
    SP --> Gate["auth gating :14-21<br/>logged in & login/register → home<br/>logged out & profile/settings → login"]
    Gate --> OAuth["oauth/callback special case :25-46<br/>?code=&state= → checkOAuthLogin()"]
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
* **Login state is client-side**: `localStorage.isLoggedIn === 'true'` (`checkLoginState :163`) switches between the two `<ul class="nav-links logged-in|logged-out">` and adds `body.is-logged-in`. Server-side, the session cookie/JWT decide whether API calls succeed; a stale `isLoggedIn` just leads to 401s and a redirect to login (`:1197-1201`).
* Nav links have both `href="/x"` and `onclick="showPage('x'); return false;"` — belt and braces; the global click handler (`:154-161`) covers any other internal link.
* Two `DOMContentLoaded`-time initialisations (`:546-973`): form handlers, hamburger menu, settings edit buttons, avatar upload, delete account, OTP verify, OAuth button, PLAY NOW / TOURNAMENT gating, tournament forms, download data, TicTacToe gating.

## Page inventory and the API each one calls

| Page div | Populated by | API calls |
|---|---|---|
| `#home` | static (CSS pong animation) | — |
| `#login` | `handleLogin :256`, `handleOTPVerification :310`, `initiate42OAuth :976` | `/api/auth/login/`, `/api/auth/verify-otp/`, `/api/auth/redirect_uri/` |
| `#register` | `handleRegister :414` | GET+POST `/api/auth/register/` |
| `#profile` | `loadProfileData :1090` → `loadFriendsList :1731`, `loadAllUsers :1779`, `createWinratePieChart :1948` | `/api/auth/profile/`, `/api/auth/friends/`, `/api/auth/users/`, `/api/auth/friends/add|remove/<id>/` |
| `#settings` | `loadSettingsData :1211`, edit buttons `:645-701`, avatar upload `:704-783`, `handleDownloadUserData :1515`, `deleteAccount :795` | PUT `/api/auth/profile/`, `/api/auth/export-data/`, `/api/auth/avatar/<id>/`, DELETE `/api/auth/delete-account/` |
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
| `PongAI` | `:671-773` | Re-reads ball position/velocity once per second (`UPDATE_INTERVAL 1000` — the subject's "AI refreshes its view once per second" constraint), predicts the intercept z, adds prediction error (`ACCURACY`) and a `MISTAKE_CHANCE`, then presses simulated arrow keys at the human `paddleSpeed`; `updateDifficulty()` adjusts accuracy from the live score |
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

## The AI opponent (`PongAI`, `pong.js:671-773`) — AI-Algo Major module (🆕 simulated keys)

* `update()` (`:692-710`) samples ball position/velocity only once per second (`UPDATE_INTERVAL 1000`) and calls `decideNextMove`.
* `predictZ()` (`:714-725`) extrapolates the ball to the paddle's x and folds the value at the ±2.9 walls (bounce anticipation); when the ball moves away the target is the centre.
* `decideNextMove()` (`:726-741`) adds `(rand − 0.5)·(1 − ACCURACY)` and, with `MISTAKE_CHANCE`, a random ±1 offset; clamps to ±2.1.
* `pressKeys()` (`:742-753`) runs every frame and puts `arrowup`/`arrowdown` into `InputHandler.aiKeys` (released inside a ±0.1 dead-zone); `InputHandler.update()` (`:615-636`) moves paddle 2 from those keys at `GAME_CONFIG.paddleSpeed` — the same speed as the human paddle.
* `updateDifficulty()` (`:755-773`) every 5 s from the live score adjusts accuracy/mistake chance only.
* Details and evaluator Q&As: `modules/06-ai-opponent.md`.

## The stats dashboard (AI-Algo Minor module) — how the profile page is rendered

* Data: `GET /api/auth/profile/` (`profile_view`, `userapp/views.py:74-142`) returns `stats {games_played, win_rate, best_score}` and the last five `match_history` entries, excluding tournament games.
* `loadProfileData` (`script.js:1053-1209`): fills the three stat cards (`.stat-card .stat-value`, `:1105-1107`), builds one `.match-card` per match with game-type badge, opponent, score, WIN/LOSS colour and date (`:1121-1177`), then draws the **win-rate pie chart** — a hand-built inline SVG (`createWinratePieChart :1947-2057`): two arc paths (green wins / red losses, or a grey disc when no games) with centred text "WIN RATE x% / n GAMES".
* The friends panel and the *Find Users* tab are loaded right after (`loadFriendsList :1730`, `loadAllUsers :1778`).
* A JSON version of the same numbers (wins/losses/draws/win rate + full history) is exposed by `GET /api/auth/export-data/` (`export_user_data`) and downloaded from Settings.

## Token handling

* After login the SPA stores `authToken` (access), `refreshToken`, `userData`, `isLoggedIn`. **🆕 Changed in the Aug-2026 second sweep:** every JWT-protected call goes through `authFetch(url, options)` (`script.js:1499-1523`, also exposed as `window.authFetch` for the game files) — it awaits `getAccessToken()`, adds `Authorization: Bearer …` (+ `X-CSRFToken` on writes, `credentials: 'include'`) and, on a 401, refreshes once and retries. The bogus `Token <jwt>` header on tournament calls was removed.
* `getAccessToken()` (`:1417`) decodes the JWT payload (`atob` of the middle segment) and refreshes if `exp` passed; `refreshAccessToken()` (`:1438`) posts `{refresh}` to `/api/auth/token/refresh/` (fixed in the first audit — it used to hit the catch-all), stores the rotated `refresh` and logs out on failure; `scheduleTokenRefresh()` (`:1472`) arms a timer 1 min before expiry (`window.__tokenRefreshTimer`) and re-arms after each refresh. **🆕** It is now called after password login, after OTP verification and after 42 login, and the `load` handler (`:146`) refreshes an already-expired token before showing a logged-in page (falling back to `clearLocalSession()` `:410` if the refresh token is bad too). Before the sweep the timer existed only in the OAuth path, so after 60 minutes games silently stopped being saved.
* `handleLogout()` posts to `/api/auth/logout/` (clears the session; **🆕** always, even without a token) and calls `clearLocalSession()` (`:410`), which wipes localStorage, the tournament/match globals and the refresh timer; the JWT itself simply expires (no blacklist).

## Avatars, friends, chart, export

* `fixImageUrl()` (`:1474`) turns any `profile_pictures` URL into `/api/auth/avatar/<userData.id>/?t=<timestamp>` so avatars work without Django media serving and bypass browser caching; `updateNavAvatar` / `clearAvatarCache` keep the nav image fresh. Upload: file → `FileReader` data URL → `PUT /api/auth/profile/ {profile_picture: dataURL}` (`:704-783`); the backend decodes base64 into `media/profile_pictures/user_<id>.<ext>`.
* Friends panel (`:1628-1911`): two tabs (My Friends / Find Users), client-side filtering, Add/Remove buttons calling the friends endpoints and re-rendering.
* Win-rate pie chart is a hand-built inline **SVG** (`createWinratePieChart :1947-2057`): arc paths for wins (green) / losses (red), centre text "WIN RATE x% / n GAMES".
* Download-my-data (`:1515-1625`): fetches the export JSON, fetches the avatar and embeds it as base64, adds `export_metadata`, and triggers a browser download via a Blob URL.

## Responsive / browser notes

* Breakpoints in `styles.css` (`@media (max-width: 1100px | 920px | 768px | 480px)`): at ≤768 px the nav collapses behind `#hamburger-menu` (`.hamburger` `:206` hidden on desktop, shown in the 768 px block), font size drops to 14 px, profile header stacks, settings field containers stack. Verified at 390×844 (screenshots `16-`, `17-`, `18-`).
* The Pong canvas keeps 4:3 inside `.game-container` (`height: 600px`, resize handler).
* Browser compatibility: plain ES2017+ (async/await, modules, optional chaining `?.`), no transpiler; works in current Chrome, Edge, Firefox and Safari. Three.js r128 requires WebGL 1.

## 🆕 Changed in the Aug-2026 second sweep (router, tournament, settings, OTP)

* **Single initialisation** — only the `load` handler (`:146`) shows the initial page, with `pushState=false`; `DOMContentLoaded` (`:526`) just wires listeners. The inline `onclick="showPage(...)"` attributes were removed from the nav links, so the global click handler is the only router entry point. Result: one profile request per visit, one `match/create` per TicTacToe visit, and Back works with one press after a deep-link reload.
* **Login gating** — `showPage` redirects logged-out users for `profile, settings, game, tictactoe, tournament` (`:19`).
* **Tournament persistence** — `setCurrentTournament(id)` (`:123`) keeps the module variable, `window.currentTournamentId` and `localStorage.currentTournamentId` in sync; `showPage('tournament')` (`:111`) resumes a stored tournament after a refresh; `loadTournamentData(id)` (`:2174`) honours its argument and clears the stored id on 404; cleared on logout and by "Return to Home". `handleAddPlayers` rejects empty and >50-char nicknames (`:2121`) and shows English error messages.
* **Settings** — "Save Settings" PUTs `{display_name, two_factor_enabled}`; the new Security section's `#two-factor-toggle` (`:640`, state loaded at `:1297`) PUTs `two_factor_enabled` on change; avatar uploads are checked client-side (`image/*`, ≤ 2 MB, `:734`).
* **OTP modal** — `<form id="otp-form">` (`:847`) so Enter submits; Cancel button; no outside-click close.
* **Dates** — the API now returns ISO 8601; `new Date()` results are guarded (raw string if invalid).

## 🆕 Subject-compliance pass (30 Aug 2026)
* **SSR hand-off** — the server renders `<body data-ssr-page="…" data-ssr-logged-in="…">`, the requested page already `active`, nav lists pre-set and the profile pre-filled (`index.html:9-17`, `:30-38`, `:59-120`). The `load` handler starts from `document.body.dataset.ssrPage` (`script.js:152`) and hydrates; if the server says logged-in but `localStorage` has no session, `checkLoginState()` simply re-applies the local state.
* **XSS rule** — user-controlled strings (nicknames, usernames, display names, opponents) are only ever inserted with `textContent`/`createElement`; `loadTournamentData` (`script.js:2215-2360`) was rewritten that way and `#next-match` is filled with `textContent`.
* **Tournament API is login-protected** — 401 → "Please log in" (`script.js:2224`, `startTournamentMatch`).
* **Anonymize** button handler (`script.js:858-885`) → `authFetch POST /api/auth/anonymize-account/` → `clearLocalSession()`.
* **TicTacToe** (`tictactoe.js:3-305`) — local hot-seat only; the online mode built during the audit was removed at the team's request (no online play). Results go through `initializeMatch()`/`finishMatch()` with `window.authFetch`.

## Known frontend quirks (be ready to acknowledge)

* Merge-conflict marker **comments** (`// <<<<<<< master`, `// =======`, `// >>>>>>> 8ec6d59`) remain at `script.js:23,49,56,139,149,151,1322,1391-1392,1436,2059,2088` — harmless (commented out) leftovers from a merge.
* Feedback is `alert()`-based (the OTP modal now has a form + Cancel button, **🆕**).
* External CDN dependencies (Bootstrap, jQuery, Popper, Three.js, Google Fonts) — the demo machine needs internet, or these must be vendored.
* `check-auth` is never called; auth state is inferred from localStorage plus API 401s.

* **🆕 OAuth `state`:** `redirect_uri` (`userapp/views.py:586-618`) signs a random value (`signing.dumps({'n': secrets.token_hex(8)}, key=settings.OAUTH_STATE_SECRET, salt='oauth-state')`, `:604`), keeps it in `request.session['oauth_state']` (`:605`) and appends `&state=` to the authorize URL (`:612`). 42 echoes it back on the callback; `checkOAuthLogin()` reads it (`script.js:1069`) and posts `{code, state}` (`:1089`). `get_token` (`views.py:679-704`) pops the session value, requires an exact match and verifies the signature with `max_age=JWT_SETTINGS['STATE_TTL']` (600 s) — otherwise 400 "Invalid OAuth state" and 42 is never contacted; the state is single-use. Setting `OAUTH_STATE_SECRET` (`backend/settings.py:275`, from `.env`, defaults to `SECRET_KEY`). Tests: `OAuthStateTests` (`userapp/tests.py:548`).
