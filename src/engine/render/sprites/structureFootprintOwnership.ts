export type StructureAnchorKind =
  | "TOP_LEFT"
  | "TOP_RIGHT"
  | "BOTTOM_LEFT"
  | "BOTTOM_RIGHT"
  | "CENTER";

function normalizedExtent(v: number): number {
  return Math.max(1, v | 0);
}

export function orientedDims(w: number, h: number, flipped: boolean): { w: number; h: number } {
  const width = normalizedExtent(w);
  const height = normalizedExtent(h);
  return flipped ? { w: height, h: width } : { w: width, h: height };
}

export function anchorToBaseTile(
  anchorTx: number,
  anchorTy: number,
  orientedW: number,
  orientedH: number,
  anchorKind: StructureAnchorKind,
): { baseTx: number; baseTy: number } {
  const w = normalizedExtent(orientedW);
  const h = normalizedExtent(orientedH);
  switch (anchorKind) {
    case "TOP_LEFT":
      return { baseTx: anchorTx | 0, baseTy: anchorTy | 0 };
    case "TOP_RIGHT":
      return { baseTx: (anchorTx | 0) - (w - 1), baseTy: anchorTy | 0 };
    case "BOTTOM_LEFT":
      return { baseTx: anchorTx | 0, baseTy: (anchorTy | 0) - (h - 1) };
    case "BOTTOM_RIGHT":
      return { baseTx: (anchorTx | 0) - (w - 1), baseTy: (anchorTy | 0) - (h - 1) };
    case "CENTER":
      return {
        baseTx: Math.round(anchorTx - (w - 1) * 0.5),
        baseTy: Math.round(anchorTy - (h - 1) * 0.5),
      };
  }
}

export function seAnchorFromTopLeft(
  topLeftTx: number,
  topLeftTy: number,
  orientedW: number,
  orientedH: number,
): { anchorTx: number; anchorTy: number } {
  const w = normalizedExtent(orientedW);
  const h = normalizedExtent(orientedH);
  return {
    anchorTx: (topLeftTx | 0) + (w - 1),
    anchorTy: (topLeftTy | 0) + (h - 1),
  };
}

export function ownerTileForBandFromSE(
  anchorTx: number,
  anchorTy: number,
  w: number,
  _h: number,
  bandIndex: number,
): { tx: number; ty: number } {
  const tw = normalizedExtent(w);
  const i = bandIndex | 0;

  // Integer progression from left-to-right visual ownership:
  // - walk east along south edge up to SE (i <= tw - 1),
  // - then walk north on east edge,
  // - support overflow on either side with virtual anchors.
  if (i <= tw - 1) {
    return {
      tx: anchorTx - ((tw - 1) - i),
      ty: anchorTy,
    };
  }
  return {
    tx: anchorTx,
    ty: anchorTy - (i - (tw - 1)),
  };
}
