import {
  overlaysInView,
  getActiveMap as getActiveCompiledMap,
  type StampOverlay,
  type ViewRect,
} from "../../../map/compile/kenneyMap";
import { KENNEY_TILE_WORLD } from "../../../../engine/render/kenneyTiles";
import { worldToScreen, ISO_X, ISO_Y } from "../../../../engine/math/iso";
import { getTileSpriteById, type LoadedImg } from "../../../../engine/render/sprites/renderSprites";
import { buildRuntimeStructureBandPieces } from "../../../../engine/render/sprites/runtimeStructureSlicing";
import { getUserSettings } from "../../../../userSettings";
import {
  buildRuntimeStructureTriangleCache,
  buildRuntimeStructureTriangleContextKey,
  buildRuntimeStructureTriangleGeometrySignature,
  buildRuntimeStructureTrianglePiecesForBand,
  resolveRuntimeStructureBandProgressionIndex,
  type RuntimeStructureTriangleRect,
  type RuntimeStructureTriangleCacheStore,
} from "../runtimeStructureTriangles";
import { getStructureSliceDebugAlphaMap } from "./structureTriangleAlphaReadback";
import {
  type RuntimeStructureTriangleAssetState,
  type RuntimeStructureTriangleBuildResult,
  type RuntimeStructureTriangleProjectedDraw,
} from "./structureTriangleTypes";

export type StructureTriangleCacheRebuildDeps = {
  cacheStore: RuntimeStructureTriangleCacheStore;
  getFlippedOverlayImage: (img: HTMLImageElement) => HTMLCanvasElement;
};

let lastStructureTriangleLoadingFailureKey = "";
let lastStructureTriangleLoadingPendingLogAtMs = 0;
let lastStructureTriangleLoadingPendingSignature = "";

export function classifyRuntimeStructureTriangleAsset(
  rec: LoadedImg | null | undefined,
): RuntimeStructureTriangleAssetState {
  if (!rec) return "FAILED";
  if (rec.ready && rec.img && rec.img.naturalWidth > 0 && rec.img.naturalHeight > 0) return "READY";
  if (rec.failed || rec.unsupported) return "FAILED";
  if (rec.ready) return "FAILED";
  return "PENDING";
}

export function mapWideOverlayViewRect(
  compiledMap: ReturnType<typeof getActiveCompiledMap>,
): ViewRect {
  const minTx = compiledMap.originTx;
  const minTy = compiledMap.originTy;
  const maxTx = minTx + Math.max(1, compiledMap.width) - 1;
  const maxTy = minTy + Math.max(1, compiledMap.height) - 1;
  return { minTx, maxTx, minTy, maxTy };
}

export function collectMapWideStructureOverlays(
  compiledMap: ReturnType<typeof getActiveCompiledMap>,
): StampOverlay[] {
  const allOverlays = overlaysInView(mapWideOverlayViewRect(compiledMap));
  const out: StampOverlay[] = [];
  for (let i = 0; i < allOverlays.length; i++) {
    const overlay = allOverlays[i];
    if (overlay.layerRole !== "STRUCTURE") continue;
    out.push(overlay);
  }
  return out;
}

export function buildRuntimeStructureProjectedDraw(
  overlay: StampOverlay,
  image: HTMLImageElement,
): RuntimeStructureTriangleProjectedDraw {
  const tileWorld = KENNEY_TILE_WORLD;
  const elevPx = 16;
  const scale = overlay.scale ?? 1;
  const spriteW = image.width;
  const spriteH = image.height;
  const southY = overlay.ty + overlay.h - 1;
  const anchorTx = overlay.anchorTx ?? (overlay.w >= overlay.h ? (overlay.tx + overlay.w - 1) : overlay.tx);
  const anchorTy = overlay.anchorTy ?? southY;
  const footprintW = Math.max(1, overlay.w | 0);
  const isFootprintOverlay =
    overlay.layerRole === "STRUCTURE" || ((overlay.kind ?? "ROOF") === "PROP" && (footprintW > 1 || (overlay.h | 0) > 1));
  const tileWidth = 2 * tileWorld * ISO_X;
  const halfTileW = tileWidth * 0.5;
  const footprintAnchorAdjustX = isFootprintOverlay
    ? ((overlay.h - overlay.w) * halfTileW) * 0.5
    : 0;
  const wx = (anchorTx + 0.5) * tileWorld;
  const wy = (anchorTy + 0.5) * tileWorld;
  const projected = worldToScreen(wx, wy);
  const zVisual = overlay.z + (overlay.zVisualOffsetUnits ?? 0);
  return {
    dx: projected.x - spriteW * scale * 0.5 + (overlay.drawDxOffset ?? 0) + footprintAnchorAdjustX,
    dy: projected.y - spriteH * scale - zVisual * elevPx - (overlay.drawDyOffset ?? 0),
    dw: spriteW,
    dh: spriteH,
    flipX: !!overlay.flipX,
    scale,
  };
}

