/** Semantic layer ordering for world renderer tie-breaks. */
export enum KindOrder {
  FLOOR = 0,
  DECAL = 1,
  ZONE_OBJECTIVE = 2,
  SHADOW = 3,
  ENTITY = 4,
  VFX = 5,
  LIGHT = 6,
  STRUCTURE = 7,
  OCCLUDER = 8,
  OVERLAY = 9,
}

/** Canonical render key for deterministic ordering. */
export interface RenderKey {
  slice: number;
  within: number;
  baseZ: number;
  feetSortY?: number;
  kindOrder: KindOrder;
  stableId: number;
}

/** V1 WORLD comparator: slice -> within -> feetSortY -> kindOrder -> stableId. */
export function compareRenderKeys(a: RenderKey, b: RenderKey): number {
  if (a.slice !== b.slice) return a.slice - b.slice;
  if (a.within !== b.within) return a.within - b.within;
  const ay = a.feetSortY ?? 0;
  const by = b.feetSortY ?? 0;
  if (ay !== by) return ay - by;
  if (a.kindOrder !== b.kindOrder) return a.kindOrder - b.kindOrder;
  return a.stableId - b.stableId;
}

export function isGroundKindForRenderPass(kind: KindOrder): boolean {
  return kind === KindOrder.FLOOR || kind === KindOrder.DECAL || kind === KindOrder.SHADOW;
}

export function isWorldKindForRenderPass(kind: KindOrder): boolean {
  return kind === KindOrder.ZONE_OBJECTIVE
    || kind === KindOrder.ENTITY
    || kind === KindOrder.VFX
    || kind === KindOrder.LIGHT
    || kind === KindOrder.STRUCTURE
    || kind === KindOrder.OCCLUDER
    || kind === KindOrder.OVERLAY;
}

/**
 * Derive a deterministic feetSortY from the owner tile center projected at baseZ.
 * tx = within, ty = slice - within.
 */
export function deriveFeetSortYFromKey(
  key: Pick<RenderKey, "slice" | "within" | "baseZ">,
  tileWorld: number,
  projectToScreenAtZ: (worldX: number, worldY: number, zVisual: number) => { y: number },
): number {
  const tx = key.within;
  const ty = key.slice - key.within;
  return projectToScreenAtZ((tx + 0.5) * tileWorld, (ty + 0.5) * tileWorld, key.baseZ).y;
}

/** Preserve ramp remap behavior for world zBand grouping. */
export function resolveRenderZBand(
  key: Pick<RenderKey, "slice" | "within" | "baseZ">,
  rampRoadTiles: ReadonlySet<string>,
): number {
  const baseBand = Math.floor(key.baseZ + 1e-3);
  const tx = key.within | 0;
  const ty = (key.slice - key.within) | 0;
  if (rampRoadTiles.has(`${tx},${ty}`) && baseBand > 0 && baseBand < 8) {
    return baseBand >= 4 ? 8 : 0;
  }
  return baseBand;
}
