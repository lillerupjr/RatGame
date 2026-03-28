import { describe, expect, it } from "vitest";
import { createRenderWorld } from "../../../../engine/render/creator/renderWorldCreator";
import type { RenderExecutionPlan } from "../../../../game/systems/presentation/backend/renderExecutionPlan";
import type { RenderCommand } from "../../../../game/systems/presentation/contracts/renderCommands";
import { KindOrder } from "../../../../game/systems/presentation/worldRenderOrdering";

function makeQuadCommand(input: {
  semanticFamily: "groundSurface" | "groundDecal" | "worldSprite";
  stableId: number;
  payload?: Record<string, unknown>;
}): RenderCommand {
  return {
    pass: "WORLD",
    key: {
      slice: 0,
      within: 0,
      baseZ: 0,
      kindOrder: input.semanticFamily === "worldSprite" ? KindOrder.ENTITY : KindOrder.FLOOR,
      stableId: input.stableId,
    },
    semanticFamily: input.semanticFamily,
    finalForm: "quad",
    payload: {
      image: { width: 32, height: 32 } as any,
      sx: 0,
      sy: 0,
      sw: 32,
      sh: 32,
      dx: 10,
      dy: 20,
      dw: 32,
      dh: 32,
      alpha: 1,
      ...(input.payload ?? {}),
    } as any,
  };
}

describe("renderWorldCreator", () => {
  it("partitions the mixed execution plan into static world quads, dynamic rects, auxiliary, and screen outputs", () => {
    const plan: RenderExecutionPlan = {
      world: [
        makeQuadCommand({ semanticFamily: "groundSurface", stableId: 1 }),
        makeQuadCommand({ semanticFamily: "worldSprite", stableId: 2, payload: { auditFamily: "structures", kind: "rect" } }),
        makeQuadCommand({ semanticFamily: "worldSprite", stableId: 3, payload: { enemyIndex: 7 } }),
        {
          pass: "WORLD",
          key: {
            slice: 0,
            within: 0,
            baseZ: 0,
            kindOrder: KindOrder.VFX,
            stableId: 4,
          },
          semanticFamily: "worldPrimitive",
          finalForm: "primitive",
          payload: {
            zoneKind: 1,
          },
        },
      ],
      screen: [
        {
          pass: "SCREEN",
          key: {
            slice: 0,
            within: 0,
            baseZ: 0,
            kindOrder: KindOrder.OVERLAY,
            stableId: 5,
          },
          semanticFamily: "screenOverlay",
          finalForm: "quad",
          payload: {
            color: "#000",
            alpha: 0.25,
            width: 100,
            height: 100,
          },
        },
      ],
    };

    const created = createRenderWorld(plan);
    const groundPiece = created.orderedPieces[0];
    const structurePiece = created.orderedPieces[1];
    const dynamicPiece = created.orderedPieces[2];

    expect(created.orderedPieces).toHaveLength(3);
    expect(groundPiece.pieceType).toBe("static-world");
    expect(structurePiece.pieceType).toBe("static-world");
    expect(dynamicPiece.pieceType).toBe("dynamic-rect");
    if (groundPiece.pieceType !== "static-world" || structurePiece.pieceType !== "static-world") {
      throw new Error("Expected static world pieces");
    }
    expect(groundPiece.worldGeometry).toBe("iso");
    expect(structurePiece.worldGeometry).toBe("projected");
    expect(structurePiece.kind).toBe("rect");
    expect(created.auxiliaryWorldCommands).toHaveLength(1);
    expect(created.screenCommands).toHaveLength(1);
    expect(created.auditWorldCommands).toHaveLength(3);
  });

  it("normalizes image-backed dynamic rect pieces to explicit quad geometry", () => {
    const created = createRenderWorld({
      world: [
        makeQuadCommand({
          semanticFamily: "worldSprite",
          stableId: 10,
          payload: {
            projectileIndex: 1,
            rotationRad: Math.PI * 0.25,
            flipX: true,
            x0: undefined,
            y0: undefined,
            x1: undefined,
            y1: undefined,
            x2: undefined,
            y2: undefined,
            x3: undefined,
            y3: undefined,
          },
        }),
      ],
      screen: [],
    });

    const piece = created.orderedPieces[0];
    expect(piece.pieceType).toBe("dynamic-rect");
    expect(piece.x0).toBeTypeOf("number");
    expect(piece.y0).toBeTypeOf("number");
    expect(piece.x3).toBeTypeOf("number");
    expect(piece.y3).toBeTypeOf("number");
  });
});
