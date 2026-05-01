import { describe, expect, it } from "vitest";
import type {
  RuntimeStructureParentTileGroup,
  RuntimeStructureTriangleCache,
  RuntimeStructureTrianglePiece,
} from "../../../../game/structures/monolithicStructureGeometry";
import {
  applyRuntimeStructureTriangleSemanticInfoMap,
  buildRuntimeStructureTriangleSemanticInfoMap,
  buildRuntimeStructureTriangleSemanticMap,
  classifyRuntimeStructureTriangleSemantic,
} from "../../../../game/systems/presentation/structureShadows/structureTriangleSemantics";
import { STRUCTURE_TRIANGLE_HEIGHT_STEP_PX } from "../../../../game/structures/monolithicBuildingSemanticPrepass";

function makeTriangle(input: {
  stableId: number;
  bandIndex: number;
  centroidX: number;
  centroidY: number;
  parentTx?: number;
  parentTy?: number;
  semanticSide?: RuntimeStructureTrianglePiece["semanticSide"];
}): RuntimeStructureTrianglePiece {
  const parentTx = input.parentTx ?? 0;
  const parentTy = input.parentTy ?? 0;
  const a = { x: input.centroidX - 6, y: input.centroidY + 4 };
  const b = { x: input.centroidX + 6, y: input.centroidY + 4 };
  const c = { x: input.centroidX, y: input.centroidY - 8 };
  return {
    structureInstanceId: "structure",
    stableId: input.stableId,
    sliceIndex: 0,
    bandIndex: input.bandIndex,
    points: [a, b, c],
    srcPoints: [a, b, c],
    basePoint: { x: input.centroidX, y: input.centroidY },
    feetSortY: input.centroidY,
    ownerTx: parentTx,
    ownerTy: parentTy,
    admissionTx: parentTx,
    admissionTy: parentTy,
    parentTx,
    parentTy,
    triangleTx: parentTx,
    triangleTy: parentTy,
    cameraTx: parentTx,
    cameraTy: parentTy,
    semanticSide: input.semanticSide,
    semanticFace: "UP",
    semanticRole: "STRUCTURAL",
    height: 0,
    heightFromParentLevel: 0,
    heightFromParentPx: 0,
    localBounds: { x: input.centroidX - 6, y: input.centroidY - 8, w: 12, h: 12 },
    srcRectLocal: { x: input.centroidX - 6, y: input.centroidY - 8, w: 12, h: 12 },
    dstRectLocal: { x: input.centroidX - 6, y: input.centroidY - 8, w: 12, h: 12 },
  };
}

function makeGroup(
  stableId: number,
  bandIndex: number,
  parentTx: number,
  parentTy: number,
  triangles: RuntimeStructureTrianglePiece[],
): RuntimeStructureParentTileGroup {
  return {
    structureInstanceId: "structure",
    sliceIndex: stableId,
    bandIndex,
    parentTx,
    parentTy,
    feetSortY: 0,
    triangles,
    localBounds: { x: 0, y: 0, w: 1, h: 1 },
    stableId,
  };
}

