// src/main.ts
import { createGame } from "./game/game";
import { resizeCanvasPixelPerfect } from "./engine/render/pixelPerfect";
import { getDomRefs } from "./ui/domRefs";
import { wireMenus } from "./ui/menuWiring";

const refs = getDomRefs();
const canvas = refs.canvas;
const rawCtx = canvas.getContext("2d");
if (!rawCtx) throw new Error("Canvas 2D context not available");
const ctx = rawCtx;

// This adjusts the world to screen pixel ratio
const pixelScale = 2;

function resize() {

  resizeCanvasPixelPerfect(canvas, ctx, window.innerWidth, window.innerHeight,pixelScale);
}
window.addEventListener("resize", resize);
resize();

const game = createGame({
  canvas,
  ctx,
  hud: refs.hud,
  ui: refs.ui,
});

wireMenus(refs, game);

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// NOTE: no startBtn handler here -- game.ts owns menu click-to-start,
// and reads startBtn.dataset.weapon.
