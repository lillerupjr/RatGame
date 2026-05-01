import type { RenderPiece, StampOverlay } from "../../../map/compile/kenneyMap";
import {
  buildRuntimeStructureProjectedDraw,
  type RuntimeStructureAnchorPlacementDebug,
} from "../../../structures/monolithicStructureGeometry";

export type StructureRenderPieceDraw = {
  img: HTMLImageElement;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  zVisual?: number;
  flipX?: boolean;
  scale?: number;
  anchorPlacementDebugNoCamera?: RuntimeStructureAnchorPlacementDebug;
};

type SpriteRecord = {
  ready: boolean;
  img?: HTMLImageElement | null;
};

type StructureDrawBuilderInput = {
  anchorY: number;
  tileWorld: number;
  elevPx: number;
  camX: number;
  camY: number;
  floorApronScale: number;
  stairApronScale: number;
  wallApronScale: number;
  worldToScreen: (x: number, y: number) => { x: number; y: number };
  surfacesAtXYCached: (tx: number, ty: number) => Array<{
    zBase: number;
    tile: { kind: string };
  }>;
  getTileSpriteById: (spriteId: string) => SpriteRecord;
  logStructureAnchorDebug: boolean;
  loggedStructureAnchorDebugIds: Set<string>;
};

const dirToDelta = (dir: "N" | "E" | "S" | "W") => {
  switch (dir) {
    case "N": return { dx: 0, dy: -1 };
    case "E": return { dx: 1, dy: 0 };
    case "S": return { dx: 0, dy: 1 };
    case "W": return { dx: -1, dy: 0 };
  }
};

