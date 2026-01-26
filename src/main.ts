import { createGame } from "./game/game";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D context not available");

const menuEl = document.getElementById("menu") as HTMLDivElement;
const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
const hudEl = document.getElementById("hud") as HTMLDivElement;

const levelupRoot = document.getElementById("levelup") as HTMLDivElement;
const levelupChoices = document.getElementById("luChoices") as HTMLDivElement;
const levelupSub = document.getElementById("luSub") as HTMLDivElement;

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
  hud: {
    root: hudEl,
    timePill: document.getElementById("timePill") as HTMLSpanElement,
    killsPill: document.getElementById("killsPill") as HTMLSpanElement,
    hpPill: document.getElementById("hpPill") as HTMLSpanElement,
    lvlPill: document.getElementById("lvlPill") as HTMLSpanElement,
  },
  ui: {
    menuEl,
    levelupEl: { root: levelupRoot, choices: levelupChoices, sub: levelupSub },
  },
});

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

startBtn.addEventListener("click", () => {
  menuEl.hidden = true;
  hudEl.hidden = false;
  game.startRun();
});
