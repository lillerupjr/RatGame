import { describe, expect, it, vi } from "vitest";
import {
  CanvasGroundChunkCacheStore,
  syncCanvasGroundChunkCacheForFrame,
} from "../../../../game/systems/presentation/canvasGroundChunkCache";
import {
  resolveGroundDecalProjectedCommand,
  resolveGroundSurfaceProjectedCommand,
} from "../../../../game/systems/presentation/groundCommandResolver";

type FakeChunkCtx = CanvasRenderingContext2D & {
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  closePath: ReturnType<typeof vi.fn>;
  clip: ReturnType<typeof vi.fn>;
  transform: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  globalAlpha: number;
  imageSmoothingEnabled: boolean;
};

function makeChunkCtx(): FakeChunkCtx {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    transform: vi.fn(),
    drawImage: vi.fn(),
    globalAlpha: 1,
    imageSmoothingEnabled: false,
  } as unknown as FakeChunkCtx;
}

function withFakeCanvasDocument(run: () => void): void {
  const originalDocument = (globalThis as any).document;
  (globalThis as any).document = {
    createElement: vi.fn(() => {
      const ctx = makeChunkCtx();
      return {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ctx),
      };
    }),
  };
  try {
    run();
  } finally {
    if (originalDocument === undefined) delete (globalThis as any).document;
    else (globalThis as any).document = originalDocument;
  }
}

function makeSurface(id: string, tx: number, ty: number, zBase = 0) {
  return {
    id,
    tx,
    ty,
    zBase,
    zLogical: 0,
    tile: { kind: "FLOOR", h: 0 },
    renderTopKind: "FLOOR",
    renderDir: "N",
    renderAnchorY: 0.55,
    renderDyOffset: 0,
    spriteIdTop: `tiles/floor/sidewalk/${id}`,
  };
}

function makeDecal(id: string, tx: number, ty: number, zBase = 0) {
  return {
    id,
    tx,
    ty,
    zBase,
    zLogical: 0,
    setId: "lane_marking",
    spriteId: id,
    variantIndex: 0,
    semanticType: "road",
    renderAnchorY: 0.55,
    rotationQuarterTurns: 0,
  };
}

function buildSurfaceMap(): Map<string, any[]> {
  const surfaces = new Map<string, any[]>();
  for (let chunkY = 0; chunkY <= 2; chunkY++) {
    for (let chunkX = 0; chunkX <= 6; chunkX++) {
      const tx = chunkX * 8;
      const ty = chunkY * 8;
      surfaces.set(`${tx},${ty}`, [makeSurface(`surface_${chunkX}_${chunkY}`, tx, ty, chunkX === 3 ? 1 : 0)]);
    }
  }
  return surfaces;
}

function makeSyncInput(overrides: Record<string, unknown> = {}) {
  return {
    cacheStore: new CanvasGroundChunkCacheStore(),
    contextKey: "map:a",
    compiledMap: {
      id: "map-a",
      originTx: 0,
      originTy: 0,
      width: 64,
      height: 64,
      surfacesByKey: buildSurfaceMap(),
      decals: [makeDecal("decal_a", 8, 8)],
    },
    renderAllHeights: true,
    activeH: 0,
    viewRect: {
      minTx: 0,
      maxTx: 15,
      minTy: 0,
      maxTy: 15,
    },
    shouldCullBuildingAt: () => false,
    w: { timeSec: 0, time: 0 },
    ANCHOR_Y: 0.55,
    TILE_ID_OCEAN: "OCEAN",
    getAnimatedTileFrame: vi.fn(() => ({ ready: true, img: { width: 32, height: 32 } })),
    OCEAN_ANIM_TIME_SCALE: 0.25,
    getTileSpriteById: vi.fn((id: string) => ({ ready: true, img: { width: 128, height: 128, id } })),
    getRuntimeIsoTopCanvas: vi.fn(() => ({ width: 128, height: 64 })),
    OCEAN_TOP_SCALE: 4,
    STAIR_TOP_SCALE: 1,
    FLOOR_TOP_SCALE: 1,
    OCEAN_BASE_FRAME_PX: 32,
    getRuntimeIsoDecalCanvas: vi.fn(() => ({ width: 48, height: 24 })),
    getDiamondFitCanvas: vi.fn(() => ({ width: 128, height: 64 })),
    getRuntimeDecalSprite: vi.fn(() => ({ ready: true, img: { width: 32, height: 16 } })),
    T: 64,
    worldToScreen: (x: number, y: number) => ({ x: x - y, y: (x + y) * 0.5 }),
    camX: 0,
    camY: 0,
    ELEV_PX: 16,
    STAIR_TOP_DY: 8,
    SIDEWALK_ISO_HEIGHT: 64,
    rampRoadTiles: new Set<string>(),
    staticRelightFrame: null,
    staticRelightBakeStore: new Map(),
    floorRelightPieceKey: vi.fn(() => "floor-piece"),
    decalRelightPieceKey: vi.fn(() => "decal-piece"),
    roadMarkingDecalScale: vi.fn(() => 1),
    shouldPixelSnapRoadMarking: vi.fn(() => false),
    snapPx: (value: number) => Math.floor(value),
    getRampQuadPoints: vi.fn(() => ({
      nw: { x: 10, y: 20 },
      ne: { x: 20, y: 30 },
      se: { x: 10, y: 40 },
      sw: { x: 0, y: 30 },
    })),
    ...overrides,
  } as any;
}

