export type StructureSliceBand = {
  x: number;
  width: number;
  height: number;
};

export function getStructureSlices(input: {
  bounds: { width: number; height: number };
  anchor: { x: number; y: number };
}): StructureSliceBand[] {
  const BAND_PX = 64;
  const width = Number.isFinite(input.bounds.width) ? Math.max(0, input.bounds.width) : 0;
  const height = Number.isFinite(input.bounds.height) ? Math.max(0, input.bounds.height) : 0;
  if (width <= 0 || height <= 0) return [];

  const anchorX = Math.max(0, Math.min(width, input.anchor.x));
  const leftFromAnchor: StructureSliceBand[] = [];
  const rightFromAnchor: StructureSliceBand[] = [];

  let leftCursor = anchorX;
  while (leftCursor > 0) {
    const x = Math.max(0, leftCursor - BAND_PX);
    const sliceWidth = leftCursor - x;
    if (sliceWidth > 0) {
      leftFromAnchor.push({ x, width: sliceWidth, height });
    }
    leftCursor = x;
  }

  let rightCursor = anchorX;
  while (rightCursor < width) {
    const sliceWidth = Math.min(BAND_PX, width - rightCursor);
    if (sliceWidth <= 0) break;
    rightFromAnchor.push({ x: rightCursor, width: sliceWidth, height });
    rightCursor += sliceWidth;
  }

  const out: StructureSliceBand[] = [];
  const maxCount = Math.max(leftFromAnchor.length, rightFromAnchor.length);
  for (let i = 0; i < maxCount; i++) {
    const left = leftFromAnchor[i];
    const right = rightFromAnchor[i];
    if (left) out.push(left);
    if (right) out.push(right);
  }

  // Inflate only the two outer edge slices to full 64px without touching
  // slice count, order, or internal seam placement.
  if (out.length > 0) {
    let leftmostIndex = 0;
    let rightmostIndex = 0;
    for (let i = 1; i < out.length; i++) {
      if (out[i].x < out[leftmostIndex].x) leftmostIndex = i;
      if (out[i].x > out[rightmostIndex].x) rightmostIndex = i;
    }

    const leftmost = out[leftmostIndex];
    if (leftmost.width < BAND_PX) {
      const expandBy = BAND_PX - leftmost.width;
      out[leftmostIndex] = {
        ...leftmost,
        x: leftmost.x - expandBy,
        width: BAND_PX,
      };
    }

    const rightmost = out[rightmostIndex];
    if (rightmost.width < BAND_PX) {
      out[rightmostIndex] = {
        ...rightmost,
        width: BAND_PX,
      };
    }
  }

  return out;
}
