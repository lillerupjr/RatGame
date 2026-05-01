import { describe, expect, it } from "vitest";
import {
  buildDiamondSourceQuad,
  buildFlatTileDestinationQuad,
  buildProjectedSurfacePayload,
  buildRectQuadPayload,
  resolveTriangleCutoutAlpha,
} from "../../../../game/systems/presentation/renderCommandGeometry";

describe("renderCommandGeometry", () => {
  it("builds projected surfaces as iso quads with diamond source sampling", () => {
    const payload = buildProjectedSurfacePayload({
      image: { width: 128, height: 64 } as any,
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
    });

    expect(payload.kind).toBe("iso");
    expect(payload.alpha).toBe(1);
    expect(payload.sx).toBe(0);
    expect(payload.sy).toBe(0);
    expect(payload.sw).toBe(128);
    expect(payload.sh).toBe(64);
    expect(payload.sourceQuad).toEqual(buildDiamondSourceQuad(128, 64));
    expect(payload.x0).toEqual(0);
    expect(payload.y0).toEqual(-32);
    expect(payload.x3).toEqual(0);
    expect(payload.y3).toEqual(32);
  });

  it("normalizes draw rectangles into rect quads and resolves flipX in source metadata", () => {
    const payload = buildRectQuadPayload({
      image: { width: 16, height: 16 } as any,
      dx: 5,
      dy: 7,
      dw: 16,
      dh: 8,
      flipX: true,
    });

    expect(payload.kind).toBe("rect");
    expect(payload.sx).toBe(0);
    expect(payload.sy).toBe(0);
    expect(payload.sw).toBe(16);
    expect(payload.sh).toBe(16);
    expect(payload.sourceQuad).toEqual({
      nw: { x: 16, y: 0 },
      ne: { x: 0, y: 0 },
      se: { x: 0, y: 16 },
      sw: { x: 16, y: 16 },
    });
    expect(payload.flipX).toBe(true);
    expect(payload.x0).toEqual(5);
    expect(payload.y0).toEqual(7);
    expect(payload.x1).toEqual(21);
    expect(payload.y2).toEqual(15);
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