describe("CanvasGroundChunkCacheStore", () => {
  it("retains a visible-window working set and evicts logical chunks outside the grace ring", () => {
    withFakeCanvasDocument(() => {
      const input = makeSyncInput();
      const store = input.cacheStore as CanvasGroundChunkCacheStore;

      const first = syncCanvasGroundChunkCacheForFrame(input);
      expect(first.rebuiltChunkCount).toBe(4);
      expect(store.getDebugCacheMetrics()).toMatchObject({
        name: "groundChunks",
        entryCount: 4,
        inserts: 4,
        evictions: 0,
        clears: 0,
        generation: 1,
      });
      expect(store.getDebugCacheMetrics().notes).toContain("logical:4");
      expect(store.getDebugCacheMetrics().notes).toContain("target:4");
      expect(store.getDebugCacheMetrics().notes).toContain("grace:16");
      expect(store.getDebugCacheMetrics().notes).toContain("mode:raster");
      expect(store.getDebugCacheMetrics().notes).toContain("surfaces:4");

      const decalStableId = resolveGroundDecalProjectedCommand(input.compiledMap.decals[0], input)?.stableId;
      const centerSurfaceStableId = resolveGroundSurfaceProjectedCommand(
        input.compiledMap.surfacesByKey.get("8,8")[0],
        input,
      )?.stableId;
      expect(store.hasCoveredStableId(decalStableId)).toBe(true);
      expect(store.hasCoveredStableId(centerSurfaceStableId)).toBe(true);
      expect(store.isTileAuthoritative(8, 8)).toBe(true);
      expect(store.getVisiblePieces(0, input.viewRect)).toHaveLength(4);

      const second = syncCanvasGroundChunkCacheForFrame(input);
      expect(second.rebuiltChunkCount).toBe(0);
      expect(store.getDebugCacheMetrics().generation).toBe(1);

      const third = syncCanvasGroundChunkCacheForFrame({
        ...input,
        viewRect: {
          minTx: 8,
          maxTx: 23,
          minTy: 0,
          maxTy: 15,
        },
      });
      expect(third.rebuiltChunkCount).toBe(2);
      expect(store.getDebugCacheMetrics().notes).toContain("logical:6");
      expect(store.getDebugCacheMetrics().evictions).toBe(0);

      const farMove = syncCanvasGroundChunkCacheForFrame({
        ...input,
        viewRect: {
          minTx: 32,
          maxTx: 47,
          minTy: 0,
          maxTy: 15,
        },
      });
      expect(farMove.rebuiltChunkCount).toBe(4);
      expect(store.getDebugCacheMetrics().evictions).toBeGreaterThan(0);
      expect(store.getDebugCacheMetrics().notes).toContain("logical:4");

      const oldSurfaceStableId = resolveGroundSurfaceProjectedCommand(
        input.compiledMap.surfacesByKey.get("0,0")[0],
        input,
      )?.stableId;
      expect(store.hasCoveredStableId(oldSurfaceStableId)).toBe(false);
      expect(store.isTileAuthoritative(0, 0)).toBe(false);
    });
  });

  it("retains pending visible chunks for retry without making them authoritative", () => {
    withFakeCanvasDocument(() => {
      let now = 0;
      const originalPerformance = globalThis.performance;
      Object.defineProperty(globalThis, "performance", {
        value: { now: () => now },
        configurable: true,
      });

      try {
        const input = makeSyncInput({
          getTileSpriteById: vi.fn((id: string) => {
            if (id === "tiles/floor/sidewalk/surface_1_1" && now < 60) {
              return { ready: false, img: null };
            }
            return { ready: true, img: { width: 128, height: 128, id } };
          }),
          compiledMap: {
            id: "map-a",
            originTx: 0,
            originTy: 0,
            width: 64,
            height: 64,
            surfacesByKey: buildSurfaceMap(),
            decals: [],
          },
        });
        const store = input.cacheStore as CanvasGroundChunkCacheStore;

        const first = syncCanvasGroundChunkCacheForFrame(input);
        expect(first.rebuiltChunkCount).toBe(3);
        expect(store.getDebugCacheMetrics().notes).toContain("pending:1");
        expect(store.isTileAuthoritative(8, 8)).toBe(false);

        now = 10;
        const second = syncCanvasGroundChunkCacheForFrame(input);
        expect(second.rebuiltChunkCount).toBe(0);
        expect(store.getDebugCacheMetrics().generation).toBe(1);

        now = 75;
        const third = syncCanvasGroundChunkCacheForFrame(input);
        expect(third.rebuiltChunkCount).toBe(1);
      expect(store.getDebugCacheMetrics().notes).toContain("pending:0");
      expect(store.getDebugCacheMetrics().generation).toBe(2);
      expect(store.isTileAuthoritative(8, 8)).toBe(true);
      } finally {
        Object.defineProperty(globalThis, "performance", {
          value: originalPerformance,
          configurable: true,
        });
      }
    });
  });

  it("reuses raster chunk surfaces until a chunk is rebuilt", () => {
    withFakeCanvasDocument(() => {
      const input = makeSyncInput();
      const store = input.cacheStore as CanvasGroundChunkCacheStore;

      syncCanvasGroundChunkCacheForFrame(input);
      const firstVisiblePiece = store.getVisiblePieces(0, input.viewRect)[0];
      expect(firstVisiblePiece?.image).toBeTruthy();

      syncCanvasGroundChunkCacheForFrame(input);
      const secondVisiblePiece = store.getVisiblePieces(0, input.viewRect)[0];
      expect(secondVisiblePiece?.image).toBe(firstVisiblePiece?.image);

      syncCanvasGroundChunkCacheForFrame({
        ...input,
        contextKey: "map:b",
      });
      const rebuiltVisiblePiece = store.getVisiblePieces(0, input.viewRect)[0];
      expect(rebuiltVisiblePiece?.image).not.toBe(firstVisiblePiece?.image);
    });
  });
});