export function runtimeStructureTriangleGeometrySignatureForOverlay(
  overlay: StampOverlay,
  draw: RuntimeStructureTriangleProjectedDraw,
): string {
  return buildRuntimeStructureTriangleGeometrySignature({
    structureInstanceId: overlay.id,
    spriteId: overlay.spriteId,
    seTx: overlay.seTx,
    seTy: overlay.seTy,
    footprintW: overlay.w,
    footprintH: overlay.h,
    flipX: draw.flipX,
    scale: draw.scale,
    baseDx: draw.dx,
    baseDy: draw.dy,
    spriteWidth: draw.dw,
    spriteHeight: draw.dh,
    sliceOffsetX: overlay.sliceOffsetPx?.x ?? 0,
    sliceOffsetY: overlay.sliceOffsetPx?.y ?? 0,
    sliceOriginX: overlay.sliceOriginPx?.x,
    baseZ: overlay.z,
  });
}

export function toRuntimeStructureTriangleRect(
  rect: { x: number; y: number; w: number; h: number },
): RuntimeStructureTriangleRect {
  return {
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
  };
}

export function buildRuntimeStructureTriangleCacheForOverlay(
  overlay: StampOverlay,
  image: HTMLImageElement,
  deps: StructureTriangleCacheRebuildDeps,
): { cache: ReturnType<typeof buildRuntimeStructureTriangleCache> | null; geometrySignature: string } {
  const draw = buildRuntimeStructureProjectedDraw(overlay, image);
  const geometrySignature = runtimeStructureTriangleGeometrySignatureForOverlay(overlay, draw);
  const bandPieces = buildRuntimeStructureBandPieces({
    structureInstanceId: overlay.id,
    spriteId: overlay.spriteId,
    seTx: overlay.seTx,
    seTy: overlay.seTy,
    footprintW: overlay.w,
    footprintH: overlay.h,
    flipped: draw.flipX,
    sliceOffsetX: overlay.sliceOffsetPx?.x ?? 0,
    sliceOffsetY: overlay.sliceOffsetPx?.y ?? 0,
    sliceOriginX: overlay.sliceOriginPx?.x,
    baseZ: overlay.z,
    baseDx: draw.dx,
    baseDy: draw.dy,
    spriteWidth: draw.dw,
    spriteHeight: draw.dh,
    scale: draw.scale,
  });
  const sourceImage: CanvasImageSource = draw.flipX ? deps.getFlippedOverlayImage(image) : image;
  const alphaMap = getStructureSliceDebugAlphaMap(sourceImage) as any;
  const pieces = [] as ReturnType<typeof buildRuntimeStructureTriangleCache>["triangles"];
  for (let i = 0; i < bandPieces.length; i++) {
    const band = bandPieces[i];
    const progressionIndex = resolveRuntimeStructureBandProgressionIndex(band.index, overlay.w, overlay.h);
    const parentTx = band.renderKey.within;
    const parentTy = band.renderKey.slice - band.renderKey.within;
    const built = buildRuntimeStructureTrianglePiecesForBand({
      structureInstanceId: overlay.id,
      bandIndex: band.index,
      progressionIndex,
      parentTx,
      parentTy,
      srcRect: toRuntimeStructureTriangleRect(band.srcRect),
      dstRect: toRuntimeStructureTriangleRect(band.dstRect),
      tileWorld: KENNEY_TILE_WORLD,
      alphaMap,
    });
    if (built.pieces.length > 0) pieces.push(...built.pieces);
  }
  if (pieces.length <= 0) {
    return { cache: null, geometrySignature };
  }
  return {
    cache: buildRuntimeStructureTriangleCache(overlay.id, overlay.spriteId, geometrySignature, pieces),
    geometrySignature,
  };
}

