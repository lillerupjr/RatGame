// src/main.ts
import { createGame } from "./game/game";
import { getDomRefs } from "./ui/domRefs";
import { wireMenus } from "./ui/menuWiring";

const refs = getDomRefs();
const canvas = refs.canvas;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D context not available");

function resize() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  // @ts-ignore
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
