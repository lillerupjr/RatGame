import { describe, expect, it } from "vitest";
import {
  buildBackendSegments,
  buildPureWebGLCommandList,
  createBackendStats,
} from "../../../../game/systems/presentation/backend/renderBackendRouting";
import { getRenderCapabilityMatrix } from "../../../../game/systems/presentation/backend/renderCapabilityMatrix";
import { getStageDDeferredFamilyMatrix } from "../../../../game/systems/presentation/backend/renderDeferredFamilyMatrix";
import type { RenderCommand } from "../../../../game/systems/presentation/contracts/renderCommands";
import { ZONE_KIND } from "../../../../game/factories/zoneFactory";
import {
  buildProjectedSurfacePayload,
  buildRectQuadPayload,
} from "../../../../game/systems/presentation/renderCommandGeometry";
import { KindOrder, type RenderKey } from "../../../../game/systems/presentation/worldRenderOrdering";

function key(stableId: number): RenderKey {
  return {
    slice: 0,
    within: 0,
    baseZ: 0,
    kindOrder: KindOrder.ENTITY,
    stableId,
  };
}

function command(
  stableId: number,
  input: Omit<RenderCommand, "pass" | "key"> & { pass?: RenderCommand["pass"] },
): RenderCommand {
  return {
    pass: input.pass ?? "WORLD",
    key: key(stableId),
    ...input,
  } as RenderCommand;
}

function projectedSurfacePayload(image: any, width: number, height: number) {
  return buildProjectedSurfacePayload({
    image,
    destinationQuad: {
      nw: { x: 0, y: 0 },
      ne: { x: width, y: 0 },
      se: { x: width * 0.5, y: height },
      sw: { x: -width * 0.5, y: height },
    },
  });
}

