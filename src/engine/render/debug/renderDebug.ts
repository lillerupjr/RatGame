import type { World } from "../../world/world";
import { worldToScreen } from "../../math/iso";
import { getSweepShadowMap } from "../../../game/map/sweepShadow";
import { getActiveMap as getActiveCompiledMap_ } from "../../../game/map/compile/kenneyMap";
import { getTileHeightMapDebugOverlay } from "../../../game/systems/presentation/debug/tileHeightMapDebugOverlay";
import { KENNEY_TILE_ANCHOR_Y, KENNEY_TILE_WORLD } from "../kenneyTiles";
import { getTileSpriteById } from "../sprites/renderSprites";
import { getEnemyAimDebugInfo, getEnemyAimWorld } from "../../../game/combat/aimPoints";
import { getEnemyWorld } from "../../../game/coords/worldViews";
import { ENEMIES, type EnemyId } from "../../../game/content/enemies";
import { getLootGoblinDebugSnapshot } from "../../../game/systems/neutral/lootGoblin";
import {
  getApronDebugStats,
  getRampFacesForDebug,
  isRoadAreaTile,
  isRoadCenterTile,
  isRoadCrossingTile,
  isRoadStopTile,
  roadIntersectionBoundsDebug,
  roadCrossingDirAt,
  roadIntersectionCentersDebug,
  roadStopDirAt,
  roadIntersectionSeedsDebug,
  isRoadIntersectionTile,
  roadContextAxisAt,
  roadContextIsRoadAt,
  getTile,
  getWalkOutlineLocalPx,
  isHoleTile,
  occluderLayers,
  occludersInViewForLayer,
  overlaysInView,
  pointInQuad,
  rampHeightAt,
  solidFacesInView,
  surfacesAtCell,
  walkInfo,
  type RenderPiece,
  type ViewRect,
} from "../../../game/map/compile/kenneyMap";

export type RenderPieceDrawBounds = {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
};

export type DebugOverlayContext = {
  ctx: CanvasRenderingContext2D;
  w: World;
  ww: number;
  hh: number;
  px: number;
  py: number;
  camX: number;
  camY: number;
  T: number;
  ELEV_PX: number;
  renderAllHeights: boolean;
  maxNonStairSurfaceZ: (tx: number, ty: number) => number | null;
  tileHAtWorld: (x: number, y: number) => number;
  toScreen: (x: number, y: number) => { x: number; y: number };
  toScreenAtZ: (x: number, y: number, zVisual: number) => { x: number; y: number };
};

const WALK_MASK_RADIUS_TILES = 10;
const WALK_MASK_STEP = 1;
const WALK_MASK_THROTTLE_MS = 120;

export function drawWalkMaskOverlay(ctx: DebugOverlayContext, show: boolean) {
  if (!show) return;

  const {
    ctx: c,
    w,
    ww,
    hh,
    px,
    py,
    camX,
    camY,
    T,
    ELEV_PX,
    renderAllHeights,
    maxNonStairSurfaceZ,
    tileHAtWorld,
  } = ctx;

  const wm = w as any;
  if (!wm._walkMaskCache) wm._walkMaskCache = new Map<string, any>();
  if (!wm._walkMaskLastMs) wm._walkMaskLastMs = 0;
  if (!wm._walkMaskImg) wm._walkMaskImg = null;
  if (wm._walkMaskCamX === undefined) wm._walkMaskCamX = NaN;
  if (wm._walkMaskCamY === undefined) wm._walkMaskCamY = NaN;

  const tileLocalPxToScreen = (tx: number, ty: number, lx: number, ly: number) => {
    const wx = (tx + 0.5) * T;
    const wy = (ty + 0.5) * T;

    const sdx = ((lx - 64) / 64) * T;
    const sdy = ((ly - 32) / 32) * (T * 0.5);

    const p = worldToScreen(wx, wy);
    const h = tileHAtWorld(wx, wy);
    const elev = h * ELEV_PX;

    return { x: p.x + camX + sdx, y: p.y + camY + sdy - elev };
  };

  const nowMs = performance.now();
  const lastMs = wm._walkMaskLastMs as number;
  const lastCamX = wm._walkMaskCamX as number;
  const lastCamY = wm._walkMaskCamY as number;
  const camMoved = Math.abs(camX - lastCamX) > 0.01 || Math.abs(camY - lastCamY) > 0.01;

  const shouldRebuild = camMoved || nowMs - lastMs >= WALK_MASK_THROTTLE_MS;

  if (!shouldRebuild && wm._walkMaskImg) {
    c.save();
    c.globalAlpha = 1;
    c.drawImage(wm._walkMaskImg, 0, 0);
    c.restore();
    return;
  }

  wm._walkMaskLastMs = nowMs;
  wm._walkMaskCamX = camX;
  wm._walkMaskCamY = camY;

  const off = document.createElement("canvas");
  off.width = ww;
  off.height = hh;
  const octx = off.getContext("2d");
  if (!octx) return;

  octx.globalAlpha = 0.95;
  octx.lineWidth = 2;

  const pcx = Math.floor(px / T);
  const pcy = Math.floor(py / T);
  const r = WALK_MASK_RADIUS_TILES;

  const activeH = w.activeFloorH ?? 0;

  for (let ty = pcy - r; ty <= pcy + r; ty += WALK_MASK_STEP) {
    for (let tx = pcx - r; tx <= pcx + r; tx += WALK_MASK_STEP) {
      if (isHoleTile(tx, ty)) continue;

      const tdef = getTile(tx, ty);

      if (!renderAllHeights) {
        if (tdef.kind !== "STAIRS") {
          const h0 = maxNonStairSurfaceZ(tx, ty);
          if (h0 === null || h0 !== activeH) continue;
        } else {
          const hs = tdef.h ?? 0;
          if (Math.abs(hs - activeH) > 1) continue;
        }
      }

      const key = `${tx},${ty}`;
      let o = wm._walkMaskCache.get(key);
      if (!o) {
        o = getWalkOutlineLocalPx(tx, ty);
        wm._walkMaskCache.set(key, o);
      }
      if (o.blocked || !o.pts || o.pts.length === 0) continue;

      octx.strokeStyle =
        tdef.kind === "STAIRS"
          ? "rgba(255,220,120,0.95)"
          : o.shape === "TOP_CUT_16"
            ? "rgba(255,140,140,0.95)"
            : "rgba(120,220,255,0.95)";

      octx.beginPath();
      for (let i = 0; i < o.pts.length; i++) {
        const p = o.pts[i];
        const sp = tileLocalPxToScreen(tx, ty, p.x, p.y);
        if (i === 0) octx.moveTo(sp.x, sp.y);
        else octx.lineTo(sp.x, sp.y);
      }
      octx.closePath();
      octx.stroke();
    }
  }

  wm._walkMaskImg = off;
  c.save();
  c.globalAlpha = 1;
  c.drawImage(off, 0, 0);
  c.restore();
}

