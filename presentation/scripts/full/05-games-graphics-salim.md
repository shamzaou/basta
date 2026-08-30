# 05 · Games & Graphics — Salim (slides 22–25, about 3.5 minutes)

---

## Slide 22 — Section divider

Thanks, Nasser. Back to me for the games: the 3D Pong with its AI opponent — that's the Graphics and AI modules — and Tic-Tac-Toe with online matchmaking, the "another game" module.

---

## Slide 23 — 3D Pong and the AI opponent

When you open Pong you choose a mode. **Player vs Player** — two people on one keyboard, W/S and the arrow keys, or on a touch screen by dragging on your half of the canvas. **Player vs AI** — the right paddle is driven by our PongAI.

The game runs in a Three.js scene: a perspective camera above a lit table, and a spinning textured ball. First to three points wins; the HUD shows the score, the player names and the winner; Space pauses.

When a game ends, the result is posted to `/api/auth/save-match/` with the JWT, so it lands in the player's history and statistics — Ali's section.

---

## Slide 24 — Inside the graphics and the AI

**The scene.** A `PerspectiveCamera` with a 75-degree field of view looks down at the table from above and behind. Lighting is an ambient light plus a spot light, so the Phong materials show specular highlights on the glossy table. The paddles are emissive cyan, the net is a thin box, and the table has neon edge lines built from `EdgesGeometry`. The ball's magenta stripes are painted on an HTML canvas at start-up and used as a `CanvasTexture` — that's why it visibly spins. The renderer is antialiased, and the HUD is DOM elements composited over the canvas.

**The physics.** The bounce angle depends on where the ball hits the paddle — centre goes straight, the edges send it up to 45 degrees. Every hit speeds the ball up five percent, up to a cap. Hitting off-centre also adds spin, which bends the trajectory and rotates the mesh. Walls clamp the ball inside and reflect it — that clamp fixed a bug where the ball used to glide along the wall. The canvas keeps a 4:3 ratio when the window resizes.

**The AI — three rules from the subject.**

*Rule one: it may only look once per second.* Every thousand milliseconds the AI takes a snapshot of the ball's position and velocity. Between snapshots it acts only on its last decision, like a person who glanced at the ball a moment ago.

*Rule two: it must anticipate.* From the snapshot it extrapolates where the ball will cross its paddle line, and it folds the path at the walls — so wall bounces are anticipated, not discovered late. Then it adds a prediction error scaled by an accuracy of 0.8, and one decision in ten gets a deliberately big mistake. That is what makes it beatable.

*Rule three: it must simulate keyboard input.* The decision becomes a held ArrowUp or ArrowDown key, fed into the same `InputHandler` a human uses — so the AI paddle moves at exactly human speed and obeys the same bounds. It cannot teleport. Every five seconds the live score tunes its judgement: two points ahead, accuracy drops to 0.6 and mistakes rise to fifteen percent; two points behind, accuracy goes up to 0.9 and mistakes down to five. Only its judgement changes, never its speed.

And no A\*, which the subject forbids: A\* searches a graph, and Pong has no graph — this is kinematic prediction.

---

## Slide 25 — Tic-Tac-Toe with online matchmaking

The "add another game" module asks for a game distinct from Pong, user history, and a matchmaking system.

**Local mode** — two players on one device; the result goes to the logged-in user's history.

**Matchmaking.** "Online — find an opponent" posts to `/api/game/ttt/queue/`. Each waiting player carries a rating: their Tic-Tac-Toe win rate, fifty for new players. When someone joins, the server pairs them with the waiting player whose rating is **closest** — that's the "fair and balanced matches" the subject asks for. Queue entries older than sixty seconds are dropped, and the browser polls the queue every two seconds until it gets a match id.

**Online play with server-side rules.** The board lives in the database, not in the browser. Every move is `POST …/move/` with a cell index; the server takes a row lock and checks it's your turn and the cell is free, then detects win lines or a draw. Both clients poll the match state every second and redraw. Leaving is a forfeit: the other player wins.

**History.** When a match finishes, the server writes one `MatchHistory` row **per player** — win, loss or draw with the opponent's real username — so it appears on both profiles, in both win-rate charts and in the JSON export.

Now Nour will present the tournament system.

---

## If they ask

- *"Why polling instead of WebSockets?"* — Turn-based, so 1–2 seconds of latency is invisible; it's stateless and fits Gunicorn's sync workers with zero extra infrastructure. Django Channels is the upgrade path, and it's the same one we'd use for online Pong.
- *"Can two users get the same match twice / play themselves?"* — The queue excludes yourself; if you already have an active match, `queue` returns it instead of creating another.
- *"Why closest rating and not first-come?"* — Fairness. Ties on rating are broken by who waited longest.
- *"Can the AI lose?"* — Yes: the one-second blind window plus prediction error and random mistakes, at human paddle speed. In a first-to-three game either side can win.
- *"Does the AI adapt to the faster ball?"* — Yes, because it reads the current velocity at every snapshot.
- *"Is the AI on the server?"* — No, in the browser inside the render loop; only the final result goes to the server.
- *"Are Pong scores trusted from the client?"* — Yes — a listed limitation; server-authoritative Pong is a next step.
