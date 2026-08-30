# Module — Gameplay & UX: Add Another Game with User History and Matchmaking (Major)

**Verdict: Works end-to-end ✅** — TicTacToe is the second game (local, two players on one keyboard); every finished game lands in the user's match history and statistics; **matchmaking is provided by the tournament system**, which pairs the registered players, announces the next fight and resolves ties. There is **no online play anywhere — by design** (the *Remote players* module was not selected).

## What the module requires (42 subject wording)
Introduce a new game distinct from Pong; implement user history tracking to record and display each user's gameplay statistics; create a matchmaking system to allow users to find opponents and participate in fair and balanced matches; store history and matchmaking data securely and keep them up to date.

## What it does in FAST_PONG
* **New game** — 3×3 TicTacToe rendered as a CSS grid with a status line and a reset button (`static/frontend/js/tictactoe.js:3-305`); X and O alternate on the same keyboard/mouse, win/draw detection over the 8 lines.
* **User history** — the game creates a match id (`initializeMatch()` → `POST /api/auth/match/create/`, `tictactoe.js:141`) and saves the outcome (`finishMatch()` → `POST /api/auth/save-match/`, `:175`) as `game_type='TICTACTOE'`, opponent "Player 2", result WIN/LOSS/DRAW, score `1-0`/`0-1`/`0-0`. `MatchHistory` rows (`userapp/models.py`) feed the profile dashboard (games played, win rate, best score, recent matches) and the JSON export.
* **Matchmaking** — the tournament system: a logged-in user registers 3–8 aliases (the first one is prefilled with their unique display name), `add_players` generates every pairing with `itertools.combinations` (`tournaments/views.py:54-93`), the tournament page shows the schedule, highlights and announces the **next match** (`#next-match`, `script.js:2400-2405`), and `Tournament.get_winner` creates tiebreaker rounds until one player leads (`tournaments/models.py:18-99`). Fairness = everyone plays everyone; results are stored server-side (`Match` rows) and the view refreshes after each game.

## 🆕 Changed in Aug-2026 audit
* An **online TicTacToe queue** (server-side pairing by win-rate, turn-based play by polling) was implemented during the subject-compliance pass and then **removed at the team's request**: the project deliberately has no online functionality. `gameapp` migration `0003_remove_tictactoequeue_user_delete_tictactoematch_and_more` drops the tables; `gameapp/urls.py` has no routes; `tictactoe.js` is the local version with the earlier bug-sweep fixes (bound handlers, single style injection, `authFetch`).
* TicTacToe results are saved through `window.authFetch` (auto-refreshing JWT) when available (`tictactoe.js:144-150`, `:204-212`).

## Exactly where it is implemented
| Piece | File / lines |
|---|---|
| Game class (board, turn, win/draw check, restart, cleanup) | `static/frontend/js/tictactoe.js:3-305` |
| Match id + result persistence | `tictactoe.js:141` (`initializeMatch`), `:175` (`finishMatch`); server `create_match` / `save_match_view` in `userapp/views.py` |
| History storage / display | `userapp/models.py` `MatchHistory`; `build_profile_summary` (`userapp/views.py:80`); profile page |
| Matchmaking (tournament) | `tournaments/views.py:54-93` (`add_players`, round-robin), `:96` (`view_tournament`), `:143` (`start_match`), `:190` (`finish_match`); `tournaments/models.py:18-99` (`get_winner`, tiebreak rounds); `script.js:2302`, `:2400-2405` (next-match highlight/announcement) |
| Page wiring | `script.js` `initializeGameIfNeeded` creates one `TicTacToeGame` per visit and calls `cleanup()` on navigation |

## Status after audit
Headless-browser walkthrough: a local game is played to a win, the `TICTACTOE` row appears on the profile with the date; tournament playthroughs (3 players, ties, second tiebreak round) verified live. 51 Django tests overall (`tournaments/tests.py`: 10 incl. tiebreak rounds and login-required API).

## Likely evaluator questions
1. **Why TicTacToe?** Distinct from Pong, quick to play, and it exercises the same history pipeline (`save-match`) as Pong.
2. **Where is the matchmaking?** In the tournament: aliases are registered, every pairing is generated automatically, the page announces "Next match: A vs B", and tied leaders get extra tiebreaker matches — the system organises who plays whom and when (subject III.3 wording).
3. **Why is there no online play?** The *Remote players* module was not chosen; both games are local by design, so there is no network transport to get wrong. An online TicTacToe queue was prototyped and removed to keep that promise.
4. **What makes matches "fair and balanced"?** Round-robin: each participant meets every other one once; ties are broken by additional round-robins among the tied players only.
5. **Is the history "stored securely and up to date"?** Rows are written by the authenticated API right when a game ends (`save-match` validates game type, result and score), served only to the logged-in owner, and exported/deleted with the account (GDPR).
6. **How is a TicTacToe draw recorded?** `DRAW 0-0`; it counts in games played but not as a win.
7. **Can the same alias appear twice in a tournament?** No — `unique_together('tournament','nickname')` plus the view's duplicate/blank checks.