function triggerColor(id: string): string {
  if (id.startsWith("OBJ_BOSS_ZONE_")) return "rgba(235,95,95,0.95)";
  if (id.startsWith("OBJ_ZONE_")) return "rgba(255,165,64,0.95)";
  if (id === "OBJ_VENDOR") return "rgba(240,210,90,0.95)";
  if (id === "OBJ_HEAL") return "rgba(90,200,200,0.95)";
  if (id === "OBJ_TIMER") return "rgba(110,180,255,0.95)";
  return "rgba(200,200,200,0.85)";
}

export function drawTriggerOverlay(ctx: DebugOverlayContext, show: boolean) {
  if (!show) return;

  const w = ctx.w as any;
  const defs = (w.overlayTriggerDefs ?? []) as Array<{ id: string; tx: number; ty: number }>;
  if (defs.length === 0) return;

  const c = ctx.ctx;
  const T = ctx.T;

  c.save();
  c.globalAlpha = 0.9;
  c.lineWidth = 2;
  c.font = "10px monospace";
  c.textAlign = "center";
  c.textBaseline = "middle";

  for (const def of defs) {
    const cx = (def.tx + 0.5) * T;
    const cy = (def.ty + 0.5) * T;
    const z = ctx.tileHAtWorld(cx, cy);

    const pN = ctx.toScreenAtZ(cx, cy - T * 0.5, z);
    const pE = ctx.toScreenAtZ(cx + T * 0.5, cy, z);
    const pS = ctx.toScreenAtZ(cx, cy + T * 0.5, z);
    const pW = ctx.toScreenAtZ(cx - T * 0.5, cy, z);
    const pC = ctx.toScreenAtZ(cx, cy, z);

    const color = triggerColor(def.id);
    c.strokeStyle = color;
    c.fillStyle = color;

    c.beginPath();
    c.moveTo(pN.x, pN.y);
    c.lineTo(pE.x, pE.y);
    c.lineTo(pS.x, pS.y);
    c.lineTo(pW.x, pW.y);
    c.closePath();
    c.stroke();

    c.beginPath();
    c.arc(pC.x, pC.y, 3, 0, Math.PI * 2);
    c.fill();
  }

  c.restore();
}

function roadDebugTagAt(tx: number, ty: number): string | null {
  const dirToCardinal = (dir: number): "N" | "E" | "S" | "W" | null => {
    if (dir === 1) return "N";
    if (dir === 2) return "E";
    if (dir === 3) return "S";
    if (dir === 4) return "W";
    return null;
  };
  if (!isRoadAreaTile(tx, ty)) return null;
  if (isRoadIntersectionTile(tx, ty)) return "INTERSECT";
  if (isRoadCrossingTile(tx, ty)) {
    const dir = dirToCardinal(roadCrossingDirAt(tx, ty));
    return dir ? `CROSSING:${dir}` : "CROSSING";
  }
  if (isRoadStopTile(tx, ty)) {
    const dir = dirToCardinal(roadStopDirAt(tx, ty));
    return dir ? `STOP_BAR:${dir}` : "STOP_BAR";
  }
  return null;
}

