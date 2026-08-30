# Module — Graphics: advanced 3D techniques with Three.js / WebGL (Major)

**Verdict: Works end-to-end ✅** — Pong is rendered in real 3D with Three.js r128 (perspective camera, lighting, Phong materials, procedural texture, spin physics). Requires internet for the CDN script.

## What the module requires (42 subject wording)
Use advanced 3D techniques (Three.js/WebGL) to render the Pong game, providing an immersive visual experience while keeping gameplay intact.

## What it does in FAST_PONG
`static/frontend/js/pong.js` is an ES module split into `GamePhysics`, `GameRenderer`, `InputHandler`, `PongAI`, `PongGame`. The renderer builds a scene with a black glossy table with neon edge lines, two emissive cyan paddles, a striped/dotted magenta ball with a canvas-generated texture, a net, ambient + spot lighting and a 75° perspective camera looking down at the table. The loop runs on `requestAnimationFrame`; physics adds spin that curves the ball and rotates the mesh; the canvas keeps a 4:3 aspect and resizes with the container.

## Exactly where it is implemented

| Concern | Symbol | Ref |
|---|---|---|
| Library load | `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js">` (global `THREE`) then `import PongGame from …pong.js` in a `type="module"` script | `templates/frontend/index.html:603-610` |
| Mount | `.game-container` inside `#game` page; `PongGame.initializeGame(container, mode)` from the router | `templates/frontend/index.html:259-263`; `static/frontend/js/script.js:206-214` |
| Config | `GAME_CONFIG` (ball speeds 0.1–0.15, paddle speed, `pointsToWin: 3`) | `pong.js:4-10` |
| Scene & background | `new THREE.Scene()`, `scene.background = new THREE.Color(0x0a0a0a)` | `pong.js:98-99` |
| Camera | `PerspectiveCamera(75, 4/3, 0.1, 1000)` at (0, 6, 6) looking at origin | `pong.js:333-337` |
| Renderer | `WebGLRenderer({antialias:true})`, size from `calculateSize()` (max 800×600, 4:3) | `pong.js:339-350`, `:316-331` |
| Lights | `AmbientLight(0x333333)` + `SpotLight(0xffffff, 0.5)` at (0,10,0) | `pong.js:359-366` |
| Table | `BoxGeometry(10,0.2,6)` + `MeshPhongMaterial` (specular, shininess 100) + `EdgesGeometry`/`LineSegments` neon border | `pong.js:368-383` |
| Ball | `SphereGeometry(0.2,32,32)`, `MeshPhongMaterial` with `map` = procedural `CanvasTexture`, emissive 0xff00aa | `pong.js:395-409`; texture painter `createBallTexture` `:411-441` |
| Paddles | `BoxGeometry(0.2,0.8,1.4)`, emissive cyan Phong material, at x = ±4.9 | `pong.js:443-458` |
| Net | `BoxGeometry(0.05,0.4,6)` | `pong.js:460-470` |
| Physics | `GamePhysics.updatePhysics` — velocity + spin (`ballSpin.z` bends trajectory `:64`), mesh rotation `:70-71`, wall bounce with clamp-back 🆕 `:77-83`, paddle hit-box `:86-93`, scoring `:96-97`; `handlePaddleCollision` computes bounce angle from hit offset (`bounceAngle = relativeIntersectZ·π/4`) and speeds up 5 % per hit; `resetBall` serves with |vz| ∈ [0.01, 0.03] 🆕 `:35-45` | `pong.js:27-100` |
| Input | `InputHandler` — W/S and ↑/↓ via a `Set` of pressed keys, arrow keys ignored in AI mode, cleanup removes listeners | `pong.js:507-582` |
| AI | `PongAI` — samples ball once per second (`UPDATE_INTERVAL`), predicts intercept with error (`ACCURACY`) and `MISTAKE_CHANCE`, speed-limited moves | `pong.js:585-676` |
| Game loop | `animate()` → `requestAnimationFrame`, `update()` only when `playing`, `render()` each frame | `pong.js:1111-1121`, `:1071-1098` |
| Pause | Space toggles `#pauseOverlay` | `pong.js:1049-1069`, overlay `:744-771` |
| HUD overlay | DOM elements absolutely positioned over the canvas: score, instructions, player names, controls; CSS injected by `injectStyles` | `pong.js:120-159`, `:161-314` |
| Mode selection | `initializeGame` shows "Player vs Player / Player vs AI" unless a tournament match is active | `pong.js:1123-1173` |
| Resize | `window 'resize'` → `handleResize` (note: two definitions; the later one at `:472` overrides and resizes to the window) | `pong.js:117`, `:352-357`, `:472-476` |
| Result persistence | `finishMatch` → tournament `finish/` or `saveMatchHistory` → `/api/auth/save-match/` | `pong.js:826-957` |
| Cleanup on route change | `cleanup()` cancels the animation frame and removes key listeners | `pong.js:1100-1109`; called from `script.js:100-103` |