export function rebuildRuntimeStructureTriangleCacheForMap(
  compiledMap: ReturnType<typeof getActiveCompiledMap>,
  deps: StructureTriangleCacheRebuildDeps,
): RuntimeStructureTriangleBuildResult {
  const overlays = collectMapWideStructureOverlays(compiledMap);
  let pendingCount = 0;
  let failedCount = 0;
  let builtCount = 0;
  let fallbackCount = 0;
  const pendingKeys: string[] = [];
  for (let i = 0; i < overlays.length; i++) {
    const overlay = overlays[i];
    const rec = overlay.spriteId ? getTileSpriteById(overlay.spriteId) : null;
    const state = classifyRuntimeStructureTriangleAsset(rec);
    if (state === "PENDING") {
      pendingCount++;
      if (pendingKeys.length < 20 && overlay.spriteId) pendingKeys.push(overlay.spriteId);
      continue;
    }
    if (state === "FAILED" || !rec?.img || rec.img.width <= 0 || rec.img.height <= 0) {
      failedCount++;
      fallbackCount++;
      deps.cacheStore.markFallback(overlay.id);
      continue;
    }
    const built = buildRuntimeStructureTriangleCacheForOverlay(overlay, rec.img, deps);
    if (!built.cache) {
      fallbackCount++;
      deps.cacheStore.markFallback(overlay.id);
      continue;
    }
    deps.cacheStore.set(built.cache);
    builtCount++;
  }

  return {
    pendingCount,
    failedCount,
    builtCount,
    fallbackCount,
    pendingKeys,
  };
}

export async function prepareRuntimeStructureTrianglesForLoading(
  deps: StructureTriangleCacheRebuildDeps,
): Promise<boolean> {
  const settings = getUserSettings();
  const enabled = settings.render.structureTriangleGeometryEnabled !== false;
  const compiledMap = getActiveCompiledMap();
  const contextKey = buildRuntimeStructureTriangleContextKey({
    mapId: compiledMap.id,
    enabled,
  });
  deps.cacheStore.resetIfContextChanged(contextKey);
  if (!enabled) return true;
  const result = rebuildRuntimeStructureTriangleCacheForMap(compiledMap, deps);
  if (result.pendingCount > 0) {
    const signature = `${contextKey}::${result.pendingCount}::${result.failedCount}::${result.pendingKeys.join("|")}`;
    const now = performance.now();
    if (
      signature !== lastStructureTriangleLoadingPendingSignature
      || now - lastStructureTriangleLoadingPendingLogAtMs >= 1000
    ) {
      lastStructureTriangleLoadingPendingSignature = signature;
      lastStructureTriangleLoadingPendingLogAtMs = now;
      console.debug(
        `[structure-triangles:loading] built=${result.builtCount} pending=${result.pendingCount} failed=${result.failedCount} fallback=${result.fallbackCount}`,
        result.pendingKeys,
      );
    }
    return false;
  }
  lastStructureTriangleLoadingPendingSignature = "";
  if (result.failedCount > 0) {
    const failureKey = `${contextKey}::${result.failedCount}::${result.fallbackCount}`;
    if (failureKey !== lastStructureTriangleLoadingFailureKey) {
      lastStructureTriangleLoadingFailureKey = failureKey;
      console.warn(
        `[structure-triangles:loading] proceeding with ${result.failedCount} failed structure triangle dependencies (fallback path kept)`,
      );
    }
  } else {
    lastStructureTriangleLoadingFailureKey = "";
  }
  return true;
}
