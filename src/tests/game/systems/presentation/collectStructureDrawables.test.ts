import { describe, expect, it, vi } from "vitest";
import { collectStructureDrawables } from "../../../../game/systems/presentation/collection/collectStructureDrawables";
import type { RenderCommand } from "../../../../game/systems/presentation/contracts/renderCommands";
import { createRenderFrameBuilder } from "../../../../game/systems/presentation/frame/renderFrameBuilder";
import { KindOrder } from "../../../../game/systems/presentation/worldRenderOrdering";
import { StructureMergedSliceCacheStore } from "../../../../game/systems/presentation/structures/structureMergedSliceCache";

type FakeCanvasRecord = {
  width: number;
  height: number;
  getContext: ReturnType<typeof vi.fn>;
};

function installFakeRasterCanvas(): { canvases: FakeCanvasRecord[]; restore: () => void } {
  const canvases: FakeCanvasRecord[] = [];
  const previousDocument = (globalThis as { document?: Document }).document;
  const createElement = vi.fn((tagName: string) => {
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
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
    } as unknown as FakeCanvasRecord & HTMLCanvasElement;
    canvases.push(canvas);
    return canvas;
  });
  (globalThis as { document?: Document }).document = {
    createElement,
  } as unknown as Document;
  return {
    canvases,
    restore: () => {
      (globalThis as { document?: Document }).document = previousDocument;
    },
  };
}

