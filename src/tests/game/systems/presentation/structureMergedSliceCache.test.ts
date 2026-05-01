import { describe, expect, it, vi } from "vitest";
import {
  buildStructureMergedSliceCacheEntry,
  StructureMergedSliceCacheStore,
} from "../../../../game/systems/presentation/structures/structureMergedSliceCache";

function installFakeRasterCanvas(): { restore: () => void } {
  const previousDocument = (globalThis as { document?: Document }).document;
  (globalThis as { document?: Document }).document = {
    createElement: vi.fn((tagName: string) => {
      if (tagName !== "canvas") throw new Error(`Unexpected element tag: ${tagName}`);
      const ctx = {
        globalAlpha: 1,
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        clip: vi.fn(),
        transform: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      return {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ctx),
      } as unknown as HTMLCanvasElement;
    }),
  } as unknown as Document;
  return {
    restore: () => {
      (globalThis as { document?: Document }).document = previousDocument;
    },
  };
}

describe("structureMergedSliceCache", () => {
  it("rasterizes merged slice quads into one stable canvas entry", () => {
    const { restore } = installFakeRasterCanvas();
    try {
      const image = { width: 128, height: 32, id: "atlas-page" } as unknown as CanvasImageSource;
      const entry = buildStructureMergedSliceCacheEntry({
        structureInstanceId: "structure-a",
        groupStableId: 7,
        geometrySignature: "geom-a",
        sourceFrameKey: "atlas:structures/a:0:0:128:32",
        triangleCount: 4,
        quads: [
          {
            image,
            sx: 0,
            sy: 0,
            sw: 64,
            sh: 32,
            x0: 10,
            y0: 20,
            x1: 74,
            y1: 20,
            x2: 74,
            y2: 52,
            x3: 10,
            y3: 52,
          },
          {
            image,
            sx: 64,
            sy: 0,
            sw: 64,
            sh: 32,
            x0: 74,
            y0: 20,
            x1: 138,
            y1: 20,
            x2: 138,
            y2: 52,
            x3: 74,
            y3: 52,
          },
        ],
      });

      expect(entry).not.toBeNull();
      expect(entry?.bounds).toEqual({ x: 10, y: 20, w: 128, h: 32 });
      expect(entry?.quadCount).toBe(2);
      expect(entry?.triangleCount).toBe(4);
      expect(entry?.approxBytes).toBe(128 * 32 * 4);
      expect(entry?.canvas.width).toBe(128);
      expect(entry?.canvas.height).toBe(32);
    } finally {
      restore();
    }
  });

  it("reuses only cache entries with matching geometry and source identity", () => {
    const store = new StructureMergedSliceCacheStore();
    store.resetIfContextChanged("map:alpha||atlas:1");
    store.set({
      structureInstanceId: "structure-a",
      groupStableId: 3,
      geometrySignature: "geom-a",
      sourceFrameKey: "frame-a",
      canvas: { width: 64, height: 32 } as HTMLCanvasElement,
      bounds: { x: 5, y: 7, w: 64, h: 32 },
      quadCount: 2,
      triangleCount: 4,
      approxBytes: 64 * 32 * 4,
    });

    expect(store.get({
      structureInstanceId: "structure-a",
      groupStableId: 3,
      expectedGeometrySignature: "geom-a",
      expectedSourceFrameKey: "frame-a",
    })?.quadCount).toBe(2);
    expect(store.get({
      structureInstanceId: "structure-a",
      groupStableId: 3,
      expectedGeometrySignature: "geom-b",
      expectedSourceFrameKey: "frame-a",
    })).toBeUndefined();
    expect(store.get({
      structureInstanceId: "structure-a",
      groupStableId: 3,
      expectedGeometrySignature: "geom-a",
      expectedSourceFrameKey: "frame-a",
    })).toBeUndefined();
  });

  it("clears entries and reports cache metrics when the render context changes", () => {
    const store = new StructureMergedSliceCacheStore();
    store.resetIfContextChanged("map:alpha||atlas:1");
    store.set({
      structureInstanceId: "structure-a",
      groupStableId: 11,
      geometrySignature: "geom-a",
      sourceFrameKey: "frame-a",
      canvas: { width: 32, height: 16 } as HTMLCanvasElement,
      bounds: { x: 0, y: 0, w: 32, h: 16 },
      quadCount: 2,
      triangleCount: 4,
      approxBytes: 32 * 16 * 4,
    });

    expect(store.getDebugCacheMetrics().entryCount).toBe(1);
    expect(store.getDebugCacheMetrics().approxBytes).toBe(32 * 16 * 4);

    expect(store.resetIfContextChanged("map:beta||atlas:2")).toBe(true);
    expect(store.getDebugCacheMetrics().entryCount).toBe(0);
    expect(store.getDebugCacheMetrics().contextKey).toBe("map:beta||atlas:2");
  });
});
