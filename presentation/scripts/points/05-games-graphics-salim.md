# 05 · Games & Graphics — Salim (slides 20–23, about 3.5 minutes)

## Slide 20 — Section divider

## Slide 21 — 3D Pong and the AI opponent (screenshots)
- Mode select: Player vs Player (one keyboard W/S vs ↑/↓, or touch — drag on your half) or Player vs AI.
- First to 3 points; HUD shows score, names, winner; Space pauses.
- Results posted to `/api/auth/save-match/` with the JWT → profile stats.

## Slide 22 — Inside the graphics and the AI
- **Scene**: PerspectiveCamera 75° above the table; ambient + spot light; Phong materials (specular highlights); emissive cyan paddles; ball texture painted on an HTML canvas → `CanvasTexture`; neon edge lines; antialiasing; DOM HUD over the canvas.
- **Physics**: bounce angle from hit offset (±45°); +5 % speed per hit (capped); spin bends the path and rotates the mesh; wall clamp + reflect; 4:3 canvas on resize.
- **AI rule 1 — once per second**: snapshot of ball position + velocity every 1000 ms; acts on the last decision in between.
- **AI rule 2 — predict with errors**: extrapolate to the paddle plane, fold at the walls (bounces anticipated); add a prediction error (accuracy 0.8) and a 10 % "big mistake".
- **AI rule 3 — simulated keyboard**: decision = hold ArrowUp/ArrowDown in the same InputHandler as a human → identical paddle speed. Every 5 s the score tunes judgement: 2 ahead → accuracy 0.6 / mistakes 15 %; 2 behind → 0.9 / 5 %.
- **No A\***: Pong has no graph to search; it's kinematic prediction.

## Slide 23 — Tic-Tac-Toe: the second game, history and matchmaking (the "another game" module)
- **A game distinct from Pong**: turn-based, two players on one device; X and O alternate; win lines / draw detected in the browser; illegal moves ignored; "Reset game".
- **User history**: result posted to `/api/auth/save-match/` with the JWT → one `MatchHistory` row (TICTACTOE, WIN/LOSS/DRAW) → profile, win-rate chart, JSON export.
- **Matchmaking = the tournament system**: round-robin pairings, "Next match: A vs B" announced, tiebreaker rounds until one winner (Nour's section).
- **Not online**: both games run on one device by design — the "remote players" module is not selected.

## Be ready for
- Why is there no online Tic-Tac-Toe? Project decision: no online play at all. The module asks for history + matchmaking, and the tournament system is our matchmaking. (An online queue was prototyped and removed.)
- Where is the matchmaking then? Tournament: the server schedules every pairing and announces who plays next.
- Does the AI see bounces? Yes — the prediction folds the path at ±2.9 (the wall).
- Can the AI lose? Yes — 1 s blind window + error + mistakes; it plays at human paddle speed.
- Hand over to Nour: tournaments.