function roadDirTint(dir: number): string {
  if (dir === 1) return "rgba(255,80,80,0.45)"; // N
  if (dir === 2) return "rgba(80,200,255,0.45)"; // E
  if (dir === 3) return "rgba(80,255,120,0.45)"; // S
  if (dir === 4) return "rgba(255,210,80,0.45)"; // W
  return "rgba(255,255,255,0.35)";
}

export function drawRoadSemanticOverlay(ctx: DebugOverlayContext, show: boolean, viewRect: ViewRect) {
  if (!show) return;

  const c = ctx.ctx;
  const T = ctx.T;

  c.save();
  c.globalAlpha = 1;
  c.lineWidth = 1;

  for (let ty = viewRect.minTy; ty <= viewRect.maxTy; ty++) {
    for (let tx = viewRect.minTx; tx <= viewRect.maxTx; tx++) {
      const isArea = isRoadAreaTile(tx, ty);
      const isCenter = isRoadCenterTile(tx, ty);
      const isIntersection = isRoadIntersectionTile(tx, ty);
      if (!isArea && !isCenter && !isIntersection) continue;

      const wx0 = tx * T;
      const wy0 = ty * T;
      const wx1 = (tx + 1) * T;
      const wy1 = (ty + 1) * T;
      const wxc = (tx + 0.5) * T;
      const wyc = (ty + 0.5) * T;
      const z = ctx.tileHAtWorld(wxc, wyc);

      const pNW = ctx.toScreenAtZ(wx0, wy0, z);
      const pNE = ctx.toScreenAtZ(wx1, wy0, z);
      const pSE = ctx.toScreenAtZ(wx1, wy1, z);
      const pSW = ctx.toScreenAtZ(wx0, wy1, z);
      const pC = ctx.toScreenAtZ(wxc, wyc, z);

      if (isArea) {
        c.fillStyle = "rgba(255,140,0,0.25)";
        c.beginPath();
        c.moveTo(pNW.x, pNW.y);
        c.lineTo(pNE.x, pNE.y);
        c.lineTo(pSE.x, pSE.y);
        c.lineTo(pSW.x, pSW.y);
        c.closePath();
        c.fill();
      }

      if (isCenter) {
        const inset = 0.08;
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const cNWx = lerp(pNW.x, pC.x, inset);
        const cNWy = lerp(pNW.y, pC.y, inset);
        const cNEx = lerp(pNE.x, pC.x, inset);
        const cNEy = lerp(pNE.y, pC.y, inset);
        const cSEx = lerp(pSE.x, pC.x, inset);
        const cSEy = lerp(pSE.y, pC.y, inset);
        const cSWx = lerp(pSW.x, pC.x, inset);
        const cSWy = lerp(pSW.y, pC.y, inset);
        c.fillStyle = "rgba(255,255,0,0.9)";
        c.beginPath();
        c.moveTo(cNWx, cNWy);
        c.lineTo(cNEx, cNEy);
        c.lineTo(cSEx, cSEy);
        c.lineTo(cSWx, cSWy);
        c.closePath();
        c.fill();
      }

      if (isIntersection) {
        c.fillStyle = "rgba(0,255,255,0.55)";
        c.beginPath();
        c.moveTo(pNW.x, pNW.y);
        c.lineTo(pNE.x, pNE.y);
        c.lineTo(pSE.x, pSE.y);
        c.lineTo(pSW.x, pSW.y);
        c.closePath();
        c.fill();
      }

      const crossingDir = isRoadCrossingTile(tx, ty) ? roadCrossingDirAt(tx, ty) : 0;
      const stopDir = isRoadStopTile(tx, ty) ? roadStopDirAt(tx, ty) : 0;
      const dir = crossingDir || stopDir;
      if (dir !== 0) {
        const inset = 0.2;
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const qNWx = lerp(pNW.x, pC.x, inset);
        const qNWy = lerp(pNW.y, pC.y, inset);
        const qNEx = lerp(pNE.x, pC.x, inset);
        const qNEy = lerp(pNE.y, pC.y, inset);
        const qSEx = lerp(pSE.x, pC.x, inset);
        const qSEy = lerp(pSE.y, pC.y, inset);
        const qSWx = lerp(pSW.x, pC.x, inset);
        const qSWy = lerp(pSW.y, pC.y, inset);
        c.fillStyle = roadDirTint(dir);
        c.beginPath();
        c.moveTo(qNWx, qNWy);
        c.lineTo(qNEx, qNEy);
        c.lineTo(qSEx, qSEy);
        c.lineTo(qSWx, qSWy);
        c.closePath();
        c.fill();
      }

      const tag = roadDebugTagAt(tx, ty);
      const contextRoad = roadContextIsRoadAt(tx, ty) === 1;
      const axisCode = roadContextAxisAt(tx, ty);
      const axisLabel = axisCode === 1 ? "EW" : axisCode === 2 ? "NS" : "--";
      if (tag) {
        c.save();
        c.font = "9px monospace";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.lineWidth = 2;
        c.strokeStyle = "rgba(0,0,0,0.9)";
        c.fillStyle = "rgba(255,255,255,0.95)";
        c.strokeText(tag, pC.x, pC.y);
        c.fillText(tag, pC.x, pC.y);
        c.restore();
      }
      if (contextRoad) {
        c.save();
        c.font = "8px monospace";
        c.textAlign = "center";
        c.textBaseline = "top";
        c.lineWidth = 2;
        c.strokeStyle = "rgba(0,0,0,0.8)";
        c.fillStyle = "rgba(255,255,255,0.9)";
        c.strokeText(axisLabel, pC.x, pC.y + 7);
        c.fillText(axisLabel, pC.x, pC.y + 7);
        c.restore();
      }
    }
  }

  const seeds = roadIntersectionSeedsDebug();
  if (seeds.length > 0) {
    c.fillStyle = "rgba(255,0,255,0.95)";
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      if (s.tx < viewRect.minTx || s.tx > viewRect.maxTx || s.ty < viewRect.minTy || s.ty > viewRect.maxTy) continue;
      const wx = (s.tx + 0.5) * T;
      const wy = (s.ty + 0.5) * T;
      const z = ctx.tileHAtWorld(wx, wy);
      const pN = ctx.toScreenAtZ(wx, s.ty * T, z);
      const pE = ctx.toScreenAtZ((s.tx + 1) * T, wy, z);
      const pS = ctx.toScreenAtZ(wx, (s.ty + 1) * T, z);
      const pW = ctx.toScreenAtZ(s.tx * T, wy, z);
      const pC = ctx.toScreenAtZ(wx, wy, z);
      const t = 0.7;
      const lerp = (a: number, b: number) => a + (b - a) * t;
      c.beginPath();
      c.moveTo(lerp(pN.x, pC.x), lerp(pN.y, pC.y));
      c.lineTo(lerp(pE.x, pC.x), lerp(pE.y, pC.y));
      c.lineTo(lerp(pS.x, pC.x), lerp(pS.y, pC.y));
      c.lineTo(lerp(pW.x, pC.x), lerp(pW.y, pC.y));
      c.closePath();
      c.fill();
    }
  }

  const centers = roadIntersectionCentersDebug();
  if (centers.length > 0) {
    c.fillStyle = "rgba(255,0,255,0.95)";
    for (let i = 0; i < centers.length; i++) {
      const cc = centers[i];
      if (cc.tx < viewRect.minTx || cc.tx > viewRect.maxTx || cc.ty < viewRect.minTy || cc.ty > viewRect.maxTy) continue;
      const wx = (cc.tx + 0.5) * T;
      const wy = (cc.ty + 0.5) * T;
      const z = ctx.tileHAtWorld(wx, wy);
      const p = ctx.toScreenAtZ(wx, wy, z);
      c.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
  }

  const bounds = roadIntersectionBoundsDebug();
  if (bounds.length > 0) {
    c.strokeStyle = "rgba(255,0,255,0.95)";
    c.lineWidth = 1.5;
    for (let i = 0; i < bounds.length; i++) {
      const b = bounds[i];
      if (b.maxX < viewRect.minTx || b.minX > viewRect.maxTx || b.maxY < viewRect.minTy || b.minY > viewRect.maxTy) continue;
      const wx0 = b.minX * T;
      const wy0 = b.minY * T;
      const wx1 = (b.maxX + 1) * T;
      const wy1 = (b.maxY + 1) * T;
      const cx = (b.minX + b.maxX + 1) * 0.5 * T;
      const cy = (b.minY + b.maxY + 1) * 0.5 * T;
      const z = ctx.tileHAtWorld(cx, cy);
      const pNW = ctx.toScreenAtZ(wx0, wy0, z);
      const pNE = ctx.toScreenAtZ(wx1, wy0, z);
      const pSE = ctx.toScreenAtZ(wx1, wy1, z);
      const pSW = ctx.toScreenAtZ(wx0, wy1, z);
      c.beginPath();
      c.moveTo(pNW.x, pNW.y);
      c.lineTo(pNE.x, pNE.y);
      c.lineTo(pSE.x, pSE.y);
      c.lineTo(pSW.x, pSW.y);
      c.closePath();
      c.stroke();
    }
  }

  c.restore();
}

