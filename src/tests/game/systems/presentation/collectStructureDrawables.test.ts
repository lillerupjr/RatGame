import { describe, expect, it, vi } from "vitest";
import { collectStructureDrawables } from "../../../../game/systems/presentation/collection/collectStructureDrawables";
import type { RenderCommand } from "../../../../game/systems/presentation/contracts/renderCommands";
import { createRenderFrameBuilder } from "../../../../game/systems/presentation/frame/renderFrameBuilder";
import { KindOrder } from "../../../../game/systems/presentation/worldRenderOrdering";

function makeBaseInput(
  pieces: readonly any[],
  getStructureSpriteAtlasFrame: ((spriteId: string) => any) | undefined,
) {
  const frameBuilder = createRenderFrameBuilder();
  return {
    frameBuilder,
    DISABLE_WALLS_AND_CURTAINS: false,
    isTileInRenderRadius: () => true,
    buildFaceDraws: vi.fn(),
    facePieceLayers: () => [],
    facePiecesInViewForLayer: () => [],
    viewRect: { minTx: 0, maxTx: 0, minTy: 0, maxTy: 0 },
    KindOrder,
    occluderLayers: () => [],
    occludersInViewForLayer: () => [],
    shouldCullBuildingAt: () => false,
    buildWallDraw: vi.fn(),
    CONTAINER_WALL_SORT_BIAS: 0,
    resolveStructureOverlayAdmissionContext: vi.fn(() => ({
      triangleOverlayPrefilterBounds: { minTx: 0, maxTx: 0, minTy: 0, maxTy: 0 },
      overlayPrefilterViewRect: { minTx: 0, maxTx: 0, minTy: 0, maxTy: 0 },
    })),
    compiledMap: { id: "map-a", overlays: [] },
    strictViewportTileBounds: { minTx: 0, maxTx: 0, minTy: 0, maxTy: 0 },
    structureTriangleAdmissionMode: "hybrid",
    collectStructureOverlays: vi.fn(() => []),
    debugFlags: { showMapOverlays: true },
    tileRectIntersectsRenderRadius: () => true,
    buildOverlayDraw: vi.fn(),
    deriveStructureSouthTieBreakFromSeAnchor: vi.fn(),
    buildStructureSlices: vi.fn(() => ({
      pieces,
      didQueueStructureCutoutDebugRect: false,
    })),
    ctx: {} as CanvasRenderingContext2D,
    T: 64,
    projectedViewportRect: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
    structureTriangleCutoutEnabled: false,
    structureTriangleCutoutHalfWidth: 0,
    structureTriangleCutoutHalfHeight: 0,
    structureTriangleCutoutAlpha: 0.2,
    structureCutoutScreenRect: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
    isPointInsideStructureCutoutScreenRect: () => false,
    playerCameraTx: 0,
    playerCameraTy: 0,
    isParentTileAfterPlayer: () => false,
    toScreenAtZ: (worldX: number, worldY: number) => ({ x: worldX, y: worldY }),
    rampRoadTiles: new Set<string>(),
    resolveRenderZBand: vi.fn(() => 0),
    structureShadowFrame: {
      routing: { usesV6Sweep: false },
      sunModel: {
        stepKey: "sun-step",
        projectionDirection: { x: 1, y: 1 },
      },
    },
    getStructureSpriteAtlasFrame,
    monolithicStructureGeometryCacheStore: {},
    getTileSpriteById: vi.fn(),
    getFlippedOverlayImage: vi.fn(),
    SHOW_STRUCTURE_SLICE_DEBUG: false,
    SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG: false,
    SHOW_STRUCTURE_ANCHORS: false,
    SHOW_STRUCTURE_TRIANGLE_OWNERSHIP_SORT_DEBUG: false,
    DEBUG_STRUCTURE_RENDER_MODE: "triangles",
    deferredStructureSliceDebugDraws: [],
    LOG_STRUCTURE_OWNERSHIP_DEBUG: false,
    loggedStructureOwnershipDebugIds: new Set<string>(),
    staticRelight: { frame: null },
    buildStructureDrawables: vi.fn((structurePieces: readonly any[]) => structurePieces.map((piece, index) => ({
      key: {
        slice: index,
        within: index,
        baseZ: piece.overlay.z ?? 0,
        kindOrder: piece.kind === "overlay" && piece.overlay.kind === "PROP"
          ? KindOrder.ENTITY
          : KindOrder.STRUCTURE,
        stableId: 500 + index,
      },
      payload: {
        kind: piece.kind,
        piece,
      },
    }))),
    didQueueStructureCutoutDebugRect: false,
  } as any;
}

