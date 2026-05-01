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
    expect(live?.payload.x0).toBe(0);
    expect(live?.payload.y0).toBe(0);
    expect(live?.payload.x1).toBe(64);
    expect(live?.payload.y1).toBe(32);
    expect(live?.payload.x2).toBe(0);
    expect(live?.payload.y2).toBe(64);
    expect(live?.payload.x3).toBe(-64);
    expect(live?.payload.y3).toBe(32);
  });

  it("keeps ground surface placement fixed regardless of authored renderAnchorY", () => {
    const deps = makeDeps();
    const baseSurface = {
      id: "surface_0_0",
      tx: 1,
      ty: 2,
      zBase: 0,
      zLogical: 0,
      tile: { kind: "FLOOR", h: 0 },
      renderTopKind: "FLOOR",
      renderDir: "N",
      renderAnchorY: 0.55,
      renderDyOffset: 0,
      spriteIdTop: "tiles/floor/sidewalk/1",
    } as any;

    const anchored = resolveGroundSurfaceProjectedCommand(baseSurface, deps);
    const exaggerated = resolveGroundSurfaceProjectedCommand({
      ...baseSurface,
      renderAnchorY: 1,
    }, deps);

    expect(anchored).not.toBeNull();
    expect(exaggerated).not.toBeNull();
    expect(exaggerated?.destinationQuad).toEqual(anchored?.destinationQuad);
    expect(exaggerated?.payload.x0).toBe(anchored?.payload.x0);
    expect(exaggerated?.payload.y0).toBe(anchored?.payload.y0);
    expect(exaggerated?.payload.x1).toBe(anchored?.payload.x1);
    expect(exaggerated?.payload.y1).toBe(anchored?.payload.y1);
    expect(exaggerated?.payload.x2).toBe(anchored?.payload.x2);
    expect(exaggerated?.payload.y2).toBe(anchored?.payload.y2);
    expect(exaggerated?.payload.x3).toBe(anchored?.payload.x3);
    expect(exaggerated?.payload.y3).toBe(anchored?.payload.y3);
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

    expect(deps.getRampQuadPoints).toHaveBeenCalledWith(2, 3, 0.5);
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

  it("derives flat decal destination quads from logical tile corners while ramp decals use the ramp quad", () => {
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
    expect(flatResolved?.payload.x1).toBe(64);
    expect(flatResolved?.payload.y1).toBe(-4);
    expect(flatResolved?.payload.x2).toBe(0);
    expect(flatResolved?.payload.y2).toBe(28);
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

  it("keeps flat decal placement fixed when the sampled source canvas size changes", () => {
    const decal = {
      tx: 1,
      ty: 2,
      zBase: 0,
      zLogical: 0,
      renderAnchorY: 0.55,
      setId: "lane_marking",
      variantIndex: 0,
      rotationQuarterTurns: 0,
    } as any;
    const baseResolved = resolveGroundDecalProjectedCommand(decal, makeDeps({
      getDiamondFitCanvas: vi.fn(() => ({ width: 128, height: 64 })),
    }));
    const oversizedSourceResolved = resolveGroundDecalProjectedCommand(decal, makeDeps({
      getDiamondFitCanvas: vi.fn(() => ({ width: 192, height: 96 })),
    }));

    expect(baseResolved).not.toBeNull();
    expect(oversizedSourceResolved).not.toBeNull();
    expect(oversizedSourceResolved?.payload.sourceQuad).toEqual({
      nw: { x: 96, y: 0 },
      ne: { x: 192, y: 48 },
      se: { x: 96, y: 96 },
      sw: { x: 0, y: 48 },
    });
    expect(oversizedSourceResolved?.destinationQuad).toEqual(baseResolved?.destinationQuad);
    expect(oversizedSourceResolved?.payload.x0).toBe(baseResolved?.payload.x0);
    expect(oversizedSourceResolved?.payload.y0).toBe(baseResolved?.payload.y0);
    expect(oversizedSourceResolved?.payload.x1).toBe(baseResolved?.payload.x1);
    expect(oversizedSourceResolved?.payload.y1).toBe(baseResolved?.payload.y1);
    expect(oversizedSourceResolved?.payload.x2).toBe(baseResolved?.payload.x2);
    expect(oversizedSourceResolved?.payload.y2).toBe(baseResolved?.payload.y2);
    expect(oversizedSourceResolved?.payload.x3).toBe(baseResolved?.payload.x3);
    expect(oversizedSourceResolved?.payload.y3).toBe(baseResolved?.payload.y3);
  });

  it("uses static-atlas decal frames when available", () => {
    const atlasImage = { width: 512, height: 512, id: "static-atlas" } as any;
    const deps = makeDeps({
      getStaticAtlasProjectedDecalFrame: vi.fn(() => ({
        image: atlasImage,
        sx: 80,
        sy: 120,
        sw: 128,
        sh: 64,
      })),
      getRuntimeDecalSprite: vi.fn(() => {
        throw new Error("direct decal fallback should not run when atlas frame exists");
      }),
      getRuntimeIsoDecalCanvas: vi.fn(() => {
        throw new Error("direct decal bake should not run when atlas frame exists");
      }),
      getDiamondFitCanvas: vi.fn(() => {
        throw new Error("direct decal diamond should not run when atlas frame exists");
      }),
    });
    const decal = {
      tx: 2,
      ty: 3,
      zBase: 0,
      zLogical: 0,
      renderAnchorY: 0.55,
      setId: "road_markings",
      variantIndex: 0,
      rotationQuarterTurns: 0,
    } as any;

    const resolved = resolveGroundDecalProjectedCommand(decal, deps);

    expect(resolved?.payload.image).toBe(atlasImage);
    expect(resolved?.payload.sx).toBe(80);
    expect(resolved?.payload.sy).toBe(120);
    expect(resolved?.payload.sw).toBe(128);
    expect(resolved?.payload.sh).toBe(64);
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
