import { describe, expect, it } from "vitest";
import { analyzeWorldBatchStream } from "../../../../game/systems/presentation/debug/worldBatchAudit";
import type { RenderCommand, RenderTrianglePoints } from "../../../../game/systems/presentation/contracts/renderCommands";

const TRIANGLE_POINTS: RenderTrianglePoints = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
];

function makeWorldGeometryCommand(image: object, stableId: number): RenderCommand {
  return {
    pass: "WORLD",
    key: {
      slice: stableId,
      within: stableId,
      baseZ: 0,
      kindOrder: 0 as any,
      stableId,
    },
    semanticFamily: "worldGeometry",
    finalForm: "triangles",
    payload: {
      image: image as any,
      sourceWidth: 64,
      sourceHeight: 64,
      triangles: [{
        srcPoints: TRIANGLE_POINTS,
        dstPoints: TRIANGLE_POINTS,
        alpha: 1,
      }],
    },
  };
}

function makeGroundCommand(stableId: number): RenderCommand {
  return {
    pass: "GROUND",
    key: {
      slice: stableId,
      within: stableId,
      baseZ: 0,
      kindOrder: 0 as any,
      stableId,
    },
    semanticFamily: "groundSurface",
    finalForm: "projectedSurface",
    payload: {
      image: {} as any,
      sourceWidth: 64,
      sourceHeight: 64,
      triangles: [{
        srcPoints: TRIANGLE_POINTS,
        dstPoints: TRIANGLE_POINTS,
        alpha: 1,
      }, {
        srcPoints: TRIANGLE_POINTS,
        dstPoints: TRIANGLE_POINTS,
        alpha: 1,
      }],
    },
  };
}

function makeDebugPrimitive(stableId: number): RenderCommand {
  return {
    pass: "WORLD",
    key: {
      slice: stableId,
      within: stableId,
      baseZ: 0,
      kindOrder: 0 as any,
      stableId,
    },
    semanticFamily: "debug",
    finalForm: "primitive",
    payload: {},
  };
}

describe("analyzeWorldBatchStream", () => {
  it("ignores non-WORLD commands and recognizes compatible textured continuations", () => {
    const sharedTexture = { id: "shared" };
    const audit = analyzeWorldBatchStream([
      makeGroundCommand(1),
      makeWorldGeometryCommand(sharedTexture, 2),
      makeWorldGeometryCommand(sharedTexture, 3),
    ], "webgl");

    expect(audit.totalWorldCommands).toBe(2);
    expect(audit.totalWorldBatches).toBe(1);
    expect(audit.compatibleContinuations).toBe(1);
    expect(audit.breakReasonCounts["compatible continuation"]).toBe(1);
    expect(audit.familySummaries[0]).toMatchObject({
      family: "triangles",
      commands: 2,
      batches: 1,
      uniqueTextures: 1,
    });
  });

  it("classifies backend-path changes as batch breaks", () => {
    const audit = analyzeWorldBatchStream([
      makeWorldGeometryCommand({ id: "a" }, 1),
      makeDebugPrimitive(2),
    ], "webgl");

    expect(audit.totalWorldBatches).toBe(2);
    expect(audit.totalBatchBreaks).toBe(1);
    expect(audit.breakReasonCounts["unsupported/fallback path changed"]).toBe(1);
    expect(audit.sampleBoundaries[0]).toMatchObject({
      index: 0,
      reason: "unsupported/fallback path changed",
    });
  });
});
