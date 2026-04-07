import { describe, expect, it } from "vitest";
import {
  STRUCTURE_TRIANGLE_HEIGHT_STEP_PX,
  buildMonolithicBuildingSemanticGeometryFromAlphaMap,
  getMonolithicBuildingSemanticGeometryForSprite,
  resolveMonolithicSliceParentFootprintPosition,
  resolveMonolithicSliceParentTileFromSeAnchor,
} from "../../../game/structures/monolithicBuildingSemanticPrepass";
import { getDowntown2MonolithicAlphaMap } from "../../../game/content/monolithicBuildingAlphaDowntown2";
import { pixelHeightToTileHeight } from "../../../game/map/tileHeightUnits";

describe("monolithicBuildingSemanticPrepass", () => {
  it("maps semantic slice bands to the open footprint walk with endpoint clamping", () => {
    expect(resolveMonolithicSliceParentFootprintPosition(0, 4, 4)).toEqual({
      parentFootprintProgression: 0,
      parentFootprintOffsetTx: 0,
      parentFootprintOffsetTy: 3,
    });
    expect(resolveMonolithicSliceParentFootprintPosition(1, 4, 4)).toEqual({
      parentFootprintProgression: 0,
      parentFootprintOffsetTx: 0,
      parentFootprintOffsetTy: 3,
    });
    expect(resolveMonolithicSliceParentFootprintPosition(4, 4, 4)).toEqual({
      parentFootprintProgression: 3,
      parentFootprintOffsetTx: 3,
      parentFootprintOffsetTy: 3,
    });
    expect(resolveMonolithicSliceParentFootprintPosition(5, 4, 4)).toEqual({
      parentFootprintProgression: 4,
      parentFootprintOffsetTx: 3,
      parentFootprintOffsetTy: 3,
    });
    expect(resolveMonolithicSliceParentFootprintPosition(8, 4, 4)).toEqual({
      parentFootprintProgression: 7,
      parentFootprintOffsetTx: 3,
      parentFootprintOffsetTy: 0,
    });
    expect(resolveMonolithicSliceParentTileFromSeAnchor(13, 13, 4, 4, 9)).toEqual({
      parentFootprintProgression: 7,
      parentFootprintOffsetTx: 3,
      parentFootprintOffsetTy: 0,
      tx: 13,
      ty: 10,
    });
  });

  it("derives deterministic downtown_2 semantic geometry from monolithic alpha data", () => {
    const alphaMap = getDowntown2MonolithicAlphaMap();

    const first = buildMonolithicBuildingSemanticGeometryFromAlphaMap(
      "downtown_2",
      "structures/buildings/downtown/2",
      alphaMap,
      { heightUnits: 32 },
    );
    const second = buildMonolithicBuildingSemanticGeometryFromAlphaMap(
      "downtown_2",
      "structures/buildings/downtown/2",
      alphaMap,
      { heightUnits: 32 },
    );

    expect(first).toEqual(second);
    expect(first?.n).toBe(4);
    expect(first?.m).toBe(4);
    expect(first?.heightUnits).toBe(32);
    expect(first?.tileHeightUnits).toBe(
      pixelHeightToTileHeight((first?.faceTriangleCounts.selected ?? 0) * STRUCTURE_TRIANGLE_HEIGHT_STEP_PX),
    );
    expect(first?.faceTriangleCounts.rule).toBe("max");
    expect(first?.faceTriangleCounts.triangleHeightPx).toBe(STRUCTURE_TRIANGLE_HEIGHT_STEP_PX);
    expect(first?.faceTriangleCounts.leftSouth).toBeGreaterThan(0);
    expect(first?.faceTriangleCounts.rightEast).toBeGreaterThan(0);
    expect(first?.faceTriangleCounts.selected).toBe(first?.tileHeightUnits);
    expect(first?.anchorSpriteLocal).toBeTruthy();
    expect(first?.sliceEntries.length).toBeGreaterThan(0);
    expect(first?.sliceEntries.every((entry) => (
      Number.isInteger(entry.parentFootprintProgression)
      && Number.isInteger(entry.parentFootprintOffsetTx)
      && Number.isInteger(entry.parentFootprintOffsetTy)
    ))).toBe(true);
  });

  it("loads asset-backed semantic geometry in node and marks it computed", () => {
    const semantic = getMonolithicBuildingSemanticGeometryForSprite(
      "downtown_2",
      "structures/buildings/downtown/2",
    );
    expect(semantic).toBeTruthy();
    expect(semantic?.source).toBe("computed");
    expect(semantic?.sliceEntries.length).toBeGreaterThan(0);
    expect(semantic?.tileHeightUnits).toBe(
      pixelHeightToTileHeight((semantic?.faceTriangleCounts.selected ?? 0) * STRUCTURE_TRIANGLE_HEIGHT_STEP_PX),
    );
    expect(semantic?.faceTriangleCounts.triangleHeightPx).toBe(STRUCTURE_TRIANGLE_HEIGHT_STEP_PX);
  });
});