export function drawApronOwnershipOverlay(
  ctx: DebugOverlayContext,
  show: boolean,
  piece: RenderPiece,
  draw: RenderPieceDrawBounds
) {
  if (!show) return;
  if (piece.kind !== "FLOOR_APRON") return;

  const ownsStair = !!piece.ownerStairId;
  const pad = 3;
  const x = draw.dx - pad;
  const y = draw.dy - pad;
  const w = draw.dw + pad * 2;
  const h = draw.dh + pad * 2;

  const c = ctx.ctx;
  c.save();
  c.globalAlpha = 0.8;
  if (ownsStair) {
    c.strokeStyle = "rgba(255,230,80,0.95)";
    c.lineWidth = 4;
    c.strokeRect(x, y, w, h);
  } else {
    c.fillStyle = "rgba(255,40,40,0.25)";
    c.strokeStyle = "rgba(255,40,40,0.95)";
    c.lineWidth = 4;
    c.fillRect(x, y, w, h);
    c.strokeRect(x, y, w, h);
  }
  c.restore();
}

export function drawApronOwnershipStats(ctx: DebugOverlayContext, show: boolean) {
  if (!show) return;
  const stats = getApronDebugStats();
  if (!stats) return;

  const fmtOffsets = (list: Array<{ offset: string; count: number }>, limit: number) => {
    const slice = list.slice(0, limit);
    return slice.map((item) => `${item.offset}:${item.count}`).join(" ");
  };

  const c = ctx.ctx;
  c.save();
  c.globalAlpha = 0.9;
  c.fillStyle = "rgba(0,0,0,0.6)";
  c.fillRect(10, 10, 420, 140);
  c.fillStyle = "rgba(255,255,255,0.95)";
  c.font = "12px monospace";
  c.textAlign = "left";
  c.textBaseline = "top";
  c.fillText(`apron candidates: ${stats.apronCandidates}`, 16, 16);
  c.fillText(`scan hits: ${stats.apronScanHits}`, 16, 32);
  c.fillText(`owned by stairs: ${stats.apronOwnedByStair}`, 16, 48);
  c.fillText(`any stair hits: ${stats.apronAnyStairHits}`, 16, 64);
  c.fillText(`same-z hits: ${stats.apronSameZHits}`, 16, 80);
  c.fillText(
    `stair deltas: ${fmtOffsets(
      stats.stairDeltaCounts.map((d: { delta: string; count: number }) => ({ offset: d.delta, count: d.count })),
      4
    ) || "-"}`,
    16,
    96
  );
  c.fillText(`E offsets: ${fmtOffsets(stats.offsetCountsE, 4) || "-"}`, 16, 112);
  c.fillText(`S offsets: ${fmtOffsets(stats.offsetCountsS, 4) || "-"}`, 16, 128);
  c.restore();
}