describe("structureTriangleSemantics", () => {
  it("promotes all roof-supported triangles to TOP instead of only the max band", () => {
    const triangles = [
      makeTriangle({ stableId: 1, bandIndex: 1, centroidX: 32, centroidY: -32, parentTx: 0, parentTy: 0 }),
      makeTriangle({ stableId: 2, bandIndex: 2, centroidX: 96, centroidY: -32, parentTx: 1, parentTy: 0 }),
      makeTriangle({ stableId: 3, bandIndex: 1, centroidX: 32, centroidY: 32, parentTx: 0, parentTy: 1 }),
      makeTriangle({ stableId: 4, bandIndex: 2, centroidX: 96, centroidY: 32, parentTx: 1, parentTy: 1 }),
      makeTriangle({ stableId: 5, bandIndex: 0, centroidX: 32, centroidY: 96, parentTx: 0, parentTy: 1, semanticSide: "LEFT_SOUTH" }),
      makeTriangle({ stableId: 6, bandIndex: 0, centroidX: 96, centroidY: 96, parentTx: 1, parentTy: 1, semanticSide: "RIGHT_EAST" }),
    ];
    const cache: RuntimeStructureTriangleCache = {
      structureInstanceId: "structure",
      spriteId: "sprite",
      triangles,
      parentTileGroups: [
        makeGroup(1, 1, 0, 0, [triangles[0]]),
        makeGroup(2, 2, 1, 0, [triangles[1]]),
        makeGroup(3, 1, 0, 1, [triangles[2]]),
        makeGroup(4, 2, 1, 1, [triangles[3], triangles[5]]),
        makeGroup(5, 0, 0, 1, [triangles[4]]),
      ],
      geometrySignature: "semantic-map",
      maxSideHeightLevel: 0,
      maxSideHeightPx: 0,
      monolithic: null,
    };

    const semanticByStableId = buildRuntimeStructureTriangleSemanticMap({
      overlay: {
        id: "structure",
        spriteId: "sprite",
        seTx: 1,
        seTy: 1,
        z: 0,
        w: 2,
        h: 2,
        layerRole: "STRUCTURE",
      } as any,
      triangleCache: cache,
      tileWorld: 64,
      toScreenAtZ: (worldX, worldY) => ({ x: worldX, y: worldY }),
    });

    expect(semanticByStableId.get(1)).toBe("TOP");
    expect(semanticByStableId.get(2)).toBe("TOP");
    expect(semanticByStableId.get(3)).toBe("TOP");
    expect(semanticByStableId.get(4)).toBe("TOP");
    expect(semanticByStableId.get(5)).toBe("LEFT_SOUTH");
    expect(semanticByStableId.get(6)).toBe("RIGHT_EAST");
  });

  it("falls back to owner progression when a triangle has no slicer-authored side semantic", () => {
    const triangle = makeTriangle({
      stableId: 10,
      bandIndex: 3,
      centroidX: 32,
      centroidY: 96,
      parentTx: 1,
      parentTy: 0,
      semanticSide: undefined,
    });

    const semantic = classifyRuntimeStructureTriangleSemantic(triangle, {
      activeRoofQuad: null,
      leftSouthMaxProgression: 1,
      rightEastMinProgression: 2,
      progressionByOwnerTile: new Map([
        ["1,0", { min: 2, max: 2 }],
      ]),
    });

    expect(semantic).toBe("RIGHT_EAST");
  });

  it("marks side triangles after the first roof triangle in a slice as OVERHANG", () => {
    const triangles = [
      makeTriangle({ stableId: 1, bandIndex: 1, centroidX: 32, centroidY: -32, parentTx: 0, parentTy: 0 }),
      makeTriangle({ stableId: 2, bandIndex: 2, centroidX: 96, centroidY: -32, parentTx: 1, parentTy: 0 }),
      makeTriangle({ stableId: 3, bandIndex: 1, centroidX: 32, centroidY: 32, parentTx: 0, parentTy: 1 }),
      makeTriangle({ stableId: 4, bandIndex: 2, centroidX: 96, centroidY: 32, parentTx: 1, parentTy: 1 }),
      makeTriangle({ stableId: 5, bandIndex: 0, centroidX: 32, centroidY: 96, parentTx: 0, parentTy: 1, semanticSide: "LEFT_SOUTH" }),
      makeTriangle({ stableId: 6, bandIndex: 0, centroidX: 96, centroidY: 96, parentTx: 1, parentTy: 1, semanticSide: "RIGHT_EAST" }),
      makeTriangle({ stableId: 7, bandIndex: 3, centroidX: 160, centroidY: -96, parentTx: 1, parentTy: 0, semanticSide: "RIGHT_EAST" }),
    ];
    triangles[4].heightFromParentLevel = 2;
    triangles[4].heightFromParentPx = 2 * STRUCTURE_TRIANGLE_HEIGHT_STEP_PX;
    triangles[4].height = 2;
    triangles[5].heightFromParentLevel = 2;
    triangles[5].heightFromParentPx = 2 * STRUCTURE_TRIANGLE_HEIGHT_STEP_PX;
    triangles[5].height = 2;
    triangles[6].heightFromParentLevel = 5;
    triangles[6].heightFromParentPx = 5 * STRUCTURE_TRIANGLE_HEIGHT_STEP_PX;
    triangles[6].height = 5;

    const cache: RuntimeStructureTriangleCache = {
      structureInstanceId: "structure",
      spriteId: "sprite",
      triangles,
      parentTileGroups: [
        makeGroup(1, 1, 0, 0, [triangles[0]]),
        makeGroup(2, 2, 1, 0, [triangles[1]]),
        makeGroup(3, 1, 0, 1, [triangles[2]]),
        makeGroup(4, 2, 1, 1, [triangles[3]]),
        makeGroup(5, 0, 0, 1, [triangles[4]]),
        makeGroup(6, 0, 1, 1, [triangles[5]]),
        makeGroup(7, 3, 1, 0, [triangles[6]]),
      ],
      geometrySignature: "semantic-role",
      maxSideHeightLevel: 5,
      maxSideHeightPx: 5 * STRUCTURE_TRIANGLE_HEIGHT_STEP_PX,
      monolithic: null,
    };

    const semanticInfoByStableId = buildRuntimeStructureTriangleSemanticInfoMap({
      overlay: {
        id: "structure",
        spriteId: "sprite",
        seTx: 1,
        seTy: 1,
        z: 0,
        w: 2,
        h: 2,
        layerRole: "STRUCTURE",
      } as any,
      triangleCache: cache,
      tileWorld: 64,
      toScreenAtZ: (worldX, worldY) => ({ x: worldX, y: worldY }),
      triangles,
    });

    expect(semanticInfoByStableId.get(5)).toEqual(expect.objectContaining({
      semanticFace: "SOUTH",
      semanticRole: "STRUCTURAL",
    }));
    expect(semanticInfoByStableId.get(1)).toEqual(expect.objectContaining({
      semanticFace: "UP",
      semanticRole: "STRUCTURAL",
    }));
    expect(semanticInfoByStableId.get(7)).toEqual(expect.objectContaining({
      semanticFace: "EAST",
      semanticRole: "OVERHANG",
    }));

    applyRuntimeStructureTriangleSemanticInfoMap(cache, semanticInfoByStableId);

    expect(cache.maxSideHeightLevel).toBe(2);
    expect(cache.maxSideHeightPx).toBe(2 * STRUCTURE_TRIANGLE_HEIGHT_STEP_PX);
    expect(triangles[6].semanticRole).toBe("OVERHANG");
    expect(triangles[6].semanticFace).toBe("EAST");
  });
});
