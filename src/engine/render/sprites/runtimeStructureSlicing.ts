import { getSpriteMeta } from "./spriteMeta";
import { orientedDims, ownerTileForBandFromSE } from "./structureFootprintOwnership";

export const DEFAULT_STRUCTURE_BAND_PX = 64;
export const DEFAULT_STRUCTURE_SLICE_STRIDE = 1;

export type RuntimeSliceRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type RuntimeBandLayout = {
  index: number;
  srcRect: RuntimeSliceRect;
  offsetX: number;
};

export type RuntimeStructureBandInput = {
  structureInstanceId: string;
  spriteId: string;
  seTx: number;
  seTy: number;
  baseZ: number;
  baseDx: number;
  baseDy: number;
  spriteWidth: number;
  spriteHeight: number;
  footprintW?: number;
  footprintH?: number;
  flipped?: boolean;
  sliceOffsetX?: number;
  sliceOffsetY?: number;
  /** Optional source X (in unscaled sprite pixels) where core bands begin. */
  sliceOriginX?: number;
  scale?: number;
  bandPx?: number;
  sliceStride?: number;
};

export type RuntimeStructureBandRenderPiece = {
  index: number;
  srcRect: RuntimeSliceRect;
  dstRect: RuntimeSliceRect;
  renderKey: {
    slice: number;
    within: number;
    baseZ: number;
    stableId: number;
  };
};

const layoutCache = new Map<string, ReadonlyArray<RuntimeBandLayout>>();

function hashString32(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function bandStableId(structureInstanceId: string, bandIndex: number): number {
  return hashString32(`${structureInstanceId}:${bandIndex}`);
}

export function getVerticalBandLayout(
  spriteId: string,
  spriteWidth: number,
  spriteHeight: number,
  bandPx: number = DEFAULT_STRUCTURE_BAND_PX,
  footprintW?: number,
  footprintH?: number,
  sliceOriginX?: number,
): ReadonlyArray<RuntimeBandLayout> {
  const h = Math.max(1, spriteHeight | 0);
  const w = Math.max(1, spriteWidth | 0);
  const band = Math.max(1, bandPx | 0);
  const meta = getSpriteMeta(spriteId);
  const tileW = Math.max(1, (footprintW ?? meta.tileWidth) | 0);
  const tileH = Math.max(1, (footprintH ?? meta.tileHeight) | 0);
  const coreCount = tileW + tileH;
  const coreExpectedW = coreCount * band;
  const maxCoreOrigin = Math.max(0, w - coreExpectedW);
  const centeredOrigin = Math.floor(maxCoreOrigin / 2);
  const extraLeftW = Number.isFinite(sliceOriginX)
    ? Math.max(0, Math.min(maxCoreOrigin, Math.round(sliceOriginX as number)))
    : centeredOrigin;
  const extraRightW = Math.max(0, w - coreExpectedW - extraLeftW);
  const cacheKey = `${spriteId}|${w}x${h}|${band}|${coreCount}|${extraLeftW}`;
  const cached = layoutCache.get(cacheKey);
  if (cached) return cached;

  const bands: RuntimeBandLayout[] = [];
  if (extraLeftW > 0) {
    bands.push({
      index: 0,
      srcRect: { x: 0, y: 0, w: extraLeftW, h },
      offsetX: -extraLeftW,
    });
  }

  for (let i = 0; i < coreCount; i++) {
    const srcX = extraLeftW + i * band;
    const srcW = Math.max(0, Math.min(band, w - srcX));
    if (srcW <= 0) continue;
    bands.push({
      index: i + 1,
      srcRect: { x: srcX, y: 0, w: srcW, h },
      offsetX: i * band,
    });
  }

  if (extraRightW > 0) {
    const srcX = extraLeftW + coreExpectedW;
    const srcW = Math.max(0, Math.min(extraRightW, w - srcX));
    if (srcW > 0) {
      bands.push({
        index: coreCount + 1,
        srcRect: { x: srcX, y: 0, w: srcW, h },
        offsetX: coreExpectedW,
      });
    }
  }

  const frozen = Object.freeze(bands.map((b) => Object.freeze({ ...b, srcRect: Object.freeze({ ...b.srcRect }) })));
  layoutCache.set(cacheKey, frozen);
  return frozen;
}

export function buildRuntimeStructureBandPieces(
  input: RuntimeStructureBandInput,
): RuntimeStructureBandRenderPiece[] {
  const scale = input.scale ?? 1;
  const bandPx = input.bandPx ?? DEFAULT_STRUCTURE_BAND_PX;
  const flipped = !!input.flipped;
  // Keep slice offset in authored screen pixels (same convention as drawDxOffset).
  const sliceOffsetX = input.sliceOffsetX ?? 0;
  const sliceOffsetY = input.sliceOffsetY ?? 0;
  // Keep core slice stride anchored to tile-grid screen spacing, independent of sprite scale.
  // Example: scale=0.5 => source bands double in width, so destination bands still land at ~64px.
  const safeScale = Math.max(1e-6, Math.abs(scale));
  const sourceBandPx = Math.max(1, Math.round(bandPx / safeScale));
  const layout = getVerticalBandLayout(
    input.spriteId,
    input.spriteWidth,
    input.spriteHeight,
    sourceBandPx,
    input.footprintW,
    input.footprintH,
    input.sliceOriginX,
  );
  const meta = getSpriteMeta(input.spriteId);
  const baseTileW = Math.max(1, (input.footprintW ?? meta.tileWidth) | 0);
  const baseTileH = Math.max(1, (input.footprintH ?? meta.tileHeight) | 0);
  // When footprint is supplied by map compile, it is already oriented.
  // Only orient metadata fallback dimensions.
  const hasExplicitFootprint = input.footprintW !== undefined && input.footprintH !== undefined;
  const oriented = hasExplicitFootprint
    ? { w: baseTileW, h: baseTileH }
    : orientedDims(baseTileW, baseTileH, flipped);
  const tileW = oriented.w;
  const tileH = oriented.h;
  const anchorTx = input.seTx | 0;
  const anchorTy = input.seTy | 0;
  const coreCount = tileW + tileH;

  const out: RuntimeStructureBandRenderPiece[] = new Array(layout.length);
  for (let i = 0; i < layout.length; i++) {
    const band = layout[i];
    const spriteBandIndex = band.index === 0
      ? 0
      : band.index === coreCount + 1
        ? coreCount - 1
        : band.index - 1;
    const ownerBandIndex = spriteBandIndex < tileW
      ? (tileW - 1) - spriteBandIndex
      : spriteBandIndex;
    const owner = ownerTileForBandFromSE(anchorTx, anchorTy, tileW, tileH, ownerBandIndex);

    out[i] = {
      index: band.index,
      srcRect: { ...band.srcRect },
      dstRect: {
        // baseDx is the full sprite draw-left; band.srcRect.x keeps the slice positioned exactly where it was in the full sprite.
        x: input.baseDx + band.srcRect.x * scale + sliceOffsetX,
        y: input.baseDy + sliceOffsetY,
        w: band.srcRect.w * scale,
        h: band.srcRect.h * scale,
      },
      renderKey: {
        slice: owner.tx + owner.ty,
        within: owner.tx,
        baseZ: input.baseZ,
        stableId: bandStableId(input.structureInstanceId, band.index),
      },
    };
  }

  return out;
}

export function clearRuntimeStructureSliceCache(): void {
  layoutCache.clear();
}