export function drawRampOverlay(ctx: DebugOverlayContext, show: boolean) {
  if (!show) return;
  const { px, py, T, w } = ctx;
  const ramps = getRampFacesForDebug(T);
  if (!ramps || ramps.length === 0) return;

  const c = ctx.ctx;
  c.save();
  c.globalAlpha = 1;
  c.lineWidth = 2;
  c.font = "12px monospace";
  c.textAlign = "left";
  c.textBaseline = "top";

  for (let i = 0; i < ramps.length; i++) {
    const r = ramps[i];
    const poly = r.poly;
    if (!poly || poly.length < 3) continue;

    c.strokeStyle = "rgba(0,255,255,0.95)";
    c.beginPath();
    for (let k = 0; k < poly.length; k++) {
      const wp = poly[k];
      const sp = ctx.toScreen(wp.x, wp.y);
      if (k === 0) c.moveTo(sp.x, sp.y);
      else c.lineTo(sp.x, sp.y);
    }
    c.closePath();
    c.stroke();

    for (let k = 0; k < poly.length; k++) {
      const wp = poly[k];
      const sp = ctx.toScreen(wp.x, wp.y);
      const z = rampHeightAt(r, { x: wp.x, y: wp.y });

      c.fillStyle = "rgba(0,255,255,0.95)";
      c.beginPath();
      c.arc(sp.x, sp.y, 3, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = "rgba(0,255,255,0.85)";
      c.fillText(`r${i} v${k} z=${z.toFixed(2)}`, sp.x + 6, sp.y + 6);
    }
  }

  let insideAny = false;
  let which = -1;
  for (let i = 0; i < ramps.length; i++) {
    const r = ramps[i];
    if (pointInQuad({ x: px, y: py }, r.poly)) {
      insideAny = true;
      which = i;
      break;
    }
  }

  const pp = ctx.toScreen(px, py);
  c.fillStyle = insideAny ? "rgba(0,255,255,0.95)" : "rgba(255,80,80,0.95)";
  c.beginPath();
  c.arc(pp.x, pp.y, 6, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = insideAny ? "rgba(0,255,255,0.95)" : "rgba(255,80,80,0.95)";
  c.fillText(
    insideAny ? `player in ramp: YES (r${which})` : "player in ramp: NO",
    pp.x + 10,
    pp.y - 18
  );

  const hz = ctx.tileHAtWorld(px, py);
  c.fillText(`heightAtWorld(p): ${hz.toFixed(3)}`, pp.x + 10, pp.y - 4);
  const pInfo = walkInfo(px, py, T, Number.isFinite((w as any).pzVisual) ? (w as any).pzVisual : (w as any).pz);
  c.fillText(
    `walkInfo z=${pInfo.z.toFixed(3)} floor=${pInfo.floorH} isRamp=${pInfo.isRamp ? 1 : 0}`,
    pp.x + 10,
    pp.y + 10,
  );
  const ptx = Math.floor(px / T);
  const pty = Math.floor(py / T);
  const stack = surfacesAtCell(ptx, pty);
  const zs = stack.map((s) => `${s.zBase}`).join(",");
  c.fillText(`stack@${ptx},${pty}: n=${stack.length} z=[${zs}]`, pp.x + 10, pp.y + 24);

  c.restore();
}

export function drawOccluderOverlay(ctx: DebugOverlayContext, show: boolean, viewRect: ViewRect) {
  if (!show) return;
  const c = ctx.ctx;
  const { T } = ctx;

  c.save();
  c.globalAlpha = 0.9;
  c.lineWidth = 2;
  c.font = "10px monospace";
  c.textAlign = "left";
  c.textBaseline = "middle";

  const layers = occluderLayers();
  c.strokeStyle = "rgba(255,120,120,0.95)";
  c.fillStyle = "rgba(255,120,120,0.95)";
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    const list = occludersInViewForLayer(layer, viewRect);
    for (let i = 0; i < list.length; i++) {
      const cull = list[i];
      const wx = (cull.tx + 0.5) * T;
      const wy = (cull.ty + 0.5) * T;
      const p0 = ctx.toScreenAtZ(wx, wy, cull.zFrom);
      const p1 = ctx.toScreenAtZ(wx, wy, cull.zTo);
      c.beginPath();
      c.moveTo(p0.x, p0.y);
      c.lineTo(p1.x, p1.y);
      c.stroke();
      c.fillText(cull.id, p1.x + 6, p1.y - 6);
    }
  }

  c.restore();
}

export function drawStructureHeightOverlay(ctx: DebugOverlayContext, show: boolean, viewRect: ViewRect) {
  if (!show) return;
  const c = ctx.ctx;
  const { T } = ctx;

  c.save();
  c.globalAlpha = 0.9;
  c.lineWidth = 1.5;
  c.font = "10px monospace";
  c.textAlign = "left";
  c.textBaseline = "middle";

  const layers = occluderLayers();
  c.fillStyle = "rgba(140,220,140,0.95)";
  c.strokeStyle = "rgba(140,220,140,0.95)";
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    const list = occludersInViewForLayer(layer, viewRect);
    for (let i = 0; i < list.length; i++) {
      const piece = list[i];
      if (piece.kind !== "WALL") continue;

      const rec = piece.spriteId ? getTileSpriteById(piece.spriteId) : null;
      if (!rec?.ready || !rec.img || rec.img.width <= 0 || rec.img.height <= 0) continue;

      const wallDir = piece.wallDir ?? "N";
      const wallDelta = (() => {
        switch (wallDir) {
          case "N": return { dx: 0, dy: -1 };
          case "E": return { dx: 1, dy: 0 };
          case "S": return { dx: 0, dy: 1 };
          case "W": return { dx: -1, dy: 0 };
        }
      })();

      let wx = (piece.tx + 0.5) * T;
      let wy = (piece.ty + 0.5) * T;
      wx += wallDelta.dx * T * 0.5;
      wy += wallDelta.dy * T * 0.5;

      const midZ = (piece.zFrom + piece.zTo) * 0.5;
      const p = ctx.toScreenAtZ(wx, wy, midZ);
      const anchorY = piece.renderAnchorY ?? KENNEY_TILE_ANCHOR_Y;
      const dy = piece.renderDyOffset ?? 0;

      const aw = rec.img.width;
      const ah = rec.img.height;
      const dx = p.x - aw * 0.5;
      const dyDraw = p.y - ah * anchorY - dy;

      c.strokeRect(dx, dyDraw, aw, ah);
      const ax = dx + aw * 0.5;
      const ay = dyDraw + ah * anchorY;
      c.beginPath();
      c.arc(ax, ay, 2, 0, Math.PI * 2);
      c.fill();
      c.fillText(`wall z=${piece.zFrom}->${piece.zTo} mid=${midZ} dy=${dy}`, dx + 6, dyDraw - 8);
    }
  }

  const overlays = overlaysInView(viewRect);
  c.fillStyle = "rgba(140,200,255,0.95)";
  c.strokeStyle = "rgba(140,200,255,0.95)";
  for (let i = 0; i < overlays.length; i++) {
    const o = overlays[i];
    const rec = o.spriteId ? getTileSpriteById(o.spriteId) : null;
    if (!rec?.ready || !rec.img || rec.img.width <= 0 || rec.img.height <= 0) continue;
    const wx = (o.tx + o.w * 0.5) * T;
    const wy = (o.ty + o.h * 0.5) * T;
    const p = ctx.toScreenAtZ(wx, wy, o.z);
    const dy = o.drawDyOffset ?? 0;
    const ow = rec.img.width;
    const oh = rec.img.height;
    const dx = p.x - ow * 0.5;
    const dyDraw = p.y - oh * KENNEY_TILE_ANCHOR_Y - dy;

    c.strokeRect(dx, dyDraw, ow, oh);
    const ax = dx + ow * 0.5;
    const ay = dyDraw + oh * KENNEY_TILE_ANCHOR_Y;
    c.beginPath();
    c.arc(ax, ay, 2, 0, Math.PI * 2);
    c.fill();
    c.fillText(`roof z=${o.z} dy=${dy}`, dx + 6, dyDraw - 8);
  }

  c.restore();
}

