import { worldToScreen } from "../../../../engine/math/iso";
import { KENNEY_TILE_WORLD } from "../../../../engine/render/kenneyTiles";
import type { CompiledKenneyMap } from "../../../map/compile/kenneyMap";
import type { TileHeightGrid } from "../../../map/tileHeightUnits";
import {
  formatSweepTileHeight,
  renderHeightUnitsToSweepTileHeight,
} from "../../../map/tileHeightUnits";

export type TileHeightMapDebugOverlay = {
  key: string;
  canvas: HTMLCanvasElement;
  originX: number;
  originY: number;
};

const TILE_HEIGHT_MAP_STYLE_VERSION = 1;
const LABEL_TILE_LIMIT = 36 * 36;
const CANVAS_PADDING_PX = 8;

let cachedOverlay: TileHeightMapDebugOverlay | null = null;

export function buildTileHeightMapDebugOverlayKey(
  mapId: string,
  grid: TileHeightGrid,
  elevPx: number,
): string {
  return `tile-height-map:v${TILE_HEIGHT_MAP_STYLE_VERSION}:map=${mapId}:hv=${grid.version}:elev=${elevPx}`;
}

export function clearTileHeightMapDebugOverlayCache(): void {
  cachedOverlay = null;
}

export function getTileHeightMapDebugOverlay(
  compiledMap: CompiledKenneyMap,
  elevPx: number,
): TileHeightMapDebugOverlay | null {
  const key = buildTileHeightMapDebugOverlayKey(compiledMap.id, compiledMap.tileHeightGrid, elevPx);
  if (cachedOverlay?.key === key) return cachedOverlay;
  cachedOverlay = buildTileHeightMapDebugOverlay(compiledMap, elevPx, key);
  return cachedOverlay;
}

type ProjectedPt = { x: number; y: number };

function projectAtZ(worldX: number, worldY: number, zVisual: number, elevPx: number): ProjectedPt {
  const projected = worldToScreen(worldX, worldY);
  return {
    x: projected.x,
    y: projected.y - zVisual * elevPx,
  };
}

function projectDiamond(tx: number, ty: number, zVisual: number, elevPx: number): [ProjectedPt, ProjectedPt, ProjectedPt, ProjectedPt] {
  const x0 = tx * KENNEY_TILE_WORLD;
  const y0 = ty * KENNEY_TILE_WORLD;
  const x1 = (tx + 1) * KENNEY_TILE_WORLD;
  const y1 = (ty + 1) * KENNEY_TILE_WORLD;
  return [
    projectAtZ(x0, y0, zVisual, elevPx),
    projectAtZ(x1, y0, zVisual, elevPx),
    projectAtZ(x1, y1, zVisual, elevPx),
    projectAtZ(x0, y1, zVisual, elevPx),
  ];
}

function buildTileHeightMapDebugOverlay(
  compiledMap: CompiledKenneyMap,
  elevPx: number,
  key: string,
): TileHeightMapDebugOverlay | null {
  const grid = compiledMap.tileHeightGrid;
  const { originTx, originTy, width, height, heights } = grid;

  let hMin = Number.POSITIVE_INFINITY;
  let hMax = Number.NEGATIVE_INFINITY;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let ly = 0; ly < height; ly++) {
    const ty = originTy + ly;
    for (let lx = 0; lx < width; lx++) {
      const tx = originTx + lx;
      const idx = ly * width + lx;
      const tileHeight = heights[idx];
      const terrainHeight = compiledMap.getTile(tx, ty).h | 0;
      if (tileHeight < hMin) hMin = tileHeight;
      if (tileHeight > hMax) hMax = tileHeight;
      const diamond = projectDiamond(tx, ty, terrainHeight, elevPx);
      for (let i = 0; i < diamond.length; i++) {
        const p = diamond[i];
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(hMin)) return null;
  if (hMin === hMax) hMax = hMin + 1;

  const originX = Math.floor(minX) - CANVAS_PADDING_PX;
  const originY = Math.floor(minY) - CANVAS_PADDING_PX;
  const canvasWidth = Math.max(1, Math.ceil(maxX) - originX + CANVAS_PADDING_PX);
  const canvasHeight = Math.max(1, Math.ceil(maxY) - originY + CANVAS_PADDING_PX);

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const showAllLabels = width * height <= LABEL_TILE_LIMIT;
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let ly = 0; ly < height; ly++) {
    const ty = originTy + ly;
    for (let lx = 0; lx < width; lx++) {
      const tx = originTx + lx;
      const idx = ly * width + lx;
      const tileHeight = heights[idx];
      const terrainHeight = compiledMap.getTile(tx, ty).h | 0;
      const terrainSweepHeight = renderHeightUnitsToSweepTileHeight(terrainHeight);
      const diamond = projectDiamond(tx, ty, terrainHeight, elevPx);
      const [nw, ne, se, sw] = diamond;
      const normalized = (tileHeight - hMin) / (hMax - hMin);
      const red = normalized < 0.5 ? Math.round(normalized * 2 * 255) : 255;
      const green = normalized < 0.5 ? 255 : Math.round((1 - (normalized - 0.5) * 2) * 255);
      const hasRaisedContribution = tileHeight > terrainSweepHeight + 1e-3;

      ctx.globalAlpha = hasRaisedContribution ? 0.58 : 0.26;
      ctx.fillStyle = `rgb(${red},${green},40)`;
      ctx.beginPath();
      ctx.moveTo(nw.x - originX, nw.y - originY);
      ctx.lineTo(ne.x - originX, ne.y - originY);
      ctx.lineTo(se.x - originX, se.y - originY);
      ctx.lineTo(sw.x - originX, sw.y - originY);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = hasRaisedContribution ? 0.75 : 0.35;
      ctx.strokeStyle = hasRaisedContribution ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.35)";
      ctx.lineWidth = hasRaisedContribution ? 1.2 : 0.75;
      ctx.stroke();

      if (!showAllLabels && !hasRaisedContribution) continue;

      const cx = (nw.x + ne.x + se.x + sw.x) * 0.25 - originX;
      const cy = (nw.y + ne.y + se.y + sw.y) * 0.25 - originY;
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = hasRaisedContribution ? "#fff" : "rgba(20,20,20,0.82)";
      ctx.fillText(formatSweepTileHeight(tileHeight), cx, cy);
      if (hasRaisedContribution) {
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = "#ffe59a";
        ctx.fillText(`t${formatSweepTileHeight(terrainSweepHeight)}`, cx, cy + 10);
      }
    }
  }

  return {
    key,
    canvas,
    originX,
    originY,
  };
}
