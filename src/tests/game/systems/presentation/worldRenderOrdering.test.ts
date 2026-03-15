import { describe, expect, it } from "vitest";
import {
  KindOrder,
  compareRenderKeys,
  deriveFeetSortYFromKey,
  isGroundKindForRenderPass,
  isWorldKindForRenderPass,
  resolveRenderZBand,
  type RenderKey,
} from "../../../../game/systems/presentation/worldRenderOrdering";

function key(overrides: Partial<RenderKey> = {}): RenderKey {
  return {
    slice: 10,
    within: 5,
    baseZ: 0,
    feetSortY: 100,
    kindOrder: KindOrder.ENTITY,
    stableId: 1,
    ...overrides,
  };
}

describe("worldRenderOrdering", () => {
  it("sorts by slice -> within -> feetSortY -> kindOrder -> stableId", () => {
    const input: RenderKey[] = [
      key({ stableId: 50, feetSortY: 120, kindOrder: KindOrder.STRUCTURE }),
      key({ stableId: 40, feetSortY: 120, kindOrder: KindOrder.ENTITY }),
      key({ stableId: 30, feetSortY: 115 }),
      key({ stableId: 20, within: 6, feetSortY: 90 }),
      key({ stableId: 10, slice: 11, within: 0, feetSortY: 0 }),
    ];

    input.sort(compareRenderKeys);
    expect(input.map((k) => k.stableId)).toEqual([30, 40, 50, 20, 10]);
  });

  it("does not use baseZ in comparator ordering", () => {
    const a = key({ baseZ: 0.1, stableId: 7 });
    const b = key({ baseZ: 999, stableId: 7 });
    expect(compareRenderKeys(a, b)).toBe(0);
  });

  it("derives feetSortY from owner tile center and baseZ projection", () => {
    const derived = deriveFeetSortYFromKey(
      { slice: 10, within: 4, baseZ: 2 },
      64,
      (worldX, worldY, zVisual) => ({ y: worldX * 0.25 + worldY * 0.5 - zVisual * 3 }),
    );

    expect(derived).toBe(274);
  });

  it("preserves ramp zBand remap behavior", () => {
    const rampTiles = new Set<string>(["4,6"]);

    expect(resolveRenderZBand({ slice: 10, within: 4, baseZ: 3 }, rampTiles)).toBe(0);
    expect(resolveRenderZBand({ slice: 10, within: 4, baseZ: 4 }, rampTiles)).toBe(8);
    expect(resolveRenderZBand({ slice: 10, within: 4, baseZ: 8 }, rampTiles)).toBe(8);
    expect(resolveRenderZBand({ slice: 10, within: 3, baseZ: 5 }, rampTiles)).toBe(5);
  });

  it("classifies pass membership with SHADOW in GROUND and LIGHT/STRUCTURE in WORLD", () => {
    expect(isGroundKindForRenderPass(KindOrder.FLOOR)).toBe(true);
    expect(isGroundKindForRenderPass(KindOrder.DECAL)).toBe(true);
    expect(isGroundKindForRenderPass(KindOrder.SHADOW)).toBe(true);
    expect(isGroundKindForRenderPass(KindOrder.LIGHT)).toBe(false);

    expect(isWorldKindForRenderPass(KindOrder.ZONE_OBJECTIVE)).toBe(true);
    expect(isWorldKindForRenderPass(KindOrder.ENTITY)).toBe(true);
    expect(isWorldKindForRenderPass(KindOrder.VFX)).toBe(true);
    expect(isWorldKindForRenderPass(KindOrder.LIGHT)).toBe(true);
    expect(isWorldKindForRenderPass(KindOrder.STRUCTURE)).toBe(true);
    expect(isWorldKindForRenderPass(KindOrder.OCCLUDER)).toBe(true);
    expect(isWorldKindForRenderPass(KindOrder.OVERLAY)).toBe(true);
    expect(isWorldKindForRenderPass(KindOrder.SHADOW)).toBe(false);
  });

  it("keeps WORLD kinds in one comparator domain (no phase override)", () => {
    const mixedWorld: RenderKey[] = [
      key({ stableId: 1, feetSortY: 100, kindOrder: KindOrder.LIGHT }),
      key({ stableId: 2, feetSortY: 110, kindOrder: KindOrder.ENTITY }),
      key({ stableId: 3, feetSortY: 105, kindOrder: KindOrder.STRUCTURE }),
    ];

    mixedWorld.sort(compareRenderKeys);
    expect(mixedWorld.map((k) => k.stableId)).toEqual([1, 3, 2]);
  });
});
