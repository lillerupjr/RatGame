import { describe, expect, it } from "vitest";
import {
  buildRuntimeStructureBandPieces,
  clearRuntimeStructureSliceCache,
  DEFAULT_STRUCTURE_BAND_PX,
  getHorizontalBandLayout,
} from "../../../../engine/render/sprites/runtimeStructureSlicing";

describe("runtimeStructureSlicing", () => {
  it("builds horizontal bands from top to bottom with default 64px bands", () => {
    clearRuntimeStructureSliceCache();
    const bands = getHorizontalBandLayout("structures/buildings/test/test1", 96, 150, DEFAULT_STRUCTURE_BAND_PX);

    expect(bands).toHaveLength(3);
    expect(bands[0].srcRect).toEqual({ x: 0, y: 0, w: 96, h: 64 });
    expect(bands[1].srcRect).toEqual({ x: 0, y: 64, w: 96, h: 64 });
    expect(bands[2].srcRect).toEqual({ x: 0, y: 128, w: 96, h: 22 });
  });

  it("maps render keys using tile slice semantics and stride", () => {
    clearRuntimeStructureSliceCache();
    const pieces = buildRuntimeStructureBandPieces({
      structureInstanceId: "building_A",
      spriteId: "structures/buildings/test/test1",
      tx: 10,
      ty: 20,
      baseZ: 3,
      baseDx: 100,
      baseDy: 200,
      spriteWidth: 128,
      spriteHeight: 130,
      bandPx: 64,
      sliceStride: 2,
      scale: 1,
    });

    expect(pieces).toHaveLength(3);
    expect(pieces.map((p) => p.renderKey.slice)).toEqual([30, 32, 34]);
    expect(pieces.every((p) => p.renderKey.within === 10)).toBe(true);
    expect(pieces.every((p) => p.renderKey.baseZ === 3)).toBe(true);

    const stableIds = pieces.map((p) => p.renderKey.stableId);
    expect(new Set(stableIds).size).toBe(stableIds.length);
  });
});