export function createStructureDrawBuilders(input: StructureDrawBuilderInput) {
  const {
    anchorY: defaultAnchorY,
    tileWorld,
    elevPx,
    camX,
    camY,
    floorApronScale,
    stairApronScale,
    wallApronScale,
    worldToScreen,
    surfacesAtXYCached,
    getTileSpriteById,
    logStructureAnchorDebug,
    loggedStructureAnchorDebugIds,
  } = input;

  const buildMultiZFaceDraw = (
    c: RenderPiece,
    apronImg: HTMLImageElement,
    flipX: boolean,
  ): StructureRenderPieceDraw[] => {
    const scale = c.scale ?? 1;
    const anchorY = c.renderAnchorY ?? defaultAnchorY;
    const ow = apronImg.width;
    const oh = apronImg.height;

    const wx = (c.tx + 0.5) * tileWorld;
    const wy = (c.ty + 0.5) * tileWorld;
    const edgeDir = c.edgeDir ?? c.renderDir ?? "N";
    const delta = dirToDelta(edgeDir);
    const apronWx = wx + delta.dx * tileWorld * 0.5;
    const apronWy = wy + delta.dy * tileWorld * 0.5;

    const p = worldToScreen(apronWx, apronWy);
    const zVisual = Math.floor(c.zTo) - 1;
    const dx = p.x + camX - ow * scale * 0.5;
    const dy = p.y + camY - oh * scale * anchorY - zVisual * elevPx;

    return [{
      img: apronImg,
      dx,
      dy,
      dw: ow,
      dh: oh,
      zVisual,
      flipX,
      scale,
    }];
  };

  const buildFaceDraws = (c: RenderPiece): StructureRenderPieceDraw[] => {
    const dir4 = c.renderDir ?? "N";
    const apronRec = c.spriteId ? getTileSpriteById(c.spriteId) : null;
    const apronFlipX = !!c.flipX;
    if (!apronRec?.ready || !apronRec.img || apronRec.img.width <= 0 || apronRec.img.height <= 0) return [];

    if (c.zSpan && c.zSpan > 1) {
      return buildMultiZFaceDraw(c, apronRec.img, apronFlipX);
    }

    const anchorY = c.renderAnchorY ?? defaultAnchorY;
    const apronScale = c.kind === "FLOOR_APRON" ? floorApronScale : stairApronScale;
    const aw = apronRec.img.width * apronScale;
    const ah = apronRec.img.height * apronScale;
    const scale = c.scale ?? 1;

    const wx = (c.tx + 0.5) * tileWorld;
    const wy = (c.ty + 0.5) * tileWorld;
    const edgeDirForApron = c.edgeDir ?? dir4;
    const apronDelta = dirToDelta(edgeDirForApron);
    const apronWx = wx + apronDelta.dx * tileWorld * 0.5;
    const apronWy = wy + apronDelta.dy * tileWorld * 0.5;

    const p = worldToScreen(apronWx, apronWy);
    const ax = p.x + camX - aw * scale * 0.5;
    const ayBase = p.y + camY - ah * scale * anchorY;

    const zTop = Math.floor(c.zTo);
    const zBottom = Math.floor(c.zFrom ?? c.zTo);
    const zStart = Math.min(zTop, zBottom);
    const zEnd = Math.max(zTop, zBottom);

    const draws: StructureRenderPieceDraw[] = [];

    const edgeDir = c.edgeDir;
    const neighborBlocksAtZ = (z: number) => {
      if (!edgeDir) return false;
      let dx = 0;
      let dy = 0;
      if (edgeDir === "N") dy = -1;
      else if (edgeDir === "S") dy = 1;
      else if (edgeDir === "E") dx = 1;
      else if (edgeDir === "W") dx = -1;
      const nTx = c.tx + dx;
      const nTy = c.ty + dy;
      const surfaces = surfacesAtXYCached(nTx, nTy);
      if (surfaces.length === 0) return false;
      let maxZ = surfaces[0].zBase;
      for (let i = 1; i < surfaces.length; i++) {
        const zBase = surfaces[i].zBase;
        if (zBase > maxZ) maxZ = zBase;
      }
      return maxZ >= z;
    };

    for (let z = zEnd; z >= zStart; z -= 2) {
      if (neighborBlocksAtZ(z)) continue;
      const zVisual = z - 1;
      draws.push({
        img: apronRec.img,
        dx: ax,
        dy: ayBase - zVisual * elevPx,
        dw: aw,
        dh: ah,
        zVisual,
        flipX: apronFlipX,
        scale,
      });
    }

    return draws;
  };

  const buildWallDraw = (c: RenderPiece): StructureRenderPieceDraw | null => {
    if (c.kind !== "WALL") return null;
    const wallDir = c.wallDir ?? "N";
    const apronRec = c.spriteId ? getTileSpriteById(c.spriteId) : null;
    const apronFlipX = !!c.flipX;
    if (!apronRec?.ready || !apronRec.img || apronRec.img.width <= 0 || apronRec.img.height <= 0) return null;

    let wx = (c.tx + 0.5) * tileWorld;
    let wy = (c.ty + 0.5) * tileWorld;
    const wallDelta = dirToDelta(wallDir);
    wx += wallDelta.dx * tileWorld * 0.5;
    wy += wallDelta.dy * tileWorld * 0.5;

    const p = worldToScreen(wx, wy);
    const anchorY = c.renderAnchorY ?? defaultAnchorY;

    const h = ((c.zFrom ?? c.zTo) + c.zTo) * 0.5;
    const dyOffset = c.renderDyOffset ?? 0;
    const scale = c.scale ?? 1;

    const useNative = !!(c.zSpan && c.zSpan > 1);
    const aw = useNative ? apronRec.img.width : apronRec.img.width * wallApronScale;
    const ah = useNative ? apronRec.img.height : apronRec.img.height * wallApronScale;
    const ax = p.x + camX - aw * scale * 0.5;
    const ay = p.y + camY - ah * scale * anchorY - h * elevPx - dyOffset;

    return {
      img: apronRec.img,
      dx: ax,
      dy: ay,
      dw: aw,
      dh: ah,
      flipX: apronFlipX,
      scale,
    };
  };

  const buildOverlayDraw = (o: StampOverlay): StructureRenderPieceDraw | null => {
    const rec = o.spriteId ? getTileSpriteById(o.spriteId) : null;
    if (!rec?.ready || !rec.img || rec.img.width <= 0 || rec.img.height <= 0) return null;
    const projectedNoCamera = buildRuntimeStructureProjectedDraw(o, rec.img);
    const footprintW = Math.max(1, o.w | 0);
    const isFootprintOverlay =
      o.layerRole === "STRUCTURE" || ((o.kind ?? "ROOF") === "PROP" && (footprintW > 1 || (o.h | 0) > 1));
    const dx = projectedNoCamera.dx + camX;
    const dy = projectedNoCamera.dy + camY;
    if (logStructureAnchorDebug && isFootprintOverlay && !loggedStructureAnchorDebugIds.has(o.id)) {
      loggedStructureAnchorDebugIds.add(o.id);
      console.log("[structure-anchor-debug]", {
        id: o.id,
        tileW: footprintW,
        mode: projectedNoCamera.anchorPlacementDebugNoCamera?.mode ?? "n/a",
        alignmentDelta: projectedNoCamera.anchorPlacementDebugNoCamera?.alignmentDeltaPx ?? null,
        screenX: dx,
      });
    }
    return {
      img: rec.img,
      dx,
      dy,
      dw: projectedNoCamera.dw,
      dh: projectedNoCamera.dh,
      flipX: projectedNoCamera.flipX,
      scale: projectedNoCamera.scale,
      anchorPlacementDebugNoCamera: projectedNoCamera.anchorPlacementDebugNoCamera,
    };
  };

  return {
    buildFaceDraws,
    buildWallDraw,
    buildOverlayDraw,
  };
}
