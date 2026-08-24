# Module — Gameplay & UX: second game with user history and matchmaking (Major)

**Verdict: Works end-to-end ✅ for history; "matchmaking" is local mode selection only ⚠️** — TicTacToe is a complete second game whose results are saved to `MatchHistory` and shown on the profile. There is no online queue/pairing.

## What the module requires (42 subject wording)
Add a new game distinct from Pong, with user history (tracking individual results), matchmaking, and secure persistence of user game data.

## What it does in FAST_PONG
* **TicTacToe** — hot-seat 3×3 game (X then O on the same keyboard/mouse), win/draw detection, reset. Every finished game is posted to `/api/auth/save-match/` as `game_type: 'TICTACTOE'` with result WIN/LOSS/DRAW for the logged-in user (X is "you", O is "Player 2").
* **User history** — `MatchHistory` rows with game type, opponent, score, result and date; the profile shows the last five with a `PONG`/`TICTACTOE` badge, plus aggregate stats and a win-rate pie chart. `/api/auth/match-history/` returns the last ten.
* **Matchmaking (as implemented)** — for Pong a mode-selection screen (Player vs Player / Player vs AI, `pong.js:1145-1169`); for TicTacToe `match/create` returns a match id and `opponent: 'AI'` placeholder but the game is played locally by two people. Tournaments pair players round-robin automatically (`tournaments/views.py:67`).

## Exactly where it is implemented

| Concern | Symbol | Ref |
|---|---|---|
| Game class | `class TicTacToeGame` (constructor injects styles, builds board, calls `initializeMatch`) | `static/frontend/js/tictactoe.js:3-28` |
| Board/UI | `setupStyles` `:30`, `setupGameBoard` `:91`, `updateStatusDisplay` `:124` | `tictactoe.js` |
| Match creation | `initializeMatch` → `POST /api/auth/match/create/` with Bearer JWT | `tictactoe.js:134-166`; server `create_match` `userapp/views.py:826-847` (returns `uuid4` match id `:839`) |
| Game logic | `handleCellClick` `:251`, `checkResult` with `winningConditions` `:19-23`, `:265-304` | `tictactoe.js` |
| Persist result | `finishMatch` → `POST /api/auth/save-match/` `{game_type:'TICTACTOE', opponent:'Player 2', result, score:'1-0'}` | `tictactoe.js:192-247`; server `save_match_view` `userapp/views.py:775-821` |
| Restart / cleanup | `handleRestart` `:306`, `cleanup` `:316` | `tictactoe.js` |
| Mount point | `<div id="tictactoe" class="page">` … `.tictactoe-container` | `templates/frontend/index.html:267-275` |
| Router hook | `initializeGameIfNeeded('tictactoe')` → `new window.TicTacToeGame(container)`; login gate on nav link | `static/frontend/js/script.js:199-224`, `:960-973` |
| ES-module export | `window.TicTacToeGame = TicTacToeGame` | `templates/frontend/index.html:604-610` |
| History model | `MatchHistory` (`GAME_CHOICES` PONG/TICTACTOE, `RESULT_CHOICES`, `score`, `date_played`, ordering `-date_played`) | `userapp/models.py:66-90` |
| History API | `match_history_view` (last 10) `:746`; profile stats & last 5 `:82-111`; export `:972` | `userapp/views.py` |
| Profile rendering | match cards with game-type badge and date `script.js:1158-1214`; pie chart `createWinratePieChart` `:1948` | `static/frontend/js/script.js` |
| Pong mode selection | `PongGame.initializeGame` builds PvP/AI buttons; `startGame` | `static/frontend/js/pong.js:1123-1187` |
| Pong AI opponent | `class PongAI` (interval 1 s, accuracy/mistake chance) | `pong.js:585-676` |
| Tournament pairing | `combinations(players, 2)` | `tournaments/views.py:67` |

Dead paths worth knowing: `tictactoe.js:172` posts state to `/api/game/match/<id>/state` and `pong.js:776` to `/api/game/match/create` — neither route exists (they hit the SPA catch-all and are ignored inside `try/catch`); `pong.js:805` posts to `/tournaments/api/tournaments/match/<id>/state/` which exists but just returns `{success:true}` (`tournaments/views.py:197`).

## How it interacts with the rest
* Requires login (JWT in localStorage) — `create_match` and `save_match_view` use `IsAuthenticated` with DRF default auth (JWTAuthentication first), so the `Authorization: Bearer` header is what authenticates the game (`tictactoe.js:142`, `:226`).
* Results feed the User-Management stats and the GDPR export.
* TicTacToe shares the SPA lifecycle: `showPage` calls `window.currentGame.cleanup()` when leaving the page (`script.js:100-103`).

**🆕 Changed in Aug-2026 audit:** nothing in the game itself. The audit's curl flow (`save-match` with `TICTACTOE` → `match-history`) and the headless walkthrough (screenshot `12-tictactoe`) verified the path; the `refresh_token` returned by `verify-otp` now lets 2FA users keep playing after the 60-min access token expires.

## Status after audit
History persistence ✅, second game ✅, profile integration ✅. Honest limits: no remote matchmaking/queue, no online multiplayer, TicTacToe has no AI (label "vs AI" in `create_match` is a placeholder), the second player is always recorded as "Player 2", and `create_match` ids are not stored server-side (the match id is decorative).

## Likely evaluator questions
1. **What is the second game and how is it different from Pong?** Turn-based TicTacToe on a DOM grid (no canvas/WebGL), versus real-time 3D Pong. Own class, own file, own result semantics (WIN/LOSS/DRAW, score 1-0/0-1/0-0).
2. **How is a result stored?** `finishMatch` (`tictactoe.js:192`) posts JSON to `save_match_view` (`views.py:775`), which creates a `MatchHistory` row for `request.user`; `date_played` is `auto_now_add`.
3. **Who is the "user" in a hot-seat game?** Player X is the logged-in account; O is recorded as opponent "Player 2" (`tictactoe.js:202`). A draw is stored as DRAW and counts in games played but not wins.
4. **Where is matchmaking?** Local mode selection (`pong.js:1145`) and automatic round-robin pairing in tournaments (`tournaments/views.py:67`). There is no server-side queue — say so, and explain how you'd add one (a `waiting` `Game` row in `gameapp` — the model already exists at `gameapp/models.py:5` — polled or pushed over WebSockets).
5. **How is game data secured?** Only authenticated users can create/save matches (`IsAuthenticated`), the row is bound to `request.user` server-side (a client cannot save for another user), transport is HTTPS, and CSRF/JWT protect the POST.
6. **Can a client fake a win?** Yes — the result is computed client-side and trusted by `save_match_view`. Known limitation; mitigation would be server-authoritative game state.
7. **How does the profile decide the badge and colours?** `match.game_type` → `.game-type` badge; `result === 'WIN'` → green, else red (`script.js:1170-1183`).
8. **Why are tournament matches not in the history?** By design, to keep personal stats about the account's own games; `pong.js:866-867` skips `saveMatchHistory` for tournament matches and `profile_view` excludes `TOURNAMENT` rows.
