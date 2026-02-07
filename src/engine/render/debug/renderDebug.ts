import type { World } from "../../world/world";
import { worldToScreen } from "../../math/iso";
import {
  getApronDebugStats,
  getRampFacesForDebug,
  getTile,
  getWalkOutlineLocalPx,
  isHoleTile,
  occluderLayers,
  occludersInViewForLayer,
  pointInQuad,
  rampHeightAt,
  solidFacesInView,
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
  const { px, py, T } = ctx;
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
