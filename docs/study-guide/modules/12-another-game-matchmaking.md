# Module — Gameplay & UX: Add Another Game with User History and Matchmaking (Major)

**Verdict: Works end-to-end ✅** — TicTacToe is the second game: playable locally (two players, one keyboard) and **online** through a matchmaking queue; every finished game is written to the user's match history and counted in the profile statistics. 🆕 The online part was added in the Aug-2026 subject-compliance pass.

## What the module requires (42 subject wording)
Introduce a new game distinct from Pong; implement user history tracking to record and display each user's gameplay statistics; create a matchmaking system to allow users to find opponents and participate in fair and balanced matches; store history and matchmaking data securely and keep it up to date; keep the game responsive.

## What it does in FAST_PONG
* **Game** — 3×3 TicTacToe rendered as a CSS grid with a status line and a reset button (`tictactoe.js:41-210`).
* **Local mode** — hot-seat X/O on one keyboard; the result is saved with `POST /api/auth/save-match/` (`tictactoe.js:245-284`) as `TICTACTOE` / opponent "Player 2".
* **Online mode** — *Online — find an opponent* joins a server-side queue; when paired, both browsers play the same match turn by turn and the **server** records the result for both accounts.
* **History & stats** — `MatchHistory` rows (`userapp/models.py`) feed the profile (games played, win rate, best score, recent matches) and the JSON export.

## Exactly where it is implemented
| Piece | File / lines |
|---|---|
| Models `TicTacToeQueue` (user 1:1, rating, joined_at auto_now) and `TicTacToeMatch` (player_x, player_o, 9-char `board`, `turn`, `status`, `winner`, timestamps; `check_winner()` over the 8 lines) | `gameapp/models.py:39-85`, migration `gameapp/migrations/0002_tictactoequeue_tictactoematch.py` |
| Rating = TicTacToe win-rate % from `MatchHistory` (50 when no games) | `gameapp/views.py:66-73` |
| `POST /api/game/ttt/queue/` — returns the active match if one exists, else pairs with the closest-rating waiter (stale >60 s dropped) inside `transaction.atomic()` + `select_for_update()`, else enqueues/refreshes and returns `{status:'waiting', queued:n}`; `DELETE` leaves | `gameapp/views.py:112-137` |
| `GET /api/game/ttt/match/<id>/` — state for a participant (`you`, `players`, `board`, `turn`, `status`, `winner`); 403 otherwise | `gameapp/views.py:141-149`, `match_state :79-90` |
| `POST …/move/ {cell}` — validates participant / turn / empty cell / active; applies; detects win or draw; writes `MatchHistory` for both players | `gameapp/views.py:153-192`, `_record_result :96-108` |
| `POST …/leave/` — forfeit (opponent wins, history written) | `gameapp/views.py:196-213` |
| Routes mounted at `/api/game/` | `gameapp/urls.py`, `backend/urls.py:13` |
| Frontend: mode selector, queue polling (2 s), board polling (1 s), turn gating, result screen, cleanup (leave / dequeue) | `tictactoe.js:125-166` (selector), `:352-419` (queue), `:421-530` (online board & moves), `:532-556` (cleanup) |
| Auth: DRF `IsAuthenticated` → JWT (`window.authFetch`) or session | `tictactoe.js:211-217` `apiFetch` |
| Tests | `gameapp/tests.py` (14: pairing, closest rating, stale entry, moves, win/draw/forfeit, history for both, 403, SSR) |

## How it interacts with the rest
* Uses the shared `User` and `MatchHistory` models; the profile/stat code does not distinguish online from local games (both are `game_type='TICTACTOE'`).
* `authFetch` (script.js) supplies the Bearer token and refreshes it on 401, so a long online session keeps working.
* `initializeGameIfNeeded` (script.js) creates one `TicTacToeGame` per visit and calls `cleanup()` when the user navigates away, which forfeits an active online match or leaves the queue.

## Status after audit
Two-browser live test: A queues → B queues → matched (A = X, B = O) → alternating moves → "You won"/"You lost" → both match histories updated; 0 JS errors. Fairness = closest win-rate pairing; balance = alternating X/O by arrival order.

## Likely evaluator questions
1. **Why TicTacToe?** Distinct from Pong, turn-based (so no real-time transport needed), quick to play — the matchmaking and history plumbing is the interesting part.
2. **Show me the matchmaking.** Two browsers, both click *Online*; the second one is paired immediately; explain the rating and the 60-second staleness rule.
3. **Why polling and not WebSockets?** Turn-based game, 1-second polls are enough, no extra infrastructure (Channels/Redis); WebSockets would be the natural upgrade for real-time games (see *Remote players* module, not selected).
4. **What makes matches "fair and balanced"?** Pairing by closest TicTacToe win-rate; X/O assignment alternates by who waited (the waiter plays X).
5. **What happens on disconnect?** `cleanup()` forfeits (`…/leave/`); queue rows not refreshed for 60 s are ignored, so a closed tab never blocks the queue.
6. **Where is history stored?** `userapp_matchhistory` — one row per player per game with result and score; shown on the profile and in the export.
7. **Can I cheat by posting moves for the opponent?** No: the server checks you are a participant, that it is your turn and that the cell is empty (`ttt_move`), all inside a row lock.
8. **Is the local mode still needed?** Yes — it is the "same keyboard" experience and the fallback when nobody else is online.
