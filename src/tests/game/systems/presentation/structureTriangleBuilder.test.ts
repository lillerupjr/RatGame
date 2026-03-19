import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  getStructureSliceDebugAlphaMap: vi.fn(),
}));

vi.mock("../../../../game/systems/presentation/structureTriangles/structureTriangleAlphaReadback", () => ({
  getStructureSliceDebugAlphaMap: mocked.getStructureSliceDebugAlphaMap,
}));

import { buildRuntimeStructureTriangleDebugPieces } from "../../../../game/systems/presentation/structureTriangles/structureTriangleBuilder";

describe("structureTriangleBuilder", () => {
  beforeEach(() => {
    mocked.getStructureSliceDebugAlphaMap.mockReset();
  });

  it("is deterministic for fixed rect and progression", () => {
    const rect = { x: 100, y: 200, w: 64, h: 192 };

    const first = buildRuntimeStructureTriangleDebugPieces(rect, 2, 64, "structure_1", 3);
    const second = buildRuntimeStructureTriangleDebugPieces(rect, 2, 64, "structure_1", 3);

    expect(second).toEqual(first);
    expect(first.stats.beforeCull).toBeGreaterThan(0);
    expect(first.stats.afterCull).toBeGreaterThan(0);
  });

  it("culls all triangles when alpha map is fully transparent", () => {
    const alphaData = new Uint8ClampedArray(64 * 128 * 4);
    mocked.getStructureSliceDebugAlphaMap.mockReturnValue({
      width: 64,
      height: 128,
      data: alphaData,
    });

    const built = buildRuntimeStructureTriangleDebugPieces(
      { x: 0, y: 0, w: 64, h: 128 },
      1,
      64,
      "structure_2",
      2,
      {} as CanvasImageSource,
      { x: 0, y: 0, w: 64, h: 128 },
    );

    expect(built.stats.beforeCull).toBeGreaterThan(0);
    expect(built.stats.afterCull).toBe(0);
    expect(built.pieces).toHaveLength(0);
  });

  it("keeps all candidate triangles when alpha map is fully opaque", () => {
    const alphaData = new Uint8ClampedArray(64 * 128 * 4);
    for (let i = 3; i < alphaData.length; i += 4) alphaData[i] = 255;
    mocked.getStructureSliceDebugAlphaMap.mockReturnValue({
      width: 64,
      height: 128,
      data: alphaData,
    });

    const built = buildRuntimeStructureTriangleDebugPieces(
      { x: 0, y: 0, w: 64, h: 128 },
      1,
      64,
      "structure_3",
      2,
      {} as CanvasImageSource,
      { x: 0, y: 0, w: 64, h: 128 },
    );

    expect(built.stats.beforeCull).toBeGreaterThan(0);
    expect(built.stats.afterCull).toBe(built.stats.beforeCull);
    expect(built.pieces.length).toBe(built.stats.beforeCull);
  });
});
