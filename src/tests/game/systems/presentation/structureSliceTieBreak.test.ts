import { describe, expect, it } from "vitest";
import {
  buildRuntimeStructureBandPieces,
  clearRuntimeStructureSliceCache,
} from "../../../../engine/render/sprites/runtimeStructureSlicing";
import { registerSpriteMeta } from "../../../../engine/render/sprites/spriteMeta";
import {
  KindOrder,
  compareRenderKeys,
  deriveStructureSouthTieBreakFromSeAnchor,
  type RenderKey,
} from "../../../../game/systems/presentation/worldRenderOrdering";
import { deriveParentTileRenderFields } from "../../../../game/systems/presentation/runtimeStructureTriangles";

const TEST_SPRITE_ID = "structures/buildings/test/runtime_tie_break_shared";

function ownerTx(piece: { renderKey: { within: number } }): number {
  return piece.renderKey.within;
}

function ownerTy(piece: { renderKey: { slice: number; within: number } }): number {
  return piece.renderKey.slice - piece.renderKey.within;
}

function findPieceAtOwner(
  pieces: ReturnType<typeof buildRuntimeStructureBandPieces>,
  tx: number,
  ty: number,
) {
  const hit = pieces.find((piece) => ownerTx(piece) === tx && ownerTy(piece) === ty);
  expect(hit).toBeTruthy();
  return hit!;
}

describe("structure slice southness tie-break", () => {
  it("prefers geometric source-building southness for nearby same-domain overflow collisions", () => {
    clearRuntimeStructureSliceCache();
    registerSpriteMeta(TEST_SPRITE_ID, { tileWidth: 2, tileHeight: 3, zHeight: 1 });

    // A: farther south source building. B: farther north source building.
    const piecesA = buildRuntimeStructureBandPieces({
      structureInstanceId: "tie_building_A",
      spriteId: TEST_SPRITE_ID,
      seTx: 1,
      seTy: 2,
      footprintW: 2,
      footprintH: 3,
      baseZ: 0,
      baseDx: 0,
      baseDy: 0,
      spriteWidth: 420,
      spriteHeight: 128,
      bandPx: 64,
      scale: 1,
    });
    const piecesB = buildRuntimeStructureBandPieces({
      structureInstanceId: "tie_building_B",
      spriteId: TEST_SPRITE_ID,
      seTx: -1,
      seTy: 2,
      footprintW: 2,
      footprintH: 3,
      baseZ: 0,
      baseDx: 0,
      baseDy: 0,
      spriteWidth: 420,
      spriteHeight: 128,
      bandPx: 64,
      scale: 1,
    });

    // Overflow/corner ownership collision in the same ordering domain.
    const owner = { tx: -1, ty: 2 };
    const pieceA = findPieceAtOwner(piecesA, owner.tx, owner.ty);
    const pieceB = findPieceAtOwner(piecesB, owner.tx, owner.ty);
    expect(pieceA.renderKey.slice).toBe(pieceB.renderKey.slice);
    expect(pieceA.renderKey.within).toBe(pieceB.renderKey.within);

    const southA = deriveStructureSouthTieBreakFromSeAnchor(1, 2);
    const southB = deriveStructureSouthTieBreakFromSeAnchor(-1, 2);
    expect(southA.structureSouthSlice).toBeGreaterThan(southB.structureSouthSlice);

    const southKey: RenderKey = {
      slice: pieceA.renderKey.slice,
      within: pieceA.renderKey.within,
      baseZ: 0,
      feetSortY: 100,
      kindOrder: KindOrder.STRUCTURE,
      stableId: 1, // Intentionally lower than north to prove stableId is no longer primary.
      ...southA,
    };
    const northKey: RenderKey = {
      slice: pieceB.renderKey.slice,
      within: pieceB.renderKey.within,
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
