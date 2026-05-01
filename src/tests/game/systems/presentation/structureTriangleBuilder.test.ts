import { describe, expect, it } from "vitest";
import {
  buildMonolithicSliceGeometry,
  cullMonolithicTrianglesByAlphaWithDiagnostics,
} from "../../../../game/structures/buildMonolithicDebugSliceTriangles";

describe("buildMonolithicDebugSliceTriangles", () => {
  it("is deterministic for a fixed slice + anchor", () => {
    const slice = { x: 64, width: 64, height: 192 };
    const anchor = { x: 96, y: 160 };

    const first = buildMonolithicSliceGeometry(slice, anchor);
    const second = buildMonolithicSliceGeometry(slice, anchor);

    expect(second).toEqual(first);
    expect(first.triangles.length).toBeGreaterThan(0);
  });

  it("culls all triangles when alpha map is fully transparent", () => {
    const slice = { x: 0, width: 64, height: 128 };
    const geometry = buildMonolithicSliceGeometry(slice, { x: 32, y: 120 });
    const alphaMap = {
      width: 64,
      height: 128,
      data: new Uint8ClampedArray(64 * 128 * 4),
    };

    const result = cullMonolithicTrianglesByAlphaWithDiagnostics({
      triangles: geometry.triangles,
      alphaMap,
      workRectSpriteLocal: { x: 0, y: 0, w: 64, h: 128 },
      workOffsetSpriteLocal: { x: 0, y: 0 },
      minVisiblePixels: 1,
      alphaThreshold: 1,
    });

    expect(result.samples.length).toBeGreaterThan(0);
    expect(result.keptTriangles).toHaveLength(0);
  });

  it("keeps triangles when alpha map is fully opaque", () => {
    const slice = { x: 0, width: 64, height: 128 };
    const geometry = buildMonolithicSliceGeometry(slice, { x: 32, y: 120 });
    const alphaData = new Uint8ClampedArray(64 * 128 * 4);
    for (let i = 3; i < alphaData.length; i += 4) alphaData[i] = 255;

    const result = cullMonolithicTrianglesByAlphaWithDiagnostics({
      triangles: geometry.triangles,
      alphaMap: {
        width: 64,
        height: 128,
        data: alphaData,
      },
      workRectSpriteLocal: { x: 0, y: 0, w: 64, h: 128 },
      workOffsetSpriteLocal: { x: 0, y: 0 },
      minVisiblePixels: 1,
      alphaThreshold: 1,
    });

    expect(result.keptTriangles.length).toBe(geometry.triangles.length);
  });
});
