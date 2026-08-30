# 05 · Games & Graphics — Salim (slides 22–25, about 3.5 minutes)

## Slide 22 — Section divider

## Slide 23 — 3D Pong and the AI opponent (screenshots)
- Mode select: Player vs Player (one keyboard W/S vs ↑/↓, or touch — drag on your half) or Player vs AI.
- First to 3 points; HUD shows score, names, winner; Space pauses.
- Results posted to `/api/auth/save-match/` with the JWT → profile stats.

## Slide 24 — Inside the graphics and the AI
- **Scene**: PerspectiveCamera 75° above the table; ambient + spot light; Phong materials (specular highlights); emissive cyan paddles; ball texture painted on an HTML canvas → `CanvasTexture`; neon edge lines; antialiasing; DOM HUD over the canvas.
- **Physics**: bounce angle from hit offset (±45°); +5 % speed per hit (capped); spin bends the path and rotates the mesh; wall clamp + reflect; 4:3 canvas on resize.
- **AI rule 1 — once per second**: snapshot of ball position + velocity every 1000 ms; acts on the last decision in between.
- **AI rule 2 — predict with errors**: extrapolate to the paddle plane, fold at the walls (bounces anticipated); add a prediction error (accuracy 0.8) and a 10 % "big mistake".
- **AI rule 3 — simulated keyboard**: decision = hold ArrowUp/ArrowDown in the same InputHandler as a human → identical paddle speed. Every 5 s the score tunes judgement: 2 ahead → accuracy 0.6 / mistakes 15 %; 2 behind → 0.9 / 5 %.
- **No A\***: Pong has no graph to search; it's kinematic prediction.

## Slide 25 — Tic-Tac-Toe with online matchmaking (the "another game" module)
- **Local**: two players, one device; result saved to the logged-in user's history.
- **Matchmaking**: `POST /api/game/ttt/queue/` — rating = your Tic-Tac-Toe win rate (50 for new players); server pairs the two **closest ratings**; entries older than 60 s dropped; client polls every 2 s.
- **Server-side rules**: board in the DB; `POST …/move/` validates turn + free cell under a row lock; win lines / draw detected on the server; both clients poll state every 1 s; `leave` = forfeit.
- **History**: one `MatchHistory` row **per player** (WIN/LOSS/DRAW, opponent's name) → both profiles, win-rate chart, JSON export.

## Be ready for
- Why polling, not WebSockets? Simple, stateless, fits Gunicorn sync workers; 1–2 s is fine for turn-based play; Channels is the upgrade.
- Why closest rating? "Fair and balanced matches" from the subject.
- Does the AI see bounces? Yes — the prediction folds the path at ±2.9 (the wall).
- Can the AI lose? Yes — 1 s blind window + error + mistakes; it plays at human paddle speed.
- Hand over to Nour: tournaments.
