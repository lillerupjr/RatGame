import { describe, expect, it } from "vitest";
import {
  buildFlatTileDestinationQuad,
  buildProjectedSurfacePayload,
  buildTriangleMeshFromRect,
  resolveTriangleCutoutAlpha,
} from "../../../../game/systems/presentation/renderCommandGeometry";

describe("renderCommandGeometry", () => {
  it("builds projected surfaces as an explicit two-triangle payload", () => {
    const payload = buildProjectedSurfacePayload({
      image: { width: 128, height: 64 } as any,
      sourceWidth: 128,
      sourceHeight: 64,
      destinationQuad: buildFlatTileDestinationQuad({
        tx: 0,
        ty: 0,
        zBase: 0,
        renderAnchorY: 1,
        tileWorld: 64,
        elevPx: 16,
        isoHeight: 64,
        camX: 0,
        camY: 0,
        worldToScreen: (x, y) => ({ x, y }),
        snapPoint: (value) => value,
      }),
      stableId: 12,
    });

    expect(payload.triangles).toHaveLength(2);
    expect(payload.triangles[0].alpha).toBe(1);
    expect(payload.triangles[0].srcPoints[0]).toEqual({ x: 64, y: 0 });
    expect(payload.triangles[1].srcPoints[2]).toEqual({ x: 0, y: 32 });
    expect("dx" in payload).toBe(false);
    expect("family" in payload).toBe(false);
  });

  it("normalizes draw rectangles into triangle meshes and resolves flipX in source UVs", () => {
    const payload = buildTriangleMeshFromRect({
      image: { width: 16, height: 16 } as any,
      sourceWidth: 16,
      sourceHeight: 16,
      dx: 5,
      dy: 7,
      dw: 16,
      dh: 8,
      flipX: true,
      stableId: 4,
    });

    expect(payload.triangles).toHaveLength(2);
    expect(payload.triangles[0].srcPoints[0]).toEqual({ x: 16, y: 0 });
    expect(payload.triangles[0].srcPoints[1]).toEqual({ x: 0, y: 0 });
    expect(payload.triangles[0].dstPoints[0]).toEqual({ x: 5, y: 7 });
    expect(payload.triangles[0].dstPoints[1]).toEqual({ x: 21, y: 7 });
  });

  it("resolves cutout alpha in CPU space before backend execution", () => {
    const inside = resolveTriangleCutoutAlpha(
      [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 10, y: 20 }],
      {
        cutoutEnabled: true,
        cutoutAlpha: 0.45,
        buildingDirectionalEligible: true,
        groupParentAfterPlayer: true,
        cutoutScreenRect: {
          minX: 0,
          maxX: 30,
          minY: 0,
          maxY: 30,
        },
      },
    );
    const outside = resolveTriangleCutoutAlpha(
      [{ x: 40, y: 40 }, { x: 50, y: 40 }, { x: 40, y: 50 }],
      {
        cutoutEnabled: true,
        cutoutAlpha: 0.45,
        buildingDirectionalEligible: true,
        groupParentAfterPlayer: true,
        cutoutScreenRect: {
          minX: 0,
          maxX: 30,
          minY: 0,
          maxY: 30,
        },
      },
    );

    expect(inside).toBeCloseTo(0.45);
    expect(outside).toBe(1);
  });
});