**🆕 Fixed in Aug-2026 audit — ball stuck on the wall:** the original wall check ran after the ball had moved and only flipped `ballVelocity.z` (×0.9 damping) without pushing the ball back inside the ±2.9 table. If the ball overshot the wall by more than 0.9 × its z-speed it was still outside on the next frame, flipped again, and so on — the vertical speed decayed to zero and the ball glided along the wall in a straight line (a Node harness driving the real `GamePhysics` reproduced it: final z 3.05, vz 0.0000). Serves were also nearly flat about a quarter of the time (vz drawn uniformly in ±0.02). The fix clamps `ball.position.z` to the wall, sets `ballVelocity.z` explicitly away from it with a 0.01 minimum, and serves with |vz| between 0.01 and 0.03 (`pong.js:35-45`, `:74-83`). Post-fix harness: 0 stuck rallies, 0 flat serves.

## How it interacts with the rest
* The router creates/destroys the game (`script.js:199-224`); tournament matches pass nicknames through `window.currentMatchPlayers` (`pong.js:727-742`) and post scores to the tournament API (`:846`).
* Normal games post to `save-match/` with the JWT (`:925`), feeding profile stats.
* Depends on the CDN `three.min.js`; no bundler, so `pong.js` is an ES module that expects the global `THREE`.

**🆕 Changed in Aug-2026 audit:** none in this module. Verified by a headless-Chrome walkthrough that clicked "Player vs AI" and rendered the WebGL scene (screenshot `11-pong-3d-vs-ai`).

## Status after audit
Works ✅ in Chrome (SwiftShader headless) and real GPUs. Caveats: CDN dependency (offline → `THREE is not defined`); the second `handleResize` (`:472`) resizes to the full window instead of the container (visual quirk only on resize); `updateDifficulty` uses a hard-coded `scoreDiff = 0` (`:654`) so the AI never adapts; `initializeMatch` (`:773`) posts to a non-existent route and is not called.

## Likely evaluator questions
1. **Why Three.js?** A thin, well-documented scene-graph API over WebGL: cameras, lights, materials and geometries without writing shaders, loadable from a `<script>` tag (no build step, consistent with our vanilla-JS front-end).
2. **What is "advanced" here?** Perspective projection with a tilted camera, Phong shading with specular highlights and emissive materials, a **procedurally generated texture** (`CanvasTexture`, `:411`), edge-line geometry for the neon outline, spin physics coupled to mesh rotation, antialiasing, and a DOM HUD composited over the canvas.
3. **Explain the render loop.** `animate(t)` requests the next frame, runs `update()` (AI → input → physics → scoring) if playing, then `renderer.render(scene, camera)` (`:1111-1121`).
4. **How is the ball's bounce computed?** Offset of the hit from paddle centre → `bounceAngle` up to ±45°; velocity components from cos/sin; speed ×1.05 capped at `maxBallSpeed`; spin proportional to the offset (`:45-58`).
5. **How does the AI work and is it fair?** It only "sees" the ball once per second (`UPDATE_INTERVAL=1000`, `:589`), predicts the intercept with random error and occasional mistakes, and moves at a capped speed (`:618-650`) — mimicking a human, as the subject asks for the AI opponent.
6. **How do you handle resizing/responsiveness?** `calculateSize` keeps 4:3 within the container (`:316-331`); CSS in `injectStyles` (`:164-175`) sizes `.game-container`.
7. **How do you clean up WebGL when navigating away?** `cleanup()` cancels RAF and removes listeners (`:1100`); the container is emptied by `initializeGameIfNeeded` (`script.js:209`). (Renderer disposal is not called — an improvement.)
8. **Where do the player names come from in tournaments?** `window.currentMatchPlayers` set by `startTournamentMatch` (`script.js:495-499`) → `setupPlayerNames` (`pong.js:727`).
9. **What if WebGL is unavailable?** `new THREE.WebGLRenderer` throws; `startGame` catches and logs (`:1175-1187`) — the page shows an empty container. Firefox/Chrome/Edge all support WebGL 1.
