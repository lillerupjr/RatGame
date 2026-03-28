import { describe, expect, it } from "vitest";
import { analyzeWorldBatchStream } from "../../../../game/systems/presentation/debug/worldBatchAudit";
import type { RenderCommand } from "../../../../game/systems/presentation/contracts/renderCommands";

function makeWorldQuadCommand(
  image: object,
  stableId: number,
  payloadOverrides: Record<string, unknown> = {},
): RenderCommand {
  return {
    pass: "WORLD",
    key: {
      slice: stableId,
      within: stableId,
      baseZ: 0,
      kindOrder: 0 as any,
      stableId,
    },
    semanticFamily: "worldSprite",
    finalForm: "quad",
    payload: {
      auditFamily: "structures",
      image: image as any,
      sx: 0,
      sy: 0,
      sw: 64,
      sh: 64,
      x0: 0,
      y0: 0,
      x1: 64,
      y1: 0,
      x2: 64,
      y2: 64,
      x3: 0,
      y3: 64,
      ...payloadOverrides,
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
    finalForm: "quad",
    payload: {
      image: {} as any,
      sx: 0,
      sy: 0,
      sw: 64,
      sh: 64,
      x0: 0,
      y0: 0,
      x1: 64,
      y1: 0,
      x2: 64,
      y2: 64,
      x3: 0,
      y3: 64,
      kind: "iso",
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

function makeDropSpriteCommand(image: object, stableId: number): RenderCommand {
  return {
    pass: "WORLD",
    key: {
      slice: stableId,
      within: stableId,
      baseZ: 0,
      kindOrder: 0 as any,
      stableId,
    },
    semanticFamily: "worldSprite",
    finalForm: "quad",
    payload: {
      image: image as any,
      sx: 0,
      sy: 0,
      sw: 16,
      sh: 16,
      dx: 0,
      dy: 0,
      dw: 16,
      dh: 16,
      pickupIndex: stableId,
      pickupKind: 1,
    },
  };
}

function makeStructureQuadCommand(image: object, stableId: number): RenderCommand {
  return {
    pass: "WORLD",
    key: {
      slice: stableId,
      within: stableId,
      baseZ: 0,
      kindOrder: 0 as any,
      stableId,
    },
    semanticFamily: "worldSprite",
    finalForm: "quad",
    payload: {
      auditFamily: "structures",
      image: image as any,
      sx: 0,
      sy: 0,
      sw: 16,
      sh: 16,
      x0: 0,
      y0: 0,
      x1: 16,
      y1: 0,
      x2: 16,
      y2: 16,
      x3: 0,
      y3: 16,
    },
  };
}

describe("analyzeWorldBatchStream", () => {
  it("ignores non-WORLD commands and recognizes compatible textured continuations", () => {
    const sharedTexture = { id: "shared" };
    const audit = analyzeWorldBatchStream([
      makeGroundCommand(1),
      makeWorldQuadCommand(sharedTexture, 2),
      makeWorldQuadCommand(sharedTexture, 3),
    ], "webgl");

    expect(audit.totalWorldCommands).toBe(2);
    expect(audit.totalWorldBatches).toBe(1);
    expect(audit.compatibleContinuations).toBe(1);
    expect(audit.breakReasonCounts["compatible continuation"]).toBe(1);
    expect(audit.runLengths.averageTextureRun).toBe(2);
    expect(audit.runLengths.maxCompatibleRun).toBe(2);
    expect(audit.familySummaries[0]).toMatchObject({
      family: "structures",
      commands: 2,
      batches: 1,
      uniqueTextures: 1,
    });
  });

  it("classifies backend-path changes as batch breaks", () => {
    const audit = analyzeWorldBatchStream([
      makeWorldQuadCommand({ id: "a" }, 1),
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

  it("classifies direct-image pickup quads as drops", () => {
    const sharedTexture = { id: "shared-drop-atlas" };
    const audit = analyzeWorldBatchStream([
      makeDropSpriteCommand(sharedTexture, 1),
      makeDropSpriteCommand(sharedTexture, 2),
    ], "webgl");

    expect(audit.totalWorldBatches).toBe(1);
    expect(audit.familySummaries[0]).toMatchObject({
      family: "drops",
      commands: 2,
      batches: 1,
      uniqueTextures: 1,
    });
  });

  it("reports structure-atlased world geometry under the structures family", () => {
    const sharedTexture = { id: "structure-atlas" };
    const audit = analyzeWorldBatchStream([
      makeWorldQuadCommand(sharedTexture, 1),
      makeWorldQuadCommand(sharedTexture, 2),
    ], "webgl");

    expect(audit.totalWorldBatches).toBe(1);
    expect(audit.familySummaries[0]).toMatchObject({
      family: "structures",
      commands: 2,
      batches: 1,
      uniqueTextures: 1,
    });
  });

  it("reports structure-tagged world quads under the structures family", () => {
    const sharedTexture = { id: "structure-quad-atlas" };
    const audit = analyzeWorldBatchStream([
      makeStructureQuadCommand(sharedTexture, 1),
      makeStructureQuadCommand(sharedTexture, 2),
    ], "webgl");

    expect(audit.totalWorldBatches).toBe(1);
    expect(audit.familySummaries[0]).toMatchObject({
      family: "structures",
      commands: 2,
      batches: 1,
      uniqueTextures: 1,
    });
  });

  it("reports local reorder probe improvements and visual risk counts", () => {
    const texA = { id: "A" };
    const texB = { id: "B" };
    const audit = analyzeWorldBatchStream([
      makeDropSpriteCommand(texA, 1),
      makeDropSpriteCommand(texB, 2),
      makeDropSpriteCommand(texA, 3),
      makeDropSpriteCommand(texB, 4),
    ], "webgl");

    const probe4 = audit.reorderProbes.find((probe) => probe.windowSize === 4);
    expect(probe4).toBeTruthy();
    expect(probe4?.totalWorldBatches).toBeLessThan(audit.totalWorldBatches);
    expect(probe4?.textureBreaks).toBeLessThan(audit.breakReasonCounts["texture changed"]);
    expect(probe4?.riskCount).toBeGreaterThan(0);
  });
});