function collectCommands(input: any): RenderCommand[] {
  collectStructureDrawables(input);
  return Array.from(input.frameBuilder.sliceCommands.values()).flat() as RenderCommand[];
}

describe("collectStructureDrawables", () => {
  it("extracts atlas-backed structure cells into one quad per camera tile", () => {
    const originalImage = { width: 64, height: 32, id: "structure-a" } as any;
    const atlasImage = { width: 512, height: 512, id: "structure-atlas" } as any;
    const pieces = [{
      kind: "triangleGroup",
      overlay: {
        id: "overlay-a",
        spriteId: "structures/a",
        z: 0,
      },
      draw: {
        img: originalImage,
        dx: 10,
        dy: 20,
        dw: 64,
        dh: 32,
        flipX: true,
      },
      stableId: 77,
      parentTx: 0,
      parentTy: 0,
      feetSortY: 0,
      finalVisibleTriangles: [{
        stableId: 77,
        cameraTx: 0,
        cameraTy: 0,
        srcPoints: [{ x: 10, y: 5 }, { x: 30, y: 5 }, { x: 20, y: 25 }],
        points: [{ x: 100, y: 101 }, { x: 120, y: 101 }, { x: 110, y: 121 }],
        srcRectLocal: { x: 10, y: 5, w: 20, h: 20 },
        dstRectLocal: { x: 100, y: 101, w: 20, h: 20 },
      }],
      compareDistanceOnlyTriangles: [],
      cutoutEnabled: false,
      cutoutAlpha: 0.25,
      buildingDirectionalEligible: false,
      groupParentAfterPlayer: false,
    }];
    const commands = collectCommands(makeBaseInput(
      pieces,
      vi.fn(() => ({
        image: atlasImage,
        sx: 100,
        sy: 200,
        sw: 64,
        sh: 32,
      })),
    ));

    expect(commands).toHaveLength(1);
    expect(commands[0].semanticFamily).toBe("worldSprite");
    const payload = commands[0].payload as Extract<
      RenderCommand,
      { semanticFamily: "worldSprite"; finalForm: "quad" }
    >["payload"];

    expect(payload.image).toBe(atlasImage);
    expect(payload.kind).toBe("rect");
    expect(payload.auditFamily).toBe("structures");
    expect(payload.sx).toBe(134);
    expect(payload.sy).toBe(205);
    expect(payload.sw).toBe(20);
    expect(payload.sh).toBe(20);
    expect(payload.x0).toBe(100);
    expect(payload.y0).toBe(101);
    expect(payload.x1).toBe(120);
    expect(payload.y1).toBe(101);
    expect(payload.x2).toBe(120);
    expect(payload.y2).toBe(121);
    expect(payload.x3).toBe(100);
    expect(payload.y3).toBe(121);
  });

  it("uses atlas-backed source rects for structure overlay fallback meshes", () => {
    const originalImage = { width: 64, height: 32, id: "structure-overlay" } as any;
    const atlasImage = { width: 512, height: 512, id: "structure-atlas" } as any;
    const pieces = [{
      kind: "overlay",
      overlayIndex: 0,
      overlay: {
        id: "overlay-roof",
        kind: "ROOF",
        spriteId: "structures/roof",
        z: 0,
      },
      draw: {
        img: originalImage,
        dx: 7,
        dy: 9,
        dw: 64,
        dh: 32,
        flipX: true,
      },
    }];
    const commands = collectCommands(makeBaseInput(
      pieces,
      vi.fn(() => ({
        image: atlasImage,
        sx: 100,
        sy: 200,
        sw: 64,
        sh: 32,
      })),
    ));

    expect(commands).toHaveLength(1);
    expect(commands[0].semanticFamily).toBe("worldSprite");
    const payload = commands[0].payload as Extract<
      RenderCommand,
      { semanticFamily: "worldSprite"; finalForm: "quad" }
    >["payload"];

    expect(payload.auditFamily).toBe("structures");
    expect(payload.image).toBe(atlasImage);
    expect(payload.sx).toBe(100);
    expect(payload.sy).toBe(200);
    expect(payload.sw).toBe(64);
    expect(payload.sh).toBe(32);
    expect(payload.dx).toBe(7);
    expect(payload.dy).toBe(9);
    expect(payload.dw).toBe(64);
    expect(payload.dh).toBe(32);
    expect(payload.flipX).toBe(true);
  });

  it("keeps the original structure overlay image path when atlas fallback is required", () => {
    const originalImage = { width: 64, height: 32, id: "structure-overlay" } as any;
    const pieces = [{
      kind: "overlay",
      overlayIndex: 0,
      overlay: {
        id: "overlay-roof",
        kind: "ROOF",
        spriteId: "structures/roof",
        z: 0,
      },
      draw: {
        img: originalImage,
        dx: 7,
        dy: 9,
        dw: 64,
        dh: 32,
        flipX: true,
      },
    }];
    const commands = collectCommands(makeBaseInput(
      pieces,
      vi.fn(() => null),
    ));

    expect(commands).toHaveLength(1);
    const payload = commands[0].payload as Extract<
      RenderCommand,
      { semanticFamily: "worldSprite"; finalForm: "quad" }
    >["payload"];

    expect(commands[0].semanticFamily).toBe("worldSprite");
    expect(payload.auditFamily).toBe("structures");
    expect(payload.image).toBe(originalImage);
    expect(payload.sx).toBe(0);
    expect(payload.sy).toBe(0);
    expect(payload.sw).toBe(64);
    expect(payload.sh).toBe(32);
    expect(payload.flipX).toBe(true);
  });

  it("migrates rect-mesh face draws onto the structure quad path", () => {
    const image = { width: 32, height: 16, id: "face-piece" } as any;
    const input = makeBaseInput([], undefined);
    input.facePieceLayers = () => ["base"];
    input.facePiecesInViewForLayer = () => [{
      tx: 3,
      ty: 4,
      zFrom: 1,
      zTo: 1,
      layerRole: "STRUCTURE",
      kind: "WALL",
    }];
    input.buildFaceDraws = vi.fn(() => [{
      img: image,
      dx: 12,
      dy: 14,
      dw: 32,
      dh: 16,
      flipX: true,
    }]);

    const commands = collectCommands(input);

    expect(commands).toHaveLength(1);
    expect(commands[0].semanticFamily).toBe("worldSprite");
    const payload = commands[0].payload as Extract<
      RenderCommand,
      { semanticFamily: "worldSprite"; finalForm: "quad" }
    >["payload"];
    expect(payload.auditFamily).toBe("structures");
    expect(payload.image).toBe(image);
    expect(payload.dx).toBe(12);
    expect(payload.dy).toBe(14);
    expect(payload.dw).toBe(32);
    expect(payload.dh).toBe(16);
    expect(payload.flipX).toBe(true);
  });

  it("extracts one quad cell per visible monolithic structure camera tile by default", () => {
    const image = { width: 64, height: 32, id: "mono-default" } as any;
    const pieces = [{
      kind: "triangleGroup",
      overlay: { id: "overlay-default", spriteId: "structures/default", z: 0 },
      draw: { img: image, dx: 10, dy: 20, dw: 64, dh: 32, flipX: false },
      stableId: 77,
      parentTx: 0,
      parentTy: 0,
      feetSortY: 0,
      finalVisibleTriangles: [
        {
          stableId: 1,
          cameraTx: 0,
          cameraTy: 0,
          srcPoints: [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 0, y: 32 }],
          points: [{ x: 10, y: 20 }, { x: 74, y: 20 }, { x: 10, y: 52 }],
          srcRectLocal: { x: 0, y: 0, w: 64, h: 32 },
          dstRectLocal: { x: 10, y: 20, w: 64, h: 32 },
        },
        {
          stableId: 2,
          cameraTx: 0,
          cameraTy: 0,
          srcPoints: [{ x: 64, y: 0 }, { x: 64, y: 32 }, { x: 0, y: 32 }],
          points: [{ x: 74, y: 20 }, { x: 74, y: 52 }, { x: 10, y: 52 }],
          srcRectLocal: { x: 0, y: 0, w: 64, h: 32 },
          dstRectLocal: { x: 10, y: 20, w: 64, h: 32 },
        },
      ],
      compareDistanceOnlyTriangles: [],
      cutoutEnabled: false,
      cutoutAlpha: 0.25,
      buildingDirectionalEligible: false,
      groupParentAfterPlayer: false,
    }];

    const commands = collectCommands(makeBaseInput(pieces, undefined));

    expect(commands).toHaveLength(1);
    expect(commands[0].semanticFamily).toBe("worldSprite");
    const payload = commands[0].payload as Extract<
      RenderCommand,
      { semanticFamily: "worldSprite"; finalForm: "quad" }
    >["payload"];
    expect(payload.kind).toBe("rect");
    expect(payload.auditFamily).toBe("structures");
    expect(payload.sx).toBe(0);
    expect(payload.sy).toBe(0);
    expect(payload.sw).toBe(64);
    expect(payload.sh).toBe(32);
    expect(payload.alpha).toBe(1);
    expect(payload.x0).toBe(10);
    expect(payload.y0).toBe(20);
    expect(payload.x1).toBe(74);
    expect(payload.y1).toBe(20);
    expect(payload.x2).toBe(74);
    expect(payload.y2).toBe(52);
    expect(payload.x3).toBe(10);
    expect(payload.y3).toBe(52);
  });

  it("extracts at most one quad for a monolithic camera cell", () => {
    const image = { width: 64, height: 32, id: "mono-quad-approx" } as any;
    const pieces = [{
      kind: "triangleGroup",
      overlay: { id: "overlay-quad", spriteId: "structures/quad", z: 0 },
      draw: { img: image, dx: 0, dy: 0, dw: 64, dh: 32, flipX: false },
      stableId: 91,
      parentTx: 0,
      parentTy: 0,
      feetSortY: 0,
      finalVisibleTriangles: [
        {
          stableId: 1,
          cameraTx: 1,
          cameraTy: 2,
          srcPoints: [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 0, y: 32 }],
          points: [{ x: 100, y: 200 }, { x: 164, y: 200 }, { x: 100, y: 232 }],
          srcRectLocal: { x: 0, y: 0, w: 64, h: 32 },
          dstRectLocal: { x: 100, y: 200, w: 64, h: 32 },
        },
        {
          stableId: 2,
          cameraTx: 1,
          cameraTy: 2,
          srcPoints: [{ x: 64, y: 0 }, { x: 64, y: 32 }, { x: 0, y: 32 }],
          points: [{ x: 164, y: 200 }, { x: 164, y: 232 }, { x: 100, y: 232 }],
          srcRectLocal: { x: 0, y: 0, w: 64, h: 32 },
          dstRectLocal: { x: 100, y: 200, w: 64, h: 32 },
        },
      ],
      compareDistanceOnlyTriangles: [],
      cutoutEnabled: false,
      cutoutAlpha: 0.25,
      buildingDirectionalEligible: false,
      groupParentAfterPlayer: false,
    }];
    const commands = collectCommands(makeBaseInput(pieces, undefined));

    expect(commands).toHaveLength(1);
    expect(commands[0].semanticFamily).toBe("worldSprite");
    const payload = commands[0].payload as Extract<
      RenderCommand,
      { semanticFamily: "worldSprite"; finalForm: "quad" }
    >["payload"];
    expect(payload.auditFamily).toBe("structures");
    expect(payload.image).toBe(image);
    expect(payload.kind).toBe("rect");
    expect(payload.sx).toBe(0);
    expect(payload.sy).toBe(0);
    expect(payload.sw).toBe(64);
    expect(payload.sh).toBe(32);
    expect(payload.x0).toBe(100);
    expect(payload.y0).toBe(200);
    expect(payload.x1).toBe(164);
    expect(payload.y1).toBe(200);
    expect(payload.x2).toBe(164);
    expect(payload.y2).toBe(232);
    expect(payload.x3).toBe(100);
    expect(payload.y3).toBe(232);
  });

  it("suppresses unsafe monolithic cells instead of falling back to triangle rendering", () => {
    const image = { width: 64, height: 32, id: "mono-reject" } as any;
    const pieces = [{
      kind: "triangleGroup",
      overlay: { id: "overlay-reject", spriteId: "structures/reject", z: 0 },
      draw: { img: image, dx: 0, dy: 0, dw: 64, dh: 32, flipX: false },
      stableId: 92,
      parentTx: 0,
      parentTy: 0,
      feetSortY: 0,
      finalVisibleTriangles: [{
        stableId: 1,
        srcPoints: [{ x: 0, y: 0 }, { x: 32, y: 0 }, { x: 16, y: 32 }],
        points: [{ x: 100, y: 200 }, { x: 132, y: 200 }, { x: 116, y: 232 }],
        srcRectLocal: { x: 10, y: 10, w: 0, h: 0 },
      }],
      compareDistanceOnlyTriangles: [],
      cutoutEnabled: false,
      cutoutAlpha: 0.25,
      buildingDirectionalEligible: false,
      groupParentAfterPlayer: false,
    }];
    const commands = collectCommands(makeBaseInput(pieces, undefined));

    expect(commands).toHaveLength(0);
  });
});
