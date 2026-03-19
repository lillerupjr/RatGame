import { describe, expect, it } from "vitest";
import {
  buildRampRoadTiles,
  decalRelightPieceKey,
  floorRelightPieceKey,
  structureSliceRelightPieceKey,
} from "../../../../game/systems/presentation/staticRelight/staticRelightBakeRebuild";

describe("staticRelightBakeRebuild", () => {
  it("collects ramp tiles from semantic rects", () => {
    const compiledMap = {
      roadSemanticRects: [
        { x: 2, y: 3, w: 2, h: 1, semantic: "ramp" },
        { x: 7, y: 8, w: 1, h: 2, semantic: "ramp_up" },
        { x: 11, y: 12, w: 1, h: 1, semantic: "lane" },
      ],
    } as any;

    const rampTiles = buildRampRoadTiles(compiledMap);

    expect(rampTiles.has("2,3")).toBe(true);
    expect(rampTiles.has("3,3")).toBe(true);
    expect(rampTiles.has("7,8")).toBe(true);
    expect(rampTiles.has("7,9")).toBe(true);
    expect(rampTiles.has("11,12")).toBe(false);
  });

  it("builds deterministic static relight piece keys", () => {
    const floorA = floorRelightPieceKey(1, 2, 3, 0.5, "sidewalk", 4, 1);
    const floorB = floorRelightPieceKey(1, 2, 3, 0.5, "sidewalk", 4, 1);
    const decalA = decalRelightPieceKey(1, 2, 3, 0.5, "lane_marking" as any, 4, 1, 0.75);
    const structureA = structureSliceRelightPieceKey(
      { id: "s1", spriteId: "sprite/a" } as any,
      2,
      9,
      8,
      10,
      11,
      12,
      13,
      64,
      128,
      true,
    );

    expect(floorA).toBe(floorB);
    expect(decalA.startsWith("DECAL_TOP::")).toBe(true);
    expect(structureA.startsWith("STRUCTURE_SLICE::")).toBe(true);
  });
});
