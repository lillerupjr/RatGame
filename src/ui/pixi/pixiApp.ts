import { Application } from "pixi.js";
import { updateTweens } from "./pixiTween";

let app: Application | null = null;
let canvasEl: HTMLCanvasElement | null = null;

export async function getOrCreatePixiApp(): Promise<Application> {
  if (app) return app;

  app = new Application();
  await app.init({
    background: 0x000000,
    backgroundAlpha: 0,
    resizeTo: window,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  canvasEl = app.canvas as HTMLCanvasElement;
  canvasEl.id = "pixiCanvas";
  canvasEl.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;z-index:50;pointer-events:none;visibility:hidden;";

  // Insert after the #ui canvas
  const uiCanvas = document.getElementById("ui");
  if (uiCanvas?.parentElement) {
    uiCanvas.parentElement.insertBefore(canvasEl, uiCanvas.nextSibling);
  } else {
    document.body.appendChild(canvasEl);
  }

  // Drive tweens from ticker
  app.ticker.add((ticker) => {
    updateTweens(ticker.deltaMS);
  });

  return app;
}

export function showPixiCanvas(): void {
  if (!canvasEl) return;
  canvasEl.style.visibility = "visible";
  canvasEl.style.pointerEvents = "auto";
}

export function hidePixiCanvas(): void {
  if (!canvasEl) return;
  canvasEl.style.visibility = "hidden";
  canvasEl.style.pointerEvents = "none";
}

export function isPixiCanvasVisible(): boolean {
  return canvasEl?.style.visibility === "visible";
}

export function getPixiApp(): Application | null {
  return app;
}
