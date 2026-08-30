# Module — AI-Algo: Introduce an AI Opponent (Major)

**Verdict: Works end-to-end ✅** — "Player vs AI" mode in 3D Pong; the AI paddle samples the game once per second, predicts the ball's intercept point, and moves with deliberate imperfection. Results are saved to the player's history with opponent `AI`.

## What the module requires (42 subject wording)
Develop an AI opponent that provides a challenging, engaging experience without using the A* algorithm. The AI must simulate human behaviour: it may only refresh its view of the game **once per second**, so it has to anticipate bounces and act as if it were pressing the keyboard. It must be able to win occasionally and must adapt to the game's mechanics (power-ups, speed).

## What it does in FAST_PONG
On the Pong page the mode-selection screen offers **Player vs Player** and **Player vs AI** (`pong.js:1145-1172`). In AI mode the right paddle is driven by the `PongAI` class: every 1000 ms it takes a snapshot of the ball's position and velocity, computes where the ball will cross the paddle's x-plane, adds a controlled prediction error and an occasional random "mistake", then moves toward that target every frame at a capped speed — the equivalent of a human holding the up/down key.

## Exactly where it is implemented

| Concern | Code | Ref (`static/frontend/js/pong.js`) |
|---|---|---|
| Mode selection UI | `PongGame.initializeGame` → `modeSelection` with `pvpButton` / `aiButton` (`'Player vs AI'`) | `:1145-1172` |
| AI instantiation | `this.ai = gameMode === 'ai' ? new PongAI(this.renderer.paddle2, () => this.state.score) : null` — 🆕 the AI receives a live-score getter | `:666`, constructor call in `PongGame` |
| Per-frame hook | `PongGame.update()` → `this.ai.update(ball, ballVelocity)` only in AI mode | `:1075-1077` |
| AI class | `class PongAI` — constants `UPDATE_INTERVAL = 1000` ms, `ACCURACY = 0.8`, `MAX_SPEED = 0.12`, `MISTAKE_CHANCE = 0.10`, `difficultyUpdateInterval = 5000` (🆕 `REACTION_DELAY` removed) | `:666-680` |
| One-second refresh | `update()`: if `now - lastUpdateTime >= UPDATE_INTERVAL` → snapshot `lastSeenBallPosition/Velocity` and call `decideNextMove`; otherwise keep executing the previous decision | `:600-616` |
| Prediction | `decideNextMove`: when the ball moves toward the AI (`ballVelocity.x > 0`) → `timeToIntercept = (paddle.x - ball.x) / v.x`, `perfectZ = ball.z + v.z * timeToIntercept`, plus `predictionError = (rand-0.5)·(1-ACCURACY)` and, with probability `MISTAKE_CHANCE`, an extra ±1 unit; when the ball moves away → drift toward centre (`±0.25`) | `:618-639` |
| Decision → "key press" | sets `nextMove = 'up' | 'down' | null` using a 0.1 dead-zone around `targetZ` | `:632-638` |
| Movement | `executeMove()`: speed = `min(MAX_SPEED, distance/10)`, clamped to the table (`z ∈ [-2.1, 2.1]`) — same bounds as the human paddle | `:641-650` |
| Adaptive difficulty 🆕 | `updateDifficulty()` every 5 s reads the live score: `scoreDiff = player2 − player1` (AI minus human). AI ahead by ≥ 2 → `ACCURACY 0.6 / MISTAKE 0.15 / MAX_SPEED 0.10` (eases off); behind by ≥ 2 → `0.9 / 0.05 / 0.14` (tries harder); otherwise `0.8 / 0.10 / 0.12`. Before the second sweep `scoreDiff` was hard-coded to 0 and the constructor's tuning was overwritten on the first frame | `:733-755` |
| Human input gating | `InputHandler` ignores ↑/↓ in AI mode (`handleKeyDown` returns early; `update()` skips paddle 2) so the AI paddle cannot be helped | `:507-575`, esp. `:530-533`, `:555-562` |
| Names & history | player names `Player` / `AI` (`:738-739`); `saveMatchHistory` sends `opponent: "AI"` with game_type `PONG` | `:886-957` |
| Physics the AI must anticipate | ball speed grows 5 % per paddle hit up to `maxBallSpeed 0.15`, spin from hit offset, wall bounces with damping | `GamePhysics` `:27-92` |

## How it interacts with the rest
* Pure client-side; no API involved until the match ends (`POST /api/auth/save-match/`, `userapp/views.py:772-820`) → `MatchHistory(opponent='AI')` → profile stats/win-rate (module 07).
* Uses the same `GamePhysics`/`GameRenderer` as PvP, so the AI plays exactly the game the human plays (same bounds, same collision hitbox).
* Tournament matches are always PvP (nicknames), never vs AI (`script.js:213` passes `'pvp'` when `currentMatchId` is set).

## Status after audit
Verified in the headless-Chrome walkthrough (mode selection → "Player vs AI" → 3D scene renders, screenshot `11-pong-3d-vs-ai`); `save-match` with `opponent: "AI"` verified via the API flow. **🆕 Second sweep:** the difficulty logic is real now — the AI eases off when it leads by two points and tightens up when it trails (values above, `pong.js:733-755`, verified with a Node harness); the unused `REACTION_DELAY` was removed; the once-per-second decision rule is unchanged. A finished vs-AI game now announces the winner ("Player wins! 3 - 0") in the HUD.

## Likely evaluator questions
1. **How does your AI work?** Once per second it looks at the ball (position + velocity), computes where the ball will reach the paddle plane, adds error/mistakes, and then, every frame, "presses" up or down toward that target at a capped speed.
2. **How do you respect the "refresh once per second" rule?** `UPDATE_INTERVAL = 1000` ms in `PongAI.update` (`pong.js:608`): between snapshots the AI acts only on its last decision, exactly like a human who saw the ball a moment ago.
3. **Why no A\*?** A* is a graph path-finding algorithm; Pong has no graph to search. The AI uses kinematic prediction (linear extrapolation of the ball) — simpler, faster and subject-compliant.
4. **Does it simulate keyboard input?** Yes: decisions are `'up'`/`'down'`/none, and the paddle moves with the same bounds as the human's; the human's ↑/↓ keys are disabled for the AI paddle (`InputHandler`, `:530`).
5. **Can it lose / can it win?** Yes: `ACCURACY`, `MISTAKE_CHANCE` (10 % of decisions add a large error) and the 1 s blind window make it beatable; with `pointsToWin = 3` (`GAME_CONFIG`, `:9`) games are short and either side can win.
6. **Does it anticipate bounces?** It extrapolates linearly to the paddle plane; wall bounces are not reflected explicitly — the 1 s re-sample corrects the target after a bounce. (Honest limitation; the fix is to fold `z` at ±2.9 in `decideNextMove`.)
7. **How is difficulty tuned?** Constants in the constructor and `updateDifficulty()` (accuracy, mistake chance, max speed). The score-based adaptation is stubbed (`scoreDiff = 0`) — an improvement item.
8. **Does the AI adapt to speed changes?** The ball accelerates on every hit (`GamePhysics.handlePaddleCollision`, `:49-52`); because the AI reads the *current* velocity each second, its intercept prediction automatically accounts for the faster ball.
9. **Where is the AI executed — server or client?** In the browser, inside the render loop (`requestAnimationFrame`); no server round-trip.
10. **How are AI games recorded?** `finishMatch` → `saveMatchHistory` → `POST /api/auth/save-match/` with `opponent: "AI"`, result WIN/LOSS, score `p1-p2`; visible on the profile and in the JSON export.
