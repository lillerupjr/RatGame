export type StructureSliceDebugAlphaMap = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

type OccupiedBoundsPx = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type StructureAnchorResult = {
  anchorPx: { x: number; y: number };
  occupiedBoundsPx: OccupiedBoundsPx;
  southYByXLocal: number[];
  plateauRangeLocal: { startX: number; endX: number };
  maxSouthYLocal: number;
};

const ALPHA_THRESHOLD = 24;
const PLATEAU_TOLERANCE = 2;
const STRIP_OFFSET_THRESHOLD = 24;

const EMPTY = -1;

/* ------------------------------------------------------------ */
/* Helpers                                                      */
/* ------------------------------------------------------------ */

function flipAlphaX(alpha: StructureSliceDebugAlphaMap): StructureSliceDebugAlphaMap {
  const { width, height, data } = alpha;
  const out = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = width - 1 - x;

      const src = (y * width + srcX) * 4;
      const dst = (y * width + x) * 4;

      out[dst + 0] = data[src + 0];
      out[dst + 1] = data[src + 1];
      out[dst + 2] = data[src + 2];
      out[dst + 3] = data[src + 3];
    }
  }

  return { width, height, data: out };
}

function findBounds(alpha: StructureSliceDebugAlphaMap): OccupiedBoundsPx | null {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  const { width, height, data } = alpha;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3] ?? 0;
      if (a < ALPHA_THRESHOLD) continue;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (!Number.isFinite(minX)) return null;

  return {
    minX: Math.floor(minX),
    minY: Math.floor(minY),
    maxX: Math.ceil(maxX),
    maxY: Math.ceil(maxY),
  };
}

function buildSouthProfile(
  alpha: StructureSliceDebugAlphaMap,
  bounds: OccupiedBoundsPx
): number[] {
  const width = bounds.maxX - bounds.minX + 1;
  const out = new Array<number>(width).fill(EMPTY);

  for (let lx = 0; lx < width; lx++) {
    const x = bounds.minX + lx;

    for (let y = bounds.maxY; y >= bounds.minY; y--) {
      const a = alpha.data[(y * alpha.width + x) * 4 + 3] ?? 0;
      if (a >= ALPHA_THRESHOLD) {
        out[lx] = y - bounds.minY;
        break;
      }
    }
  }

  return out;
}

function denoise(s: number[]): number[] {
  const out = s.slice();

  for (let i = 1; i < s.length - 1; i++) {
    const l = s[i - 1];
    const c = s[i];
    const r = s[i + 1];

    if (l < 0 || c < 0 || r < 0) continue;

    const median = [l, c, r].sort((a, b) => a - b)[1];

    if (Math.abs(c - median) > 2) {
      out[i] = median;
    }
  }

  return out;
}

function detectPlateau(s: number[]) {
  let maxY = EMPTY;
  for (const v of s) maxY = Math.max(maxY, v);

  if (maxY < 0) {
    return { startX: 0, endX: 0, maxY: 0 };
  }

  const runs: { startX: number; endX: number; width: number; avg: number }[] = [];

  let start = -1, sum = 0, count = 0;

  for (let x = 0; x < s.length; x++) {
    const y = s[x];
    const ok = y >= 0 && y >= maxY - PLATEAU_TOLERANCE;

    if (ok) {
      if (start < 0) {
        start = x;
        sum = 0;
        count = 0;
      }
      sum += y;
      count++;
    } else if (start >= 0) {
      const end = x - 1;
      runs.push({
        startX: start,
        endX: end,
        width: end - start + 1,
        avg: sum / count,
      });
      start = -1;
    }
  }

  if (start >= 0) {
    const end = s.length - 1;
    runs.push({
      startX: start,
      endX: end,
      width: end - start + 1,
      avg: sum / count,
    });
  }

  if (!runs.length) {
    return { startX: 0, endX: s.length - 1, maxY };
  }

  runs.sort((a, b) =>
    b.width - a.width ||
    b.avg - a.avg ||
    a.startX - b.startX
  );

  const r = runs[0];

  return {
    startX: r.startX,
    endX: r.endX,
    maxY,
  };
}

function computeAnchor(
  s: number[],
  startX: number,
  endX: number,
  maxY: number
) {
  const clamp = (v: number) => Math.max(0, Math.min(s.length - 1, v));

  startX = clamp(startX);
  endX = Math.max(startX, clamp(endX));

  const fallback = maxY >= 0 ? maxY : 0;

  const leftY = s[startX] >= 0 ? s[startX] : fallback;
  const rightY = s[endX] >= 0 ? s[endX] : fallback;

  const left = { x: startX + 0.5, y: leftY + 0.5 };
  const right = { x: endX + 0.5, y: rightY + 0.5 };

  const center = {
    x: (left.x + right.x) * 0.5,
    y: (left.y + right.y) * 0.5,
  };

  const width = Math.hypot(right.x - left.x, right.y - left.y);

  const offset = width > STRIP_OFFSET_THRESHOLD ? width * 0.25 : 0;

  return {
    x: center.x,
    y: center.y + offset,
  };
}

/* ------------------------------------------------------------ */
/* Public                                                       */
/* ------------------------------------------------------------ */

export function getStructureAnchorFromAlphaMap(input: {
  alphaMap: StructureSliceDebugAlphaMap;
  flipX?: boolean;
}): StructureAnchorResult | null {

  const alpha = input.flipX
    ? flipAlphaX(input.alphaMap)
    : input.alphaMap;

  const bounds = findBounds(alpha);
  if (!bounds) return null;

  const southRaw = buildSouthProfile(alpha, bounds);
  const south = denoise(southRaw);

  const plateau = detectPlateau(south);

  const localAnchor = computeAnchor(
    south,
    plateau.startX,
    plateau.endX,
    plateau.maxY
  );

  return {
    anchorPx: {
      x: bounds.minX + localAnchor.x,
      y: bounds.minY + localAnchor.y,
    },
    occupiedBoundsPx: bounds,
    southYByXLocal: south,
    plateauRangeLocal: {
      startX: plateau.startX,
      endX: plateau.endX,
    },
    maxSouthYLocal: plateau.maxY,
  };
}