describe("buildBackendSegments", () => {
  it("exposes explicit Stage D capability and deferred-family matrices", () => {
    const matrix = getRenderCapabilityMatrix();
    const deferred = getStageDDeferredFamilyMatrix();

    expect(matrix["worldPrimitive:primitive"]?.status).toBe("WEBGL_READY");
    expect(matrix["screenOverlay:quad"]?.status).toBe("WEBGL_READY");
    expect(matrix["screenOverlay:primitive"]?.status).toBe("WEBGL_READY");
    expect(matrix["groundSurface:quad"]?.status).toBe("WEBGL_READY");
    expect(
      deferred.find((entry) => entry.family === "groundSurface:quad"),
    ).toMatchObject({
      disposition: "PORT_STAGE_D_NOW",
    });
    expect(
      deferred.find((entry) => entry.family === "debug:primitive"),
    ).toMatchObject({
      disposition: "DEFER_STAGE_E",
    });
  });

  it("routes supported commands to WebGL, fallbacks to Canvas, and skips unsupported without duplicates", () => {
    const img = { width: 16, height: 16 } as any;
    const stats = createBackendStats("webgl");
    const segments = buildBackendSegments([
      command(1, {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: { image: img, dx: 0, dy: 0, dw: 16, dh: 16 },
      }),
      command(2, {
        semanticFamily: "worldPrimitive",
        finalForm: "primitive",
        payload: { zoneKind: ZONE_KIND.AURA },
      }),
      command(5, {
        semanticFamily: "worldPrimitive",
        finalForm: "primitive",
        payload: { zoneKind: ZONE_KIND.FIRE },
      }),
      command(6, {
        semanticFamily: "screenOverlay",
        finalForm: "quad",
        payload: { width: 10, height: 10, color: "#000", alpha: 0.5 },
      }),
      command(7, {
        semanticFamily: "screenOverlay",
        finalForm: "primitive",
        payload: { darknessAlpha: 0.4 },
      }),
      command(8, {
        semanticFamily: "worldPrimitive",
        finalForm: "primitive",
        payload: {
          lightPiece: {
            light: {
              projected: {
                sx: 1,
                sy: 2,
                intensity: 0.5,
                occlusion: 0,
                radiusPx: 16,
                shape: "RADIAL",
                color: "#fff",
                tintStrength: 0.25,
                flicker: { kind: "NONE" },
                flickerPhase: 0,
              },
            },
          },
        },
      }),
      command(9, {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: buildRectQuadPayload({
          image: img,
          dx: 1,
          dy: 2,
          dw: 3,
          dh: 4,
          auditFamily: "structures",
        }),
      }),
      command(10, {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: buildRectQuadPayload({
          image: img,
          dx: 1,
          dy: 1,
          dw: 16,
          dh: 16,
          auditFamily: "structures",
        }),
      }),
      command(11, {
        semanticFamily: "debug",
        finalForm: "primitive",
        payload: {
          triangleOverlay: [
            {
              points: [{ x: 2, y: 2 }, { x: 18, y: 2 }, { x: 2, y: 18 }],
              fillStyle: "rgba(255,120,40,0.28)",
              strokeStyle: "rgba(255,120,40,0.9)",
              lineWidth: 1,
            },
          ],
        },
      }),
      command(3, {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: {},
      }),
      command(4, {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: { draw: { img, dx: 2, dy: 3, dw: 8, dh: 9 } },
      }),
    ], stats);

    expect(segments.map((segment) => [segment.backend, segment.commands.map((command) => command.key.stableId)])).toEqual([
      ["webgl", [1, 2]],
      ["canvas2d", [5]],
      ["webgl", [6, 7, 8, 9, 10]],
      ["canvas2d", [11]],
      ["webgl", [4]],
    ]);
    expect(stats.webglCommandCount).toBe(8);
    expect(stats.canvasFallbackCommandCount).toBe(2);
    expect(stats.unsupportedCommandCount).toBe(1);
    expect(stats.unsupportedCommandKeys).toEqual(["worldSprite:quad"]);
    expect(stats.webglByAxes["screenOverlay:quad"]).toBe(1);
    expect(stats.webglByAxes["screenOverlay:primitive"]).toBe(1);
    expect(stats.webglByAxes["worldPrimitive:primitive"]).toBe(2);
    expect(stats.webglByAxes["worldSprite:quad"]).toBe(4);
    expect(stats.canvasFallbackByAxes["debug:primitive"]).toBe(1);
    expect(stats.canvasFallbackByAxes["worldPrimitive:primitive"]).toBe(1);
    expect(stats.partiallyHandledAxes).toContain("worldPrimitive:primitive");
    expect(stats.partiallyHandledAxes).toContain("worldSprite:quad");
  });

  it("keeps WebGL mode pure by marking non-WebGL families unsupported instead of routing them to Canvas", () => {
    const img = { width: 16, height: 16 } as any;
    const stats = createBackendStats("webgl");
    const commands = buildPureWebGLCommandList([
      command(1, {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: { image: img, dx: 0, dy: 0, dw: 16, dh: 16 },
      }),
      command(2, {
        semanticFamily: "worldPrimitive",
        finalForm: "primitive",
        payload: { zoneKind: ZONE_KIND.AURA },
      }),
      command(3, {
        semanticFamily: "worldPrimitive",
        finalForm: "primitive",
        payload: { zoneKind: ZONE_KIND.FIRE },
      }),
      command(4, {
        semanticFamily: "debug",
        finalForm: "primitive",
        payload: { phase: "world", input: {} },
      }),
      command(5, {
        semanticFamily: "screenOverlay",
        finalForm: "primitive",
        payload: {},
      }),
    ], stats);

    expect(commands.map((entry) => entry.key.stableId)).toEqual([1, 2]);
    expect(stats.webglCommandCount).toBe(2);
    expect(stats.canvasFallbackCommandCount).toBe(0);
    expect(stats.unsupportedCommandCount).toBe(3);
    expect(stats.unsupportedCommandKeys).toEqual([
      "worldPrimitive:primitive",
      "debug:primitive",
      "screenOverlay:primitive",
    ]);
    expect(stats.unsupportedBySemanticFamily).toMatchObject({
      worldPrimitive: 1,
      debug: 1,
      screenOverlay: 1,
    });
  });

  it("routes flat ground top/decal variants to WebGL while keeping projected/ramp subvariants unsupported in pure WebGL mode", () => {
    const img = { width: 32, height: 16 } as any;
    const stats = createBackendStats("webgl");
    const commands = buildPureWebGLCommandList([
      command(20, {
        pass: "GROUND",
        semanticFamily: "groundSurface",
        finalForm: "quad",
        payload: projectedSurfacePayload(img, 32, 16),
      }),
      command(21, {
        pass: "GROUND",
        semanticFamily: "groundSurface",
        finalForm: "quad",
        payload: projectedSurfacePayload(img, 32, 16),
      }),
      command(22, {
        pass: "GROUND",
        semanticFamily: "groundDecal",
        finalForm: "quad",
        payload: projectedSurfacePayload(img, 32, 16),
      }),
      command(23, {
        pass: "GROUND",
        semanticFamily: "groundSurface",
        finalForm: "quad",
        payload: projectedSurfacePayload(img, 32, 16),
      }),
      command(24, {
        pass: "GROUND",
        semanticFamily: "groundSurface",
        finalForm: "quad",
        payload: projectedSurfacePayload(img, 32, 16),
      }),
      command(25, {
        pass: "GROUND",
        semanticFamily: "groundDecal",
        finalForm: "quad",
        payload: {} as any,
      }),
    ], stats);

    expect(commands.map((entry) => entry.key.stableId)).toEqual([20, 21, 22, 23, 24]);
    expect(stats.webglGroundCommandCount).toBe(5);
    expect(stats.unsupportedGroundCommandCount).toBe(1);
    expect(stats.unsupportedCommandKeys).toEqual([
      "groundDecal:quad",
    ]);
  });
});
