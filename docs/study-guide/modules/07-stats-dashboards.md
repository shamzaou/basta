# Module — AI-Algo: User and Game Stats Dashboards (Minor)

**Verdict: Works end-to-end ✅ (user dashboard); game/tournament stats are a simpler table ⚠️** — the Profile page is the user dashboard (stat cards, SVG win-rate pie chart, recent matches with game type/date, friends); the tournament view shows per-player points and per-match scores. There is no separate cross-user "game statistics" page — say so.

## What the module requires (42 subject wording)
Provide dashboards showing user statistics (wins/losses, history, performance) and game-session statistics, with data-visualisation tools (charts/graphs) and access to one's own match history and performance metrics.

## What it does in FAST_PONG
Every finished Pong (PvP or vs AI) or TicTacToe game is written to `MatchHistory`. The Profile page computes **Games Played**, **Win Rate** (also drawn as a pie chart), **Best Score**, and lists the last five matches with game type, opponent, score, result and date. The Settings page offers the full statistics as a JSON download (GDPR export). The tournament page shows a live points table per player and score/winner per match.

## Exactly where it is implemented

| Concern | Code | Ref |
|---|---|---|
| Data model | `MatchHistory(user FK, game_type PONG/TICTACTOE, opponent str, result WIN/LOSS/DRAW, score "a-b", date_played)` ordered `-date_played` | `userapp/models.py:66-90` |
| Writing results | Pong `saveMatchHistory` (`pong.js:886-957`), TicTacToe `finishMatch` (`tictactoe.js:192-247`) → `POST /api/auth/save-match/` (JWT) → `save_match_view` | `userapp/views.py:772-820`, route `urls.py:30` |
| User stats computation | `profile_view` GET: `total_matches` (excl. `TOURNAMENT`), `wins`, `win_rate = int(wins/total*100)`, `best_score` = the WIN with the largest `user − opponent` score difference (parsed from `"a-b"`), `match_history` = last 5 | `userapp/views.py:76-142` (`:82-87`, `:90-111`, `:114-123`) |
| Longer history API | `match_history_view` — last 10 matches, `game_type`, `opponent`, `result`, `score`, `date` | `userapp/views.py:744-770`, route `urls.py:29` |
| Dashboard markup | `#profile`: avatar, `#winrate-chart`, three `.stat-card`s (Games Played / Win Rate / Best Score), `.match-history`, friends panel | `templates/frontend/index.html:83-169` |
| Dashboard rendering | `loadProfileData()`: fills the stat cards (`script.js:1141-1143`), builds each match card with a game-type badge, opponent, score, result class `win`/`loss`, localized date (`:1158-1213`), then loads friends/users | `static/frontend/js/script.js:1089-1244` |
| Chart | `createWinratePieChart(wins, total)` — hand-written SVG: green win slice and red loss slice via arc paths (`A r r 0 largeArc 1 x y`), grey circle when no games, centre text `WIN RATE`, `NN%`, `N GAMES` | `script.js:1947-2056` |
| Chart styling | `.winrate-chart-container` | `static/frontend/css/styles.css` (grep `winrate`) |
| Export (all stats) | `export_user_data`: games played, wins, losses, draws, win rate, full match list with ISO dates; SPA adds the avatar as base64 and downloads `user_data_<user>_<date>.json` | `userapp/views.py:970-1030`, `script.js:1549-1660` |
| Game/tournament stats | `view_tournament` JSON: per-player `score` = wins (`Player.get_score`, `tournaments/models.py:95`), per-match scores/winner, `winner_ids`; rendered as players list + matches tables + winner banner | `tournaments/views.py:74-114`, `script.js:2158-2314` |
| Excluding tournament games | `.exclude(game_type='TOURNAMENT')` in `profile_view`; `pong.js:866-867` deliberately does not save tournament matches to `MatchHistory` | `userapp/views.py:82-92` |

## How it interacts with the rest
* Depends on JWT auth for `save-match`/`match-history`/`export-data` and on the session cookie for `profile_view` (module 09).
* Games (module 10 for 3D Pong, module 06 for AI) only *write*; the dashboard only *reads*. No server-side validation of the reported score — the client is trusted (limitation).
* GDPR (module 08): anonymization keeps `MatchHistory` rows (statistics without PII); deletion cascades them away.

## Status after audit
Verified live: four seeded matches → profile shows `4` games, `75%`, best score `3-0`, four match cards with PONG/TICTACTOE badges (screenshot `08-profile`); `export-data` JSON contains the same numbers; tournament table renders per-player scores (screenshot `14-tournament-view`). Unchanged by the audit except that the endpoints are now covered by tests (`GdprTests.test_export_contains_profile_and_history`).

## Likely evaluator questions
1. **Where is the user dashboard?** `/profile` — stat cards, pie chart, recent matches, friends. Data from `GET /api/auth/profile/` (`profile_view`).
2. **How is win rate computed?** `wins / total_matches × 100`, integer-truncated, over non-tournament matches (`views.py:85-87`); the chart derives the same numbers client-side.
3. **What is "Best Score"?** Among the user's wins, the score with the biggest margin (`user − opponent`), e.g. `3-0` beats `3-2` (`views.py:90-111`).
4. **Which charting library?** None — a hand-built SVG pie (`createWinratePieChart`): two arc paths whose sweep is `winPercent × 3.6°`; no dependency, works offline.
5. **Why are tournament games excluded?** Tournament participants are nicknames, not accounts, so a tournament result cannot be attributed to a user's personal record; tournaments have their own points table.
6. **Where are game-session statistics?** Per tournament: points per player and score/winner per match (`view_tournament`). For single games the "session" statistic is the `MatchHistory` row (score, result, date). No aggregated cross-user leaderboard — improvement item.
7. **Can a user get their full history?** Last 5 on the profile, last 10 via `/api/auth/match-history/`, everything via the JSON export.
8. **Is the score trusted from the client?** Yes — `save_match_view` stores what the browser posts. Server-authoritative game state is a listed improvement.
9. **How is the date shown?** Server formats `%d %b %Y`; the SPA re-parses it and prints `toLocaleDateString()`.
10. **How does TicTacToe appear in the stats?** Same table, `game_type='TICTACTOE'`, score `1-0`/`0-1`/`0-0`; the badge on each match card shows the game type. (TicTacToe is an extra feature, not a selected module.)