function makeBaseInput(
  pieces: readonly any[],
  getStaticAtlasSpriteFrame: ((spriteId: string) => any) | undefined,
  structureMergedSliceCacheStore: StructureMergedSliceCacheStore | null = null,
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
    ISO_X: 0.5,
    ISO_Y: 0.25,
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
    getStaticAtlasSpriteFrame,
    monolithicStructureGeometryCacheStore: {},
    structureMergedSliceCacheStore,
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
  it("routes face-piece structure sprites through the static/shared atlas resolver", () => {
    const originalImage = { width: 32, height: 16, id: "face-original" } as any;
    const atlasImage = { width: 512, height: 512, id: "shared-world-atlas" } as any;
    const input = makeBaseInput([], vi.fn((spriteId: string) => (
      spriteId === "structures/floor_apron_a"
        ? { image: atlasImage, sx: 24, sy: 36, sw: 32, sh: 16 }
        : null
    )));
    input.facePieceLayers = () => [0];
    input.facePiecesInViewForLayer = () => [{
      id: "face-a",
      kind: "FLOOR_APRON",
      spriteId: "structures/floor_apron_a",
      tx: 3,
      ty: 4,
      zFrom: 0,
      zTo: 0,
      layerRole: "STRUCTURE",
    }];
    input.buildFaceDraws = vi.fn(() => [{
      img: originalImage,
      dx: 10,
      dy: 20,
      dw: 64,
      dh: 32,
      flipX: false,
      scale: 1,
    }]);

    const commands = collectCommands(input);
    expect(commands).toHaveLength(1);
    const payload = commands[0].payload as Extract<
      RenderCommand,
      { semanticFamily: "worldSprite"; finalForm: "quad" }
    >["payload"];

    expect(payload.auditFamily).toBe("structures");
    expect(payload.image).toBe(atlasImage);
    expect(payload.sx).toBe(24);
    expect(payload.sy).toBe(36);
    expect(payload.sw).toBe(32);
    expect(payload.sh).toBe(16);
    expect(payload.dx).toBe(10);
    expect(payload.dy).toBe(20);
  });

  it("extracts static-atlas-backed structure cells into one quad per camera tile", () => {
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
        dw: 128,
        dh: 64,
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

  it("uses static-atlas-backed source rects for structure overlay fallback meshes", () => {
    const originalImage = { width: 32, height: 16, id: "structure-overlay" } as any;
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
        sw: 32,
        sh: 16,
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
    expect(payload.sw).toBe(32);
    expect(payload.sh).toBe(16);
    expect(payload.dx).toBe(7);
    expect(payload.dy).toBe(9);
    expect(payload.dw).toBe(64);
    expect(payload.dh).toBe(32);
    expect(payload.flipX).toBe(true);
  });

  it("keeps the original structure overlay image path when static atlas fallback is required", () => {
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

  it("routes prop overlays through the static structure quad path", () => {
    const atlasImage = { width: 512, height: 512, id: "static-atlas" } as any;
    const pieces = [{
      kind: "overlay",
      overlayIndex: 0,
      overlay: {
        id: "overlay-prop",
        kind: "PROP",
        spriteId: "props/lights/street_lamp_e",
        z: 0,
      },
      draw: {
        img: { width: 32, height: 64, id: "prop-image" },
        dx: 11,
        dy: 13,
        dw: 32,
        dh: 64,
        flipX: false,
      },
    }];
    const commands = collectCommands(makeBaseInput(
      pieces,
      vi.fn(() => ({
        image: atlasImage,
        sx: 90,
        sy: 140,
        sw: 32,
        sh: 64,
      })),
    ));

    expect(commands).toHaveLength(1);
    const payload = commands[0].payload as Extract<
      RenderCommand,
      { semanticFamily: "worldSprite"; finalForm: "quad" }
    >["payload"];

    expect(payload.auditFamily).toBe("structures");
    expect(payload.image).toBe(atlasImage);
    expect(payload.sx).toBe(90);
    expect(payload.sy).toBe(140);
    expect(payload.sw).toBe(32);
    expect(payload.sh).toBe(64);
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

  it("merges fully visible multi-cell structure slices into one cached coarse quad", () => {
    const { canvases, restore } = installFakeRasterCanvas();
    try {
      const image = { width: 128, height: 32, id: "mono-coarse" } as any;
      const pieces = [{
        kind: "triangleGroup",
        overlay: { id: "overlay-coarse", spriteId: "structures/coarse", z: 0 },
        draw: { img: image, dx: 10, dy: 20, dw: 128, dh: 32, flipX: false },
        stableId: 103,
        parentTx: 0,
        parentTy: 0,
        feetSortY: 0,
        groupLocalBounds: { x: 10, y: 20, w: 128, h: 32 },
        groupTriangleCount: 4,
        allTrianglesVisible: true,
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
          {
            stableId: 3,
            cameraTx: 1,
            cameraTy: 0,
            srcPoints: [{ x: 64, y: 0 }, { x: 128, y: 0 }, { x: 64, y: 32 }],
            points: [{ x: 74, y: 20 }, { x: 138, y: 20 }, { x: 74, y: 52 }],
            srcRectLocal: { x: 64, y: 0, w: 64, h: 32 },
            dstRectLocal: { x: 74, y: 20, w: 64, h: 32 },
          },
          {
            stableId: 4,
            cameraTx: 1,
            cameraTy: 0,
            srcPoints: [{ x: 128, y: 0 }, { x: 128, y: 32 }, { x: 64, y: 32 }],
            points: [{ x: 138, y: 20 }, { x: 138, y: 52 }, { x: 74, y: 52 }],
            srcRectLocal: { x: 64, y: 0, w: 64, h: 32 },
            dstRectLocal: { x: 74, y: 20, w: 64, h: 32 },
          },
        ],
        compareDistanceOnlyTriangles: [],
        cutoutEnabled: false,
        cutoutAlpha: 0.25,
        buildingDirectionalEligible: false,
        groupParentAfterPlayer: false,
      }];
      const cacheStore = new StructureMergedSliceCacheStore();

      const firstCommands = collectCommands(makeBaseInput(pieces, undefined, cacheStore));
      expect(firstCommands).toHaveLength(1);
      expect(canvases).toHaveLength(1);
      const firstPayload = firstCommands[0].payload as Extract<
        RenderCommand,
        { semanticFamily: "worldSprite"; finalForm: "quad" }
      >["payload"];
      expect(firstPayload.image).toBe(canvases[0] as unknown as HTMLCanvasElement);
      expect(firstPayload.dx).toBe(10);
      expect(firstPayload.dy).toBe(20);
      expect(firstPayload.dw).toBe(128);
      expect(firstPayload.dh).toBe(32);

      const secondCommands = collectCommands(makeBaseInput(pieces, undefined, cacheStore));
      expect(secondCommands).toHaveLength(1);
      expect(canvases).toHaveLength(1);
      const secondPayload = secondCommands[0].payload as Extract<
        RenderCommand,
        { semanticFamily: "worldSprite"; finalForm: "quad" }
      >["payload"];
      expect(secondPayload.image).toBe(firstPayload.image);
    } finally {
      restore();
    }
  });

  it("keeps fine per-cell quads when a slice intersects the cutout halo", () => {
    const { restore } = installFakeRasterCanvas();
    try {
      const image = { width: 128, height: 32, id: "mono-cutout" } as any;
      const pieces = [{
        kind: "triangleGroup",
        overlay: { id: "overlay-cutout", spriteId: "structures/cutout", z: 0 },
        draw: { img: image, dx: 10, dy: 20, dw: 128, dh: 32, flipX: false },
        stableId: 104,
        parentTx: 0,
        parentTy: 0,
        feetSortY: 0,
        groupLocalBounds: { x: 10, y: 20, w: 128, h: 32 },
        groupTriangleCount: 4,
        allTrianglesVisible: true,
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
          {
            stableId: 3,
            cameraTx: 1,
            cameraTy: 0,
            srcPoints: [{ x: 64, y: 0 }, { x: 128, y: 0 }, { x: 64, y: 32 }],
            points: [{ x: 74, y: 20 }, { x: 138, y: 20 }, { x: 74, y: 52 }],
            srcRectLocal: { x: 64, y: 0, w: 64, h: 32 },
            dstRectLocal: { x: 74, y: 20, w: 64, h: 32 },
          },
          {
            stableId: 4,
            cameraTx: 1,
            cameraTy: 0,
            srcPoints: [{ x: 128, y: 0 }, { x: 128, y: 32 }, { x: 64, y: 32 }],
            points: [{ x: 138, y: 20 }, { x: 138, y: 52 }, { x: 74, y: 52 }],
            srcRectLocal: { x: 64, y: 0, w: 64, h: 32 },
            dstRectLocal: { x: 74, y: 20, w: 64, h: 32 },
          },
        ],
        compareDistanceOnlyTriangles: [],
        cutoutEnabled: true,
        cutoutAlpha: 0.25,
        buildingDirectionalEligible: true,
        groupParentAfterPlayer: true,
      }];
      const cacheStore = new StructureMergedSliceCacheStore();
      const input = makeBaseInput(pieces, undefined, cacheStore);
      input.structureTriangleCutoutEnabled = true;
      input.structureCutoutScreenRect = {
        minX: 170,
        maxX: 180,
        minY: 20,
        maxY: 52,
      };

      const commands = collectCommands(input);
      expect(commands).toHaveLength(2);
      const payloads = commands.map((command) => command.payload) as Array<Extract<
        RenderCommand,
        { semanticFamily: "worldSprite"; finalForm: "quad" }
      >["payload"]>;
      expect(payloads.every((payload) => payload.image === image)).toBe(true);
    } finally {
      restore();
    }
  });

  it("keeps fine per-cell quads when the structure slice is only partially visible", () => {
    const { canvases, restore } = installFakeRasterCanvas();
    try {
      const image = { width: 128, height: 32, id: "mono-partial" } as any;
      const pieces = [{
        kind: "triangleGroup",
        overlay: { id: "overlay-partial", spriteId: "structures/partial", z: 0 },
        draw: { img: image, dx: 10, dy: 20, dw: 128, dh: 32, flipX: false },
        stableId: 105,
        parentTx: 0,
        parentTy: 0,
        feetSortY: 0,
        groupLocalBounds: { x: 10, y: 20, w: 128, h: 32 },
        groupTriangleCount: 6,
        allTrianglesVisible: false,
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
          {
            stableId: 3,
            cameraTx: 1,
            cameraTy: 0,
            srcPoints: [{ x: 64, y: 0 }, { x: 128, y: 0 }, { x: 64, y: 32 }],
            points: [{ x: 74, y: 20 }, { x: 138, y: 20 }, { x: 74, y: 52 }],
            srcRectLocal: { x: 64, y: 0, w: 64, h: 32 },
            dstRectLocal: { x: 74, y: 20, w: 64, h: 32 },
          },
          {
            stableId: 4,
            cameraTx: 1,
            cameraTy: 0,
            srcPoints: [{ x: 128, y: 0 }, { x: 128, y: 32 }, { x: 64, y: 32 }],
            points: [{ x: 138, y: 20 }, { x: 138, y: 52 }, { x: 74, y: 52 }],
            srcRectLocal: { x: 64, y: 0, w: 64, h: 32 },
            dstRectLocal: { x: 74, y: 20, w: 64, h: 32 },
          },
        ],
        compareDistanceOnlyTriangles: [],
        cutoutEnabled: false,
        cutoutAlpha: 0.25,
        buildingDirectionalEligible: false,
        groupParentAfterPlayer: false,
      }];
      const cacheStore = new StructureMergedSliceCacheStore();
      const commands = collectCommands(makeBaseInput(pieces, undefined, cacheStore));

      expect(commands).toHaveLength(2);
      expect(canvases).toHaveLength(0);
    } finally {
      restore();
    }
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
