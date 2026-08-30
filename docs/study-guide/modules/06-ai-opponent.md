# Module — AI-Algo: Introduce an AI Opponent (Major)

**Verdict: Works end-to-end ✅** — "Player vs AI" in 3D Pong. The AI looks at the game **once per second**, predicts where the ball will cross its paddle **including wall bounces**, and then plays by **pressing simulated arrow keys** at exactly the same paddle speed as a human. No A*. 🆕 Rewritten in the Aug-2026 subject-compliance pass (previously it moved the paddle directly and slower than a player).

## What the module requires (42 subject wording)
An AI opponent that is challenging and can win; must replicate human behaviour by **simulating keyboard input**; may refresh its view of the game **only once per second**, so it must anticipate bounces; A* is forbidden; must adapt to gameplay scenarios; and (mandatory part) must have the **same paddle speed** as a regular player.

## What it does in FAST_PONG
1. Every frame `PongGame.update()` calls `this.ai.update(ball, ballVelocity)` (`pong.js`), which
2. once per second (`UPDATE_INTERVAL = 1000`, `pong.js:681`, `:702`) snapshots ball position + velocity and computes a target z (`decideNextMove`);
3. the target comes from `predictZ()` (`pong.js:714-725`): extrapolate `z + vz·t` to the paddle's x, and **fold** the value back into the field every time it crosses ±2.9 — exactly what the ball does when it bounces on the walls; if the ball is moving away the AI drifts to the centre;
4. human imperfection: `predictionError = (rand − 0.5)·(1 − ACCURACY)` and a `MISTAKE_CHANCE` of a random ±1 offset (`:727-735`);
5. every frame `pressKeys()` (`:742-753`) puts `arrowdown`/`arrowup` into a `Set` and hands it to `InputHandler.setSimulatedKeys()`; it releases the key inside a ±0.1 dead-zone (`DEAD_ZONE`, `:686`);
6. `InputHandler.update()` (`:615-636`) moves paddle 2 from `aiKeys` in AI mode — through the **same code and the same `GAME_CONFIG.paddleSpeed` (0.15)** as paddle 1; human arrow keys are ignored in AI mode;
7. `updateDifficulty()` (`:755-773`) runs every 5 s with the live score: AI leading by ≥2 → `ACCURACY 0.6 / MISTAKE 0.15`; trailing by ≥2 → `0.9 / 0.05`; else `0.8 / 0.10`. Speed is never touched.

## Exactly where it is implemented
| Piece | `static/frontend/js/pong.js` |
|---|---|
| `InputHandler.aiKeys`, `setSimulatedKeys`, paddle-2 movement from simulated keys | `:536`, `:626-640` |
| `class PongAI` (constructor with `getScore` callback and the `InputHandler`) | `:671-690` |
| once-per-second sampling (`update`) | `:692-710` |
| `predictZ` (wall folding) | `:714-725` |
| `decideNextMove` (error margin, mistakes, clamp to ±2.1) | `:726-741` |
| `pressKeys` (simulated keyboard, dead-zone) | `:742-753` |
| `updateDifficulty` (score-driven accuracy) | `:755-773` |
| Mode selection "Player vs AI" → `new PongGame(container, 'ai')` | `PongGame.initializeGame` (end of file) |

## How it interacts with the rest
`PongGame` creates the AI only in `'ai'` mode and passes `() => this.state.score` and `this.inputHandler`; physics (`GamePhysics`) is unchanged; results are saved as a normal match with opponent "AI" (`saveMatchHistory`).

## Status after audit
Node harness (`scratchpad/ai_harness.js`): the AI never sets the paddle position itself; per-frame displacement is exactly 0.1500; the folded prediction for a ball at (0, 2) with v (0.1, 0.1) equals the simulated bounce point (−1.10, where the straight line would give 6.90); in a 1000-frame rally the AI returned the ball 7 times. Live headless game: the AI wins against an idle player.

## Likely evaluator questions
1. **How does the AI "see" the game?** Only once per second (`UPDATE_INTERVAL`); between samples it acts on its last prediction — that is why it must anticipate bounces.
2. **How do you simulate keyboard input?** `pressKeys()` fills `InputHandler.aiKeys` with `arrowup`/`arrowdown`; the paddle moves only through `InputHandler.update()`, the same function that reads the human keys.
3. **Is it as fast as a player?** Yes — same `paddleSpeed` (0.15 per frame), same bounds (±2.1); verified by the harness.
4. **How does it anticipate bounces?** `predictZ` reflects the extrapolated z at ±2.9 as many times as needed (`while` loop), i.e. it simulates the wall bounces the physics will apply.
5. **Why no A*?** There is nothing to path-find: it's a one-dimensional interception problem solved by linear extrapolation + reflection.
6. **Can it lose / win?** Both: the error margin and mistake chance make it miss; against an idle player it wins 3-0.
7. **How does it adapt?** Rubber-banding on the score every 5 s (accuracy and mistake chance only).
8. **Where is the difficulty setting?** `updateDifficulty` constants — an easy extension would be a difficulty menu mapping to those two parameters.
