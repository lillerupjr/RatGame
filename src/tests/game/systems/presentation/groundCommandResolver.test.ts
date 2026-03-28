import { describe, expect, it, vi } from "vitest";
import {
  resolveGroundDecalProjectedCommand,
  resolveGroundSurfaceProjectedCommand,
} from "../../../../game/systems/presentation/groundCommandResolver";

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
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
    getDiamondFitCanvas: vi.fn((src) => ({ width: 128, height: 64, src })),
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

describe("groundCommandResolver", () => {
  it("normalizes authored square floor tops identically for live and static-cache paths", () => {
    const rawTop = { width: 128, height: 128 } as any;
    const normalizedTop = { width: 128, height: 64 } as any;
    const deps = makeDeps({
      getTileSpriteById: vi.fn(() => ({ ready: true, img: rawTop })),
      getRuntimeIsoTopCanvas: vi.fn(() => normalizedTop),
    });
    const surface = {
      id: "surface_0_0",
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
    } as any;

    const live = resolveGroundSurfaceProjectedCommand(surface, deps);
    const staticCache = resolveGroundSurfaceProjectedCommand(surface, deps, { staticOnly: true });

    expect(live?.payload.image).toBe(normalizedTop);
    expect(staticCache?.payload.image).toBe(normalizedTop);
    expect(staticCache?.payload).toEqual(live?.payload);
  });

  it("uses the ramp quad path for runtime asphalt tops", () => {
    const deps = makeDeps({
      rampRoadTiles: new Set<string>(["2,3"]),
      getTileSpriteById: vi.fn(() => ({ ready: true, img: { width: 128, height: 128 } })),
      getRuntimeIsoTopCanvas: vi.fn(() => ({ width: 128, height: 64 })),
    });
    const surface = {
      id: "runtime_ramp",
      tx: 2,
      ty: 3,
      zBase: 1,
      zLogical: 1,
      tile: { kind: "FLOOR", h: 1 },
      renderTopKind: "FLOOR",
      renderDir: "N",
      renderAnchorY: 0.55,
      renderDyOffset: 0,
      spriteIdTop: "tiles/floor/asphalt/1",
      runtimeTop: {
        kind: "SQUARE_128_RUNTIME",
        family: "asphalt",
        spriteId: "tiles/floor/asphalt/1",
        variantIndex: 1,
        rotationQuarterTurns: 0,
      },
    } as any;

    const resolved = resolveGroundSurfaceProjectedCommand(surface, deps);

    expect(deps.getRampQuadPoints).toHaveBeenCalledWith(2, 3, 0.55);
    expect(resolved?.payload.sourceQuad).toEqual({
      nw: { x: 64, y: 0 },
      ne: { x: 128, y: 32 },
      se: { x: 64, y: 64 },
      sw: { x: 0, y: 32 },
    });
    expect(resolved?.payload.x0).toBe(10);
    expect(resolved?.payload.y0).toBe(20);
    expect(resolved?.payload.x3).toBe(0);
    expect(resolved?.payload.y3).toBe(30);
  });

  it("keeps flat decals centered on the tile origin while ramp decals use the ramp quad", () => {
    const flatDeps = makeDeps({
      getRuntimeIsoDecalCanvas: vi.fn(() => ({ width: 48, height: 24 })),
      getDiamondFitCanvas: vi.fn(() => ({ width: 128, height: 64 })),
    });
    const flatDecal = {
      tx: 0,
      ty: 0,
      zBase: 0,
      zLogical: 0,
      renderAnchorY: 0.55,
      setId: "lane_marking",
      variantIndex: 0,
      rotationQuarterTurns: 0,
    } as any;
    const flatResolved = resolveGroundDecalProjectedCommand(flatDecal, flatDeps);
    expect(flatResolved?.payload.sourceQuad).toEqual({
      nw: { x: 64, y: 0 },
      ne: { x: 128, y: 32 },
      se: { x: 64, y: 64 },
      sw: { x: 0, y: 32 },
    });
    expect(flatResolved?.payload.x0).toBe(0);
    expect(flatResolved?.payload.y0).toBe(-36);
    expect(flatResolved?.payload.x3).toBe(-64);
    expect(flatResolved?.payload.y3).toBe(-4);

    const rampDeps = makeDeps({
      rampRoadTiles: new Set<string>(["4,5"]),
    });
    const rampDecal = {
      tx: 4,
      ty: 5,
      zBase: 0,
      zLogical: 0,
      renderAnchorY: 0.55,
      setId: "road_markings",
      variantIndex: 0,
      rotationQuarterTurns: 0,
    } as any;
    const rampResolved = resolveGroundDecalProjectedCommand(rampDecal, rampDeps);
    expect(rampDeps.getRampQuadPoints).toHaveBeenCalledWith(4, 5, 0.55);
    expect(rampResolved?.payload.x0).toBe(10);
    expect(rampResolved?.payload.y0).toBe(20);
  });

  it("excludes animated ocean tops from the static cache path while keeping them live", () => {
    const projectedOcean = { width: 128, height: 64 } as any;
    const deps = makeDeps({
      getAnimatedTileFrame: vi.fn(() => ({ ready: true, img: { width: 32, height: 32 } })),
      getRuntimeIsoDecalCanvas: vi.fn(() => projectedOcean),
    });
    const surface = {
      id: "ocean_0_0",
      tx: 0,
      ty: 0,
      zBase: -2,
      zLogical: -2,
      tile: { kind: "OCEAN", h: -2 },
      renderTopKind: "FLOOR",
      renderDir: "N",
      renderAnchorY: 0.55,
      renderDyOffset: 0,
      spriteIdTop: "",
    } as any;

    const live = resolveGroundSurfaceProjectedCommand(surface, deps);
    const staticCache = resolveGroundSurfaceProjectedCommand(surface, deps, { staticOnly: true });

    expect(live?.payload.image).toBe(projectedOcean);
    expect(staticCache).toBeNull();
  });
});