export function drawSweepShadowDebugOverlay(ctx: DebugOverlayContext, show: boolean, viewRect: ViewRect) {
  if (!show) return;
  const shadowMap = getSweepShadowMap();
  if (!shadowMap) return;
  const c = ctx.ctx;
  const { T } = ctx;

  c.save();
  c.globalAlpha = 0.95;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = "10px monospace";

  for (let ty = viewRect.minTy; ty <= viewRect.maxTy; ty++) {
    for (let tx = viewRect.minTx; tx <= viewRect.maxTx; tx++) {
      const gx = tx - shadowMap.originTx;
      const gy = ty - shadowMap.originTy;
      if (gx < 0 || gy < 0 || gx >= shadowMap.width || gy >= shadowMap.height) continue;
      const intensity = shadowMap.data[gy * shadowMap.width + gx] ?? 0;
      if (intensity <= 0) continue;
      const wx = (tx + 0.5) * T;
      const wy = (ty + 0.5) * T;
      const z = ctx.tileHAtWorld(wx, wy);
      const p = ctx.toScreenAtZ(wx, wy, z);
      c.fillStyle = intensity >= 0.75 ? "rgba(255,110,110,0.95)" : intensity >= 0.4 ? "rgba(255,205,120,0.95)" : "rgba(140,220,255,0.95)";
      c.fillText(intensity.toFixed(2), p.x, p.y - 6);
    }
  }

  c.restore();
}

