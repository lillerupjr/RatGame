import { describe, expect, it } from "vitest";
import {
  KindOrder,
  compareRenderKeys,
  deriveStructureSouthTieBreakFromSeAnchor,
  type RenderKey,
} from "../../../../game/systems/presentation/worldRenderOrdering";
import { deriveParentTileRenderFields } from "../../../../game/structures/monolithicStructureGeometry";

describe("structure slice southness tie-break", () => {
  it("prefers geometric source-building southness for nearby same-domain overflow collisions", () => {
    const owner = { tx: -1, ty: 2 };
    const ownerSlice = owner.tx + owner.ty;
    const ownerWithin = owner.tx;

    const southA = deriveStructureSouthTieBreakFromSeAnchor(1, 2);
    const southB = deriveStructureSouthTieBreakFromSeAnchor(-1, 2);
    expect(southA.structureSouthSlice).toBeGreaterThan(southB.structureSouthSlice);

    const southKey: RenderKey = {
      slice: ownerSlice,
      within: ownerWithin,
      baseZ: 0,
      feetSortY: 100,
      kindOrder: KindOrder.STRUCTURE,
      stableId: 1, // Intentionally lower than north to prove stableId is no longer primary.
      ...southA,
    };
    const northKey: RenderKey = {
      slice: ownerSlice,
      within: ownerWithin,
      baseZ: 0,
      feetSortY: 100,
      kindOrder: KindOrder.STRUCTURE,
      stableId: 999,
      ...southB,
    };

    const ordered = [southKey, northKey].sort(compareRenderKeys);
    expect(ordered[0]).toBe(northKey);
    expect(ordered[1]).toBe(southKey);
  });

  it("keeps winner direction identical between fallback-band and triangle-group structure keys", () => {
    const owner = { tx: -1, ty: 2 };
    const southA = deriveStructureSouthTieBreakFromSeAnchor(1, 2);
    const southB = deriveStructureSouthTieBreakFromSeAnchor(-1, 2);

    const fallbackSouth: RenderKey = {
      slice: owner.tx + owner.ty,
      within: owner.tx,
      baseZ: 0,
      feetSortY: 100,
      kindOrder: KindOrder.STRUCTURE,
      stableId: 5,
      ...southA,
    };
    const fallbackNorth: RenderKey = {
      slice: owner.tx + owner.ty,
      within: owner.tx,
      baseZ: 0,
      feetSortY: 100,
      kindOrder: KindOrder.STRUCTURE,
      stableId: 500,
      ...southB,
    };

    const triangleFields = deriveParentTileRenderFields(owner.tx, owner.ty);
    const triangleSouth: RenderKey = {
      slice: triangleFields.slice,
      within: triangleFields.within,
      baseZ: 0,
      feetSortY: 100,
      kindOrder: KindOrder.STRUCTURE,
      stableId: 1_000, // Reverse the stableId skew vs fallback case.
      ...southA,
    };
    const triangleNorth: RenderKey = {
      slice: triangleFields.slice,
      within: triangleFields.within,
      baseZ: 0,
      feetSortY: 100,
      kindOrder: KindOrder.STRUCTURE,
      stableId: 2,
      ...southB,
    };

    const fallbackSorted = [fallbackSouth, fallbackNorth].sort(compareRenderKeys);
    const triangleSorted = [triangleSouth, triangleNorth].sort(compareRenderKeys);

    // South source should win (render later) in both paths, independent of stableId scheme.
    expect(fallbackSorted[fallbackSorted.length - 1]).toBe(fallbackSouth);
    expect(triangleSorted[triangleSorted.length - 1]).toBe(triangleSouth);
  });
});
