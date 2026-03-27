import { describe, expect, it } from "vitest";
import { StructureShadowV6CacheStore } from "../../../../game/systems/presentation/structureShadows/structureShadowV6Cache";

describe("StructureShadowV6CacheStore", () => {
  it("reports cache metrics for hits misses inserts clears and retained canvas bytes", () => {
    const store = new StructureShadowV6CacheStore();
    store.beginFrame("map:a", "sun:1");
    expect(
      store.get({
        structureInstanceId: "building:a",
        expectedGeometrySignature: "geom:a",
        expectedSunStepKey: "sun:1",
        expectedSliceCount: 4,
        expectedIncludeVertical: true,
        expectedIncludeTop: true,
      }),
    ).toBeUndefined();

    store.set({
      structureInstanceId: "building:a",
      geometrySignature: "geom:a",
      sunStepKey: "sun:1",
      requestedSliceCount: 4,
      includeVertical: true,
      includeTop: true,
      mergedShadowMask: {
        mergedVerticalShadowCanvas: { width: 32, height: 16 } as HTMLCanvasElement,
        bucketAShadow: null,
        bucketBShadow: null,
        topShadow: null,
      } as any,
    });
    store.markFullyPopulatedForKey("map:a|sun:1");

    expect(
      store.get({
        structureInstanceId: "building:a",
        expectedGeometrySignature: "geom:a",
        expectedSunStepKey: "sun:1",
        expectedSliceCount: 4,
        expectedIncludeVertical: true,
        expectedIncludeTop: true,
      }),
    ).toBeDefined();

    store.beginFrame("map:a", "sun:2");

    const metrics = store.getDebugCacheMetrics();
    expect(metrics).toMatchObject({
      name: "structureShadowMasks",
      hits: 1,
      misses: 1,
      inserts: 1,
    });
    expect(metrics.clears).toBeGreaterThan(0);
    expect(metrics.approxBytes === null || metrics.approxBytes >= 32 * 16 * 4).toBe(true);
  });
});