export function drawTileHeightMapOverlay(ctx: DebugOverlayContext, show: boolean, _viewRect: ViewRect) {
  if (!show) return;
  const compiledMap = getActiveCompiledMap_();
  const overlay = compiledMap ? getTileHeightMapDebugOverlay(compiledMap, ctx.ELEV_PX) : null;
  if (!overlay) return;
  const c = ctx.ctx;

  c.save();
  c.globalAlpha = 1;
  c.drawImage(overlay.canvas, overlay.originX, overlay.originY);
  c.restore();
}

function faceEndpoints(tx: number, ty: number, dir: "N" | "E" | "S" | "W", T: number) {
  const x0 = tx * T;
  const y0 = ty * T;
  const x1 = (tx + 1) * T;
  const y1 = (ty + 1) * T;

  switch (dir) {
    case "N":
      return { ax: x0, ay: y0, bx: x1, by: y0 };
    case "S":
      return { ax: x0, ay: y1, bx: x1, by: y1 };
    case "W":
      return { ax: x0, ay: y0, bx: x0, by: y1 };
    case "E":
    default:
      return { ax: x1, ay: y0, bx: x1, by: y1 };
  }
}

export function drawEnemyAimOverlay(ctx: DebugOverlayContext, show: boolean) {
  if (!show) return;

  const c = ctx.ctx;
  const margin = 96;
  const isNearScreen = (x: number, y: number) => (
    x >= -margin
    && x <= ctx.ww + margin
    && y >= -margin
    && y <= ctx.hh + margin
  );

  c.save();
  c.globalAlpha = 1;
  c.lineWidth = 1.5;
  c.font = "10px monospace";
  c.textAlign = "left";
  c.textBaseline = "top";

  for (let enemyIndex = 0; enemyIndex < ctx.w.eAlive.length; enemyIndex++) {
    if (!ctx.w.eAlive[enemyIndex]) continue;

    const anchorWorld = getEnemyWorld(ctx.w, enemyIndex, KENNEY_TILE_WORLD);
    const aimWorld = getEnemyAimWorld(ctx.w, enemyIndex);
    const enemyZ = ctx.w.ezVisual?.[enemyIndex] ?? ctx.tileHAtWorld(anchorWorld.wx, anchorWorld.wy);
    const anchorScreen = ctx.toScreenAtZ(anchorWorld.wx, anchorWorld.wy, enemyZ);
    const aimScreen = ctx.toScreenAtZ(aimWorld.x, aimWorld.y, enemyZ);
    if (!isNearScreen(anchorScreen.x, anchorScreen.y) && !isNearScreen(aimScreen.x, aimScreen.y)) continue;

    c.strokeStyle = "rgba(255, 220, 120, 0.95)";
    c.beginPath();
    c.moveTo(anchorScreen.x, anchorScreen.y);
    c.lineTo(aimScreen.x, aimScreen.y);
    c.stroke();

    c.fillStyle = "rgba(255, 110, 110, 0.95)";
    c.beginPath();
    c.arc(anchorScreen.x, anchorScreen.y, 3, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = "rgba(80, 235, 255, 0.95)";
    c.beginPath();
    c.arc(aimScreen.x, aimScreen.y, 3, 0, Math.PI * 2);
    c.fill();

    const enemyType = ctx.w.eType[enemyIndex] as EnemyId;
    const enemyName = ENEMIES[enemyType]?.name ?? `Enemy ${enemyType}`;
    const info = getEnemyAimDebugInfo(ctx.w, enemyIndex);
    const line1 = `${enemyName} t:${enemyType} skin:${info.skin ?? "unknown"}`;
    const line2 = `screen=(${info.effectiveScreenOffset.x},${info.effectiveScreenOffset.y}) base=(${info.baseScreenOffset.x},${info.baseScreenOffset.y}) skin=(${info.skinScreenOffset.x},${info.skinScreenOffset.y})`;
    const line3 = `worldD=(${info.effectiveWorldDelta.dx.toFixed(1)},${info.effectiveWorldDelta.dy.toFixed(1)}) h*scale=${info.spriteFrameHeightPx}*${info.spriteScale.toFixed(2)}=${info.spriteHeightWorld.toFixed(1)}`;
    const lines = [line1, line2, line3];
    const lineHeight = 12;
    const padX = 5;
    const padY = 4;
    let boxWidth = 0;
    for (let i = 0; i < lines.length; i++) {
      boxWidth = Math.max(boxWidth, c.measureText(lines[i]).width);
    }
    const boxHeight = padY * 2 + lines.length * lineHeight;
    const rawX = aimScreen.x + 10;
    const rawY = aimScreen.y - boxHeight - 8;
    const boxX = Math.min(Math.max(6, rawX), Math.max(6, ctx.ww - boxWidth - padX * 2 - 6));
    const boxY = Math.min(Math.max(6, rawY), Math.max(6, ctx.hh - boxHeight - 6));

    c.fillStyle = "rgba(0, 0, 0, 0.72)";
    c.fillRect(boxX, boxY, boxWidth + padX * 2, boxHeight);
    c.strokeStyle = "rgba(220, 245, 255, 0.28)";
    c.strokeRect(boxX + 0.5, boxY + 0.5, boxWidth + padX * 2 - 1, boxHeight - 1);
    c.fillStyle = "rgba(220, 245, 255, 0.95)";
    for (let i = 0; i < lines.length; i++) {
      c.fillText(lines[i], boxX + padX, boxY + padY + i * lineHeight);
    }
  }

  c.restore();
}

export function drawLootGoblinOverlay(ctx: DebugOverlayContext, show: boolean) {
  if (!show) return;

  const snap = getLootGoblinDebugSnapshot(ctx.w);
  const c = ctx.ctx;
  const lines = [
    "[Loot Goblin]",
    `floor=${snap.floorIndex} chance=1/${snap.spawnChanceDenominator}`,
    `rolled=${snap.spawnRolled ? "yes" : "no"} roll=${snap.rollValue ?? "-"} pass=${snap.chancePassed ? "yes" : "no"}`,
    `spawned=${snap.spawned ? "yes" : "no"} alive=${snap.alive ? "yes" : "no"} idx=${snap.enemyIndex ?? "-"}`,
    `tile=${snap.spawnTx ?? "-"},${snap.spawnTy ?? "-"}`,
    `queuedDrops=${snap.queuedGoldDrops}`,
  ];
  if (snap.failureReason) lines.push(`reason=${snap.failureReason}`);

  c.save();
  c.globalAlpha = 1;
  c.font = "11px monospace";
  c.textAlign = "left";
  c.textBaseline = "top";

  const lineH = 12;
  const padX = 6;
  const padY = 6;
  let maxW = 0;
  for (let i = 0; i < lines.length; i++) {
    maxW = Math.max(maxW, c.measureText(lines[i]).width);
  }
  const boxW = Math.ceil(maxW + padX * 2);
  const boxH = Math.ceil(lines.length * lineH + padY * 2);
  const boxX = 10;
  const boxY = 10;

  c.fillStyle = "rgba(0,0,0,0.72)";
  c.fillRect(boxX, boxY, boxW, boxH);
  c.strokeStyle = "rgba(255,220,120,0.65)";
  c.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);

  c.fillStyle = "rgba(255,240,200,0.98)";
  for (let i = 0; i < lines.length; i++) {
    c.fillText(lines[i], boxX + padX, boxY + padY + i * lineH);
  }

  if (snap.spawnWx !== null && snap.spawnWy !== null) {
    const p = ctx.toScreen(snap.spawnWx, snap.spawnWy);
    c.strokeStyle = snap.alive ? "rgba(100,255,140,0.95)" : "rgba(255,120,120,0.95)";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(p.x, p.y, 10, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(p.x - 8, p.y);
    c.lineTo(p.x + 8, p.y);
    c.moveTo(p.x, p.y - 8);
    c.lineTo(p.x, p.y + 8);
    c.stroke();
  }

  c.restore();
}

export function drawProjectileFaceOverlay(ctx: DebugOverlayContext, show: boolean, viewRect: ViewRect) {
  if (!show) return;

  const faces = solidFacesInView(viewRect);
  if (faces.length === 0) return;

  const c = ctx.ctx;
  const { T } = ctx;

  c.save();
  c.globalAlpha = 0.9;
  c.strokeStyle = "rgba(255,60,200,0.95)";
  c.lineWidth = 2;

  for (let i = 0; i < faces.length; i++) {
    const f = faces[i];
    const seg = faceEndpoints(f.tx, f.ty, f.dir, T);
    const p0 = ctx.toScreenAtZ(seg.ax, seg.ay, f.zLogical);
    const p1 = ctx.toScreenAtZ(seg.bx, seg.by, f.zLogical);
    c.beginPath();
    c.moveTo(p0.x, p0.y);
    c.lineTo(p1.x, p1.y);
    c.stroke();
  }

  c.restore();
}
