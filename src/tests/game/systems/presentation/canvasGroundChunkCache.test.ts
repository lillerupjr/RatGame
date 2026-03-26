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
      surfacesByKey: new Map([
        ["0,0", [{
          id: "surface_a",
          tx: 0,
          ty: 0,
          zBase: 0,
          zLogical: 0,
          tile: { kind: "FLOOR", h: 0 },
          renderTopKind: "FLOOR",
          renderDir: "N",
          renderAnchorY: 0.55,
          renderDyOffset: 0,
          spriteIdTop: "tiles/floor/sidewalk/1",
        }]],
        ["0,1", [{
          id: "surface_b",
          tx: 0,
          ty: 1,
          zBase: 1,
          zLogical: 1,
          tile: { kind: "FLOOR", h: 1 },
          renderTopKind: "FLOOR",
          renderDir: "N",
          renderAnchorY: 0.55,
          renderDyOffset: 0,
          spriteIdTop: "tiles/floor/sidewalk/2",
        }]],
      ]),
      decals: [{
        id: "decal_a",
        tx: 0,
        ty: 0,
        zBase: 0,
        zLogical: 0,
        setId: "lane_marking",
        spriteId: "lane",
        variantIndex: 0,
        semanticType: "road",
        renderAnchorY: 0.55,
        rotationQuarterTurns: 0,
      }],
    },
    renderAllHeights: true,
    activeH: 0,
    shouldCullBuildingAt: () => false,
    w: { timeSec: 0, time: 0 },
    ANCHOR_Y: 0.55,
    TILE_ID_OCEAN: "OCEAN",
    getAnimatedTileFrame: vi.fn(() => ({ ready: true, img: { width: 32, height: 32 } })),
    OCEAN_ANIM_TIME_SCALE: 0.25,
    getTileSpriteById: vi.fn(() => ({ ready: true, img: { width: 128, height: 128 } })),
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
  it("rebuilds chunk entries by chunk and z-band, then reuses them until the context changes", () => {
    withFakeCanvasDocument(() => {
      const input = makeSyncInput();
      const store = input.cacheStore as CanvasGroundChunkCacheStore;
      const first = syncCanvasGroundChunkCacheForFrame(input);

      expect(first.rebuiltChunkCount).toBe(2);
      expect(store.getVisibleEntries(0, { minTx: -1, maxTx: 2, minTy: -1, maxTy: 2 })).toHaveLength(1);
      expect(store.getVisibleEntries(1, { minTx: -1, maxTx: 2, minTy: -1, maxTy: 2 })).toHaveLength(1);

      const surfaceStableId = resolveGroundSurfaceProjectedCommand(
        input.compiledMap.surfacesByKey.get("0,0")[0],
        input,
      )?.stableId;
      const decalStableId = resolveGroundDecalProjectedCommand(input.compiledMap.decals[0], input)?.stableId;
      expect(store.hasCoveredStableId(surfaceStableId)).toBe(true);
      expect(store.hasCoveredStableId(decalStableId)).toBe(true);

      const second = syncCanvasGroundChunkCacheForFrame(input);
      expect(second.rebuiltChunkCount).toBe(0);

      const third = syncCanvasGroundChunkCacheForFrame({
        ...input,
        contextKey: "map:b",
      });
      expect(third.rebuiltChunkCount).toBe(2);
    });
  });
});
