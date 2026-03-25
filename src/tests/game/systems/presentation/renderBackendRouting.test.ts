import { describe, expect, it } from "vitest";
import {
  buildBackendSegments,
  buildPureWebGLCommandList,
  createBackendStats,
} from "../../../../game/systems/presentation/backend/renderBackendRouting";
import { getRenderCapabilityMatrix } from "../../../../game/systems/presentation/backend/renderCapabilityMatrix";
import { getStageDDeferredFamilyMatrix } from "../../../../game/systems/presentation/backend/renderDeferredFamilyMatrix";
import type { RenderCommand } from "../../../../game/systems/presentation/contracts/renderCommands";
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

function command(stableId: number, kind: RenderCommand["kind"], data: Record<string, unknown>): RenderCommand {
  return {
    pass: "WORLD",
    key: key(stableId),
    kind,
    data: {
      variant: "test",
      ...data,
    },
  };
}

describe("buildBackendSegments", () => {
  it("exposes explicit Stage D capability and deferred-family matrices", () => {
    const matrix = getRenderCapabilityMatrix();
    const deferred = getStageDDeferredFamilyMatrix();

    expect(matrix["primitive:zoneEffect"]?.status).toBe("WEBGL_READY");
    expect(matrix["overlay:screenTint"]?.status).toBe("WEBGL_READY");
    expect(matrix["overlay:ambientDarkness"]?.status).toBe("WEBGL_READY");
    expect(matrix["light:projectedLight"]?.status).toBe("WEBGL_READY");
    expect(matrix["triangle:structureTriangleGroup"]?.status).toBe("WEBGL_READY");
    expect(
      deferred.find((entry) => entry.family === "triangle:structureTriangleGroup"),
    ).toMatchObject({
      disposition: "PORT_STAGE_D_NOW",
    });
    expect(
      deferred.find((entry) => entry.family === "debug:debugPass"),
    ).toMatchObject({
      disposition: "DEFER_STAGE_E",
    });
  });

  it("routes supported commands to WebGL, fallbacks to Canvas, and skips unsupported without duplicates", () => {
    const img = { width: 16, height: 16 } as any;
    const stats = createBackendStats("webgl");
    const segments = buildBackendSegments([
      command(1, "sprite", { variant: "imageSprite", image: img, dx: 0, dy: 0, dw: 16, dh: 16 }),
      command(2, "primitive", { variant: "zoneEffect", zoneKind: 1 }),
      command(5, "primitive", { variant: "zoneEffect", zoneKind: 2 }),
      command(6, "overlay", { variant: "screenTint", width: 10, height: 10, color: "#000", alpha: 0.5 }),
      command(7, "overlay", { variant: "ambientDarkness", width: 10, height: 10, darknessAlpha: 0.4 }),
      command(8, "light", { variant: "projectedLight", lightPiece: { light: { projected: { sx: 1, sy: 2, intensity: 0.5, occlusion: 0, radiusPx: 16, shape: "RADIAL", color: "#fff", tintStrength: 0.25, flicker: { kind: "NONE" }, flickerPhase: 0 } } } }),
      command(9, "overlay", { variant: "structureOverlay", piece: { draw: { img, dx: 1, dy: 2, dw: 3, dh: 4 } } }),
      command(10, "triangle", {
        variant: "structureTriangleGroup",
        image: img,
        drawWidth: 16,
        drawHeight: 16,
        finalVisibleTriangles: [
          {
            stableId: 100,
            srcPoints: [{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 0, y: 16 }],
            points: [{ x: 1, y: 1 }, { x: 17, y: 1 }, { x: 1, y: 17 }],
          },
        ],
        compareDistanceOnlyStableIds: [],
      }),
      command(11, "triangle", {
        variant: "structureTriangleGroup",
        image: img,
        drawWidth: 16,
        drawHeight: 16,
        finalVisibleTriangles: [
          {
            stableId: 101,
            srcPoints: [{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 0, y: 16 }],
            points: [{ x: 2, y: 2 }, { x: 18, y: 2 }, { x: 2, y: 18 }],
          },
        ],
        compareDistanceOnlyStableIds: [101],
      }),
      command(3, "sprite", { variant: "imageSprite", dx: 0, dy: 0, dw: 16, dh: 16 }),
      command(4, "sprite", { variant: "renderPieceSprite", draw: { img, dx: 2, dy: 3, dw: 8, dh: 9 } }),
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
    expect(stats.unsupportedVariants).toEqual(["sprite:imageSprite"]);
    expect(stats.webglByFamily["overlay:screenTint"]).toBe(1);
    expect(stats.webglByFamily["overlay:ambientDarkness"]).toBe(1);
    expect(stats.webglByFamily["light:projectedLight"]).toBe(1);
    expect(stats.webglByFamily["overlay:structureOverlay"]).toBe(1);
    expect(stats.webglByFamily["triangle:structureTriangleGroup"]).toBe(1);
    expect(stats.canvasFallbackByFamily["triangle:structureTriangleGroup"]).toBe(1);
    expect(stats.canvasFallbackByFamily["primitive:zoneEffect"]).toBe(1);
    expect(stats.partiallyHandledFamilies).toContain("primitive:zoneEffect");
    expect(stats.partiallyHandledFamilies).toContain("triangle:structureTriangleGroup");
  });

  it("keeps WebGL mode pure by marking non-WebGL families unsupported instead of routing them to Canvas", () => {
    const img = { width: 16, height: 16 } as any;
    const stats = createBackendStats("webgl");
    const commands = buildPureWebGLCommandList([
      command(1, "sprite", { variant: "imageSprite", image: img, dx: 0, dy: 0, dw: 16, dh: 16 }),
      command(2, "primitive", { variant: "zoneEffect", zoneKind: 1 }),
      command(3, "primitive", { variant: "zoneEffect", zoneKind: 2 }),
      command(4, "debug", { variant: "debugPass", phase: "world", input: {} }),
      command(5, "overlay", { variant: "sweepShadowMap", sweepShadowMap: { originTx: 0, originTy: 0, width: 1, height: 1, data: new Float32Array([1]) } }),
    ], stats);

    expect(commands.map((entry) => entry.key.stableId)).toEqual([1, 2]);
    expect(stats.webglCommandCount).toBe(2);
    expect(stats.canvasFallbackCommandCount).toBe(0);
    expect(stats.unsupportedCommandCount).toBe(3);
    expect(stats.unsupportedVariants).toEqual([
      "primitive:zoneEffect",
      "debug:debugPass",
      "overlay:sweepShadowMap",
    ]);
    expect(stats.unsupportedByKind).toMatchObject({
      primitive: 1,
      debug: 1,
      overlay: 1,
    });
  });

  it("routes flat ground top/decal variants to WebGL while keeping projected/ramp subvariants unsupported in pure WebGL mode", () => {
    const img = { width: 32, height: 16 } as any;
    const stats = createBackendStats("webgl");
    const commands = buildPureWebGLCommandList([
      {
        pass: "GROUND",
        key: key(20),
        kind: "decal",
        data: { variant: "imageTop", mode: "flat", image: img, dx: 1, dy: 2, dw: 32, dh: 16 },
      },
      {
        pass: "GROUND",
        key: key(21),
        kind: "decal",
        data: { variant: "runtimeSidewalkTop", mode: "flat", image: img, dx: 2, dy: 3, dw: 32, dh: 16 },
      },
      {
        pass: "GROUND",
        key: key(22),
        kind: "decal",
        data: { variant: "runtimeDecalTop", mode: "flat", image: img, dx: 3, dy: 4, dw: 32, dh: 16 },
      },
      {
        pass: "GROUND",
        key: key(23),
        kind: "decal",
        data: {
          variant: "imageTop",
          mode: "oceanProjected",
          image: img,
          sourceWidth: 32,
          sourceHeight: 16,
          finalVisibleTriangles: [
            {
              srcPoints: [{ x: 0, y: 0 }, { x: 32, y: 0 }, { x: 0, y: 16 }],
              points: [{ x: 0, y: 0 }, { x: 32, y: 0 }, { x: 0, y: 16 }],
            },
          ],
        },
      },
      {
        pass: "GROUND",
        key: key(24),
        kind: "decal",
        data: {
          variant: "runtimeSidewalkTop",
          mode: "projected",
          image: img,
          sourceWidth: 32,
          sourceHeight: 16,
          finalVisibleTriangles: [
            {
              srcPoints: [{ x: 0, y: 0 }, { x: 32, y: 0 }, { x: 0, y: 16 }],
              points: [{ x: 0, y: 0 }, { x: 32, y: 0 }, { x: 0, y: 16 }],
            },
          ],
        },
      },
      {
        pass: "GROUND",
        key: key(25),
        kind: "decal",
        data: { variant: "runtimeDecalTop", mode: "projected", tx: 0, ty: 0, zBase: 0, renderAnchorY: 1, setId: "lane_dashed_yellow", variantIndex: 0, rotationQuarterTurns: 0 },
      },
    ], stats);

    expect(commands.map((entry) => entry.key.stableId)).toEqual([20, 21, 22, 23, 24]);
    expect(stats.webglGroundCommandCount).toBe(5);
    expect(stats.unsupportedGroundCommandCount).toBe(1);
    expect(stats.unsupportedVariants).toEqual([
      "decal:runtimeDecalTop",
    ]);
  });
});
