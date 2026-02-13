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
  offsetY: number;
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

export function getHorizontalBandLayout(
  spriteId: string,
  spriteWidth: number,
  spriteHeight: number,
  bandPx: number = DEFAULT_STRUCTURE_BAND_PX,
): ReadonlyArray<RuntimeBandLayout> {
  const h = Math.max(1, spriteHeight | 0);
  const w = Math.max(1, spriteWidth | 0);
  const band = Math.max(1, bandPx | 0);
  const cacheKey = `${spriteId}|${w}x${h}|${band}`;
  const cached = layoutCache.get(cacheKey);
  if (cached) return cached;

  const bands: RuntimeBandLayout[] = [];
  let y = 0;
  let i = 0;
  while (y < h) {
    const bh = Math.min(band, h - y);
    bands.push({
      index: i,
      srcRect: { x: 0, y, w, h: bh },
      offsetY: y,
    });
    y += bh;
    i += 1;
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
  const sliceStride = input.sliceStride ?? DEFAULT_STRUCTURE_SLICE_STRIDE;
  const baseSlice = input.tx + input.ty;
  const layout = getHorizontalBandLayout(input.spriteId, input.spriteWidth, input.spriteHeight, bandPx);

  const out: RuntimeStructureBandRenderPiece[] = new Array(layout.length);
  for (let i = 0; i < layout.length; i++) {
    const band = layout[i];
    out[i] = {
      index: band.index,
      srcRect: { ...band.srcRect },
      dstRect: {
        x: input.baseDx,
        y: input.baseDy + band.offsetY * scale,
        w: band.srcRect.w * scale,
        h: band.srcRect.h * scale,
      },
      renderKey: {
        slice: baseSlice + i * sliceStride,
        within: input.tx,
        baseZ: input.baseZ,
        stableId: bandStableId(input.structureInstanceId, i),
      },
    };
  }

  return out;
}

export function clearRuntimeStructureSliceCache(): void {
  layoutCache.clear();
}
