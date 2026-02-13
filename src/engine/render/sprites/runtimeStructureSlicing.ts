import { getSpriteMeta } from "./spriteMeta";

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
  tx: number;
  ty: number;
  baseZ: number;
  baseDx: number;
  baseDy: number;
  spriteWidth: number;
  spriteHeight: number;
  footprintW?: number;
  footprintH?: number;
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

export function getStructureBandOwnerTile(
  tx: number,
  ty: number,
  w: number,
  h: number,
  bandIndex: number,
): { tx: number; ty: number } {
  const tw = Math.max(1, w | 0);
  const th = Math.max(1, h | 0);
  const bandCount = tw + th;
  const i = Math.max(0, Math.min(bandCount - 1, bandIndex | 0));
  if (i < tw) {
    return {
      tx: tx + i,
      ty: ty + (th - 1),
    };
  }
  const j = i - tw;
  return {
    tx: tx + (tw - 1),
    ty: ty + (th - 1) - j,
  };
}

export function getVerticalBandLayout(
  spriteId: string,
  spriteWidth: number,
  spriteHeight: number,
  bandPx: number = DEFAULT_STRUCTURE_BAND_PX,
  footprintW?: number,
  footprintH?: number,
): ReadonlyArray<RuntimeBandLayout> {
  const h = Math.max(1, spriteHeight | 0);
  const w = Math.max(1, spriteWidth | 0);
  const band = Math.max(1, bandPx | 0);
  const meta = getSpriteMeta(spriteId);
  const tileW = Math.max(1, (footprintW ?? meta.tileWidth) | 0);
  const tileH = Math.max(1, (footprintH ?? meta.tileHeight) | 0);
  const coreCount = tileW + tileH;
  const coreExpectedW = coreCount * band;
  const extraW = Math.max(0, w - coreExpectedW);
  const extraLeftW = Math.floor(extraW / 2);
  const extraRightW = extraW - extraLeftW;
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
  const layout = getVerticalBandLayout(
    input.spriteId,
    input.spriteWidth,
    input.spriteHeight,
    bandPx,
    input.footprintW,
    input.footprintH,
  );
  const meta = getSpriteMeta(input.spriteId);
  const tileW = Math.max(1, (input.footprintW ?? meta.tileWidth) | 0);
  const tileH = Math.max(1, (input.footprintH ?? meta.tileHeight) | 0);
  const coreCount = tileW + tileH;

  const out: RuntimeStructureBandRenderPiece[] = new Array(layout.length);
  for (let i = 0; i < layout.length; i++) {
    const band = layout[i];
    const coreIndex = band.index === 0
      ? 0
      : band.index === coreCount + 1
        ? coreCount - 1
        : band.index - 1;
    const owner = getStructureBandOwnerTile(input.tx, input.ty, tileW, tileH, coreIndex);
    out[i] = {
      index: band.index,
      srcRect: { ...band.srcRect },
      dstRect: {
        x: (() => {
          const anchorXFull = input.spriteWidth * 0.5;
          const anchorXSliceInFull = band.srcRect.x + band.srcRect.w * 0.5;
          const computedSliceAlignAdjustPx = anchorXFull - anchorXSliceInFull;
          // Align cropped slice to the same world pivot as the full sprite (bottom-center anchor).
          return input.baseDx + (anchorXFull - band.srcRect.w * 0.5 - computedSliceAlignAdjustPx) * scale;
        })(),
        y: input.baseDy,
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
