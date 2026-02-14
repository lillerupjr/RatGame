import type { WorldLightingState } from "../../../engine/world/world";
import { configurePixelPerfect } from "../../../engine/render/pixelPerfect";

export type LightingCamera = {
  screenW: number;
  screenH: number;
  projectWorldToScreen: (worldX: number, worldY: number, heightUnits: number) => { x: number; y: number };
};

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

let lightingLayer: HTMLCanvasElement | null = null;

function getLightingLayer(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (!lightingLayer) lightingLayer = document.createElement("canvas");
  if (lightingLayer.width !== width) lightingLayer.width = width;
  if (lightingLayer.height !== height) lightingLayer.height = height;
  const layerCtx = lightingLayer.getContext("2d");
  if (!layerCtx) return null;
  configurePixelPerfect(layerCtx);
  return { canvas: lightingLayer, ctx: layerCtx };
}

export function renderLighting(
  ctx: CanvasRenderingContext2D,
  state: WorldLightingState,
  camera: LightingCamera,
): void {
  const darknessAlpha = clamp01(state.darknessAlpha);
  const lights = state.lights;
  if (darknessAlpha <= 0 && lights.length === 0) return;

  const layer = getLightingLayer(camera.screenW, camera.screenH);
  if (!layer) return;
  const lctx = layer.ctx;
  lctx.save();
  lctx.globalCompositeOperation = "source-over";
  lctx.clearRect(0, 0, camera.screenW, camera.screenH);

  if (darknessAlpha > 0) {
    lctx.fillStyle = `rgba(0,0,0,${darknessAlpha})`;
    lctx.fillRect(0, 0, camera.screenW, camera.screenH);
  }

  if (lights.length > 0) {
    lctx.globalCompositeOperation = "destination-out";
    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      const radiusPx = Math.max(1, light.radiusPx);
      const intensity = clamp01(light.intensity);
      if (intensity <= 0) continue;

      const p = camera.projectWorldToScreen(light.worldX, light.worldY, light.heightUnits | 0);
      const gradient = lctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radiusPx);
      gradient.addColorStop(0, `rgba(0,0,0,${intensity})`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");

      lctx.fillStyle = gradient;
      lctx.beginPath();
      lctx.arc(p.x, p.y, radiusPx, 0, Math.PI * 2);
      lctx.fill();
    }
  }
  lctx.restore();

  ctx.save();
  configurePixelPerfect(ctx);
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(layer.canvas, 0, 0);
  ctx.restore();
}
