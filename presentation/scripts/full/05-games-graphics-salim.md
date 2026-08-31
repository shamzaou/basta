# 05 · Games & Graphics — Salim (slides 20–23, about 3.5 minutes)

---

## Slide 20 — Section divider

Thanks, Nasser. Back to me for the games: the 3D Pong with its AI opponent — that's the Graphics and AI modules — and Tic-Tac-Toe, the "another game" module.

---

## Slide 21 — 3D Pong and the AI opponent

When you open Pong you choose a mode. **Player vs Player** — two people on one keyboard, W/S and the arrow keys, or on a touch screen by dragging on your half of the canvas. **Player vs AI** — the right paddle is driven by our PongAI.

The game runs in a Three.js scene: a perspective camera above a lit table, and a spinning textured ball. First to three points wins; the HUD shows the score, the player names and the winner; Space pauses.

When a game ends, the result is posted to `/api/auth/save-match/` with the JWT, so it lands in the player's history and statistics — Ali's section.

---

## Slide 22 — Inside the graphics and the AI

**The scene.** A `PerspectiveCamera` with a 75-degree field of view looks down at the table from above and behind. Lighting is an ambient light plus a spot light, so the Phong materials show specular highlights on the glossy table. The paddles are emissive cyan, the net is a thin box, and the table has neon edge lines built from `EdgesGeometry`. The ball's magenta stripes are painted on an HTML canvas at start-up and used as a `CanvasTexture` — that's why it visibly spins. The renderer is antialiased, and the HUD is DOM elements composited over the canvas.

**The physics.** The bounce angle depends on where the ball hits the paddle — centre goes straight, the edges send it up to 45 degrees. Every hit speeds the ball up five percent, up to a cap. Hitting off-centre also adds spin, which bends the trajectory and rotates the mesh. Walls clamp the ball inside and reflect it — that clamp fixed a bug where the ball used to glide along the wall. The canvas keeps a 4:3 ratio when the window resizes.

**The AI — three rules from the subject.**

*Rule one: it may only look once per second.* Every thousand milliseconds the AI takes a snapshot of the ball's position and velocity. Between snapshots it acts only on its last decision, like a person who glanced at the ball a moment ago.

*Rule two: it must anticipate.* From the snapshot it extrapolates where the ball will cross its paddle line, and it folds the path at the walls — so wall bounces are anticipated, not discovered late. Then it adds a prediction error scaled by an accuracy of 0.8, and one decision in ten gets a deliberately big mistake. That is what makes it beatable.

*Rule three: it must simulate keyboard input.* The decision becomes a held ArrowUp or ArrowDown key, fed into the same `InputHandler` a human uses — so the AI paddle moves at exactly human speed and obeys the same bounds. It cannot teleport. Every five seconds the live score tunes its judgement: two points ahead, accuracy drops to 0.6 and mistakes rise to fifteen percent; two points behind, accuracy goes up to 0.9 and mistakes down to five. Only its judgement changes, never its speed.

And no A\*, which the subject forbids: A\* searches a graph, and Pong has no graph — this is kinematic prediction.

---

## Slide 23 — Tic-Tac-Toe: the second game, history and matchmaking

The "add another game" module asks for three things: a game distinct from Pong, user history tracking, and a matchmaking system.

**The game.** Tic-Tac-Toe is turn-based, the opposite of Pong. Two players share one device; X and O alternate on the three-by-three board. Win lines and draws are detected in the browser, a move on an occupied cell or after the game is over is ignored, and "Reset game" starts over. Like Pong, it is local by design — there is no online play anywhere in the project.

**User history.** When a game ends, the result is posted to `/api/auth/save-match/` with the JWT, and the server stores one `MatchHistory` row — game type TICTACTOE, win, loss or draw, and the date. It shows up in the profile's recent matches, in the win-rate chart and in the JSON export, exactly like a Pong game.

**Matchmaking.** Our matchmaking is the tournament system. A tournament of three to eight players is scheduled as a round-robin, the page announces the next pairing — "Next match: A versus B" — and if the leaders finish tied, the server creates tiebreaker matches until one winner remains. Nour presents it in the next section.

Now Nour will present the tournament system.

---

## If they ask

- *"Why is Tic-Tac-Toe not played online?"* — A project decision: no online play at all, for either game — the remote-players module is not selected. We did prototype a queue-based online mode and removed it again to keep the project consistent. The module asks for history and matchmaking; the tournament system is our matchmaking.
- *"Where is the matchmaking?"* — The tournament: the server schedules every pairing, announces who plays next and creates tiebreakers. Nour shows it next.
- *"Where does the Tic-Tac-Toe result go?"* — `POST /api/auth/save-match/` with the JWT, same endpoint as Pong; one MatchHistory row for the logged-in user.
- *"Can the AI lose?"* — Yes: the one-second blind window plus prediction error and random mistakes, at human paddle speed. In a first-to-three game either side can win.
- *"Does the AI adapt to the faster ball?"* — Yes, because it reads the current velocity at every snapshot.
- *"Is the AI on the server?"* — No, in the browser inside the render loop; only the final result goes to the server.
- *"Are Pong scores trusted from the client?"* — Yes — a listed limitation; server-authoritative Pong is a next step.
