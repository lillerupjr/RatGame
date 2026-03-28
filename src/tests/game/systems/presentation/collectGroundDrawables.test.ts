import { describe, expect, it, vi } from "vitest";
import { collectGroundDrawables } from "../../../../game/systems/presentation/collection/collectGroundDrawables";
import type { RenderCommand } from "../../../../game/systems/presentation/contracts/renderCommands";
import { createRenderFrameBuilder } from "../../../../game/systems/presentation/frame/renderFrameBuilder";
import { KindOrder } from "../../../../game/systems/presentation/worldRenderOrdering";

describe("collectGroundDrawables", () => {
  it("normalizes authored square floor tops before emitting quad-native ground surfaces", () => {
    const frameBuilder = createRenderFrameBuilder();
    const rawTopImage = { width: 128, height: 128 } as any;
    const normalizedTopImage = { width: 128, height: 64 } as any;
    const getRuntimeIsoTopCanvas = vi.fn(() => normalizedTopImage);

    collectGroundDrawables({
      w: {
        timeSec: 0,
        time: 0,
        eAlive: [],
        npcs: [],
        neutralMobs: [],
        pzVisual: 0,
        pz: 0,
      },
      minSum: 0,
      maxSum: 0,
      minTy: 0,
      maxTy: 0,
      minTx: 0,
      maxTx: 0,
      isTileInRenderRadius: () => true,
      countRenderTileLoopIteration: () => {},
      surfacesAtXYCached: () => [{
        id: "surface_0_0",
        tx: 0,
        ty: 0,
        tile: { kind: "FLOOR", h: 0 },
        renderTopKind: "FLOOR",
        zLogical: 0,
        zBase: 0,
        renderAnchorY: 0.55,
        spriteIdTop: "tiles/floor/sidewalk/1",
      }],
      RENDER_ALL_HEIGHTS: true,
      activeH: 0,
      shouldCullBuildingAt: () => false,
      frameBuilder,
      ANCHOR_Y: 0.55,
      TILE_ID_OCEAN: "OCEAN",
      getAnimatedTileFrame: vi.fn(),
      OCEAN_ANIM_TIME_SCALE: 0.25,
      getTileSpriteById: vi.fn(() => ({ ready: true, img: rawTopImage })),
      getRuntimeIsoTopCanvas,
      OCEAN_TOP_SCALE: 4,
      STAIR_TOP_SCALE: 1,
      FLOOR_TOP_SCALE: 1,
      OCEAN_BASE_FRAME_PX: 32,
      getRuntimeIsoDecalCanvas: vi.fn(),
      getDiamondFitCanvas: vi.fn(),
      getRuntimeDecalSprite: vi.fn(),
      T: 64,
      worldToScreen: (x: number, y: number) => ({ x: x - y, y: (x + y) * 0.5 }),
      camX: 0,
      camY: 0,
      ELEV_PX: 16,
      STAIR_TOP_DY: 8,
      decalsInView: () => [],
      viewRect: null,
      KindOrder,
      getZoneTrialObjectiveState: () => null,
      compiledMap: { originTx: 0, originTy: 0 },
      tileHAtWorld: () => 0,
      RENDER_ENTITY_SHADOWS: false,
      rampRoadTiles: new Set<string>(),
      staticRelightFrame: null,
      staticRelightBakeStore: new Map(),
      floorRelightPieceKey: vi.fn(),
      decalRelightPieceKey: vi.fn(),
      roadMarkingDecalScale: vi.fn(() => 1),
      shouldPixelSnapRoadMarking: vi.fn(() => false),
      SIDEWALK_SRC_SIZE: 128,
      SIDEWALK_ISO_HEIGHT: 64,
      snapPx: (value: number) => Math.floor(value),
      getRampQuadPoints: vi.fn(),
    } as any);

    const commands = Array.from(frameBuilder.sliceCommands.values()).flat();
    expect(commands).toHaveLength(1);

    const command = commands[0];
    const payload = command.payload as Extract<
      RenderCommand,
      { semanticFamily: "groundSurface"; finalForm: "quad" }
    >["payload"];
    expect(getRuntimeIsoTopCanvas).toHaveBeenCalledWith(rawTopImage, 0);
    expect(command.semanticFamily).toBe("groundSurface");
    expect(command.finalForm).toBe("quad");
    expect(payload.image).toBe(normalizedTopImage);
    expect(payload.sw).toBe(128);
    expect(payload.sh).toBe(64);
    expect(payload.sourceQuad).toEqual({
      nw: { x: 64, y: 0 },
      ne: { x: 128, y: 32 },
      se: { x: 64, y: 64 },
      sw: { x: 0, y: 32 },
    });
    expect(payload.kind).toBe("iso");
    expect(payload.x0).toBe(0);
    expect(payload.y0).toBe(-4);
    expect(payload.x1).toBe(64);
    expect(payload.y1).toBe(28);
    expect(payload.x2).toBe(0);
    expect(payload.y2).toBe(60);
    expect(payload.x3).toBe(-64);
    expect(payload.y3).toBe(28);
  });

  it("anchors flat ground decals from the tile origin center instead of the tile-corner diamond", () => {
    const frameBuilder = createRenderFrameBuilder();
    const bakedDecal = { width: 48, height: 24 } as any;
    const diamondDecal = { width: 128, height: 64 } as any;

    collectGroundDrawables({
      w: {
        timeSec: 0,
        time: 0,
        eAlive: [],
        npcs: [],
        neutralMobs: [],
        pzVisual: 0,
        pz: 0,
      },
      minSum: 0,
      maxSum: 0,
      minTy: 0,
      maxTy: 0,
      minTx: 0,
      maxTx: 0,
      isTileInRenderRadius: () => true,
      countRenderTileLoopIteration: () => {},
      surfacesAtXYCached: () => [],
      RENDER_ALL_HEIGHTS: true,
      activeH: 0,
      shouldCullBuildingAt: () => false,
      frameBuilder,
      ANCHOR_Y: 0.55,
      TILE_ID_OCEAN: "OCEAN",
      getAnimatedTileFrame: vi.fn(),
      OCEAN_ANIM_TIME_SCALE: 0.25,
      getTileSpriteById: vi.fn(),
      getRuntimeIsoTopCanvas: vi.fn(),
      OCEAN_TOP_SCALE: 4,
      STAIR_TOP_SCALE: 1,
      FLOOR_TOP_SCALE: 1,
      OCEAN_BASE_FRAME_PX: 32,
      getRuntimeIsoDecalCanvas: vi.fn(() => bakedDecal),
      getDiamondFitCanvas: vi.fn(() => diamondDecal),
      getRuntimeDecalSprite: vi.fn(() => ({ ready: true, img: { width: 32, height: 16 } })),
      T: 64,
      worldToScreen: (x: number, y: number) => ({ x: x - y, y: (x + y) * 0.5 }),
      camX: 0,
      camY: 0,
      ELEV_PX: 16,
      STAIR_TOP_DY: 8,
      decalsInView: () => [{
        tx: 0,
        ty: 0,
        zLogical: 0,
        zBase: 0,
        renderAnchorY: 0.55,
        setId: "lane_marking",
        variantIndex: 0,
        rotationQuarterTurns: 0,
      }],
      viewRect: null,
      KindOrder,
      getZoneTrialObjectiveState: () => null,
      compiledMap: { originTx: 0, originTy: 0 },
      tileHAtWorld: () => 0,
      RENDER_ENTITY_SHADOWS: false,
      rampRoadTiles: new Set<string>(),
      staticRelightFrame: null,
      staticRelightBakeStore: new Map(),
      floorRelightPieceKey: vi.fn(),
      decalRelightPieceKey: vi.fn(),
      roadMarkingDecalScale: vi.fn(() => 1),
      shouldPixelSnapRoadMarking: vi.fn(() => false),
      SIDEWALK_SRC_SIZE: 128,
      SIDEWALK_ISO_HEIGHT: 64,
      snapPx: (value: number) => Math.floor(value),
      getRampQuadPoints: vi.fn(),
    } as any);

    const commands = Array.from(frameBuilder.sliceCommands.values()).flat();
    expect(commands).toHaveLength(1);

    const command = commands[0];
    const payload = command.payload as Extract<
      RenderCommand,
      { semanticFamily: "groundDecal"; finalForm: "quad" }
    >["payload"];

    expect(command.semanticFamily).toBe("groundDecal");
    expect(command.finalForm).toBe("quad");
    expect(payload.image).toBe(diamondDecal);
    expect(payload.kind).toBe("iso");
    expect(payload.sourceQuad).toEqual({
      nw: { x: 64, y: 0 },
      ne: { x: 128, y: 32 },
      se: { x: 64, y: 64 },
      sw: { x: 0, y: 32 },
    });
    expect(payload.x0).toBe(0);
    expect(payload.y0).toBe(-36);
    expect(payload.x1).toBe(64);
    expect(payload.y1).toBe(-4);
    expect(payload.x2).toBe(0);
    expect(payload.y2).toBe(28);
    expect(payload.x3).toBe(-64);
    expect(payload.y3).toBe(-4);
  });

  it("suppresses authoritative static floor surfaces before resolve/enqueue", () => {
    const frameBuilder = createRenderFrameBuilder();
    const getRuntimeIsoTopCanvas = vi.fn();
    const countExamined = vi.fn();
    const countFiltered = vi.fn();
    const countFallback = vi.fn();

    collectGroundDrawables({
      w: { timeSec: 0, time: 0, eAlive: [], npcs: [], neutralMobs: [], pzVisual: 0, pz: 0 },
      minSum: 0,
      maxSum: 0,
      minTy: 0,
      maxTy: 0,
      minTx: 0,
      maxTx: 0,
      isTileInRenderRadius: () => true,
      countRenderTileLoopIteration: () => {},
      surfacesAtXYCached: () => [{
        id: "surface_0_0",
        tx: 0,
        ty: 0,
        tile: { kind: "FLOOR", h: 0 },
        renderTopKind: "FLOOR",
        zLogical: 0,
        zBase: 0,
        renderAnchorY: 0.55,
        spriteIdTop: "tiles/floor/sidewalk/1",
      }],
      RENDER_ALL_HEIGHTS: true,
      activeH: 0,
      shouldCullBuildingAt: () => false,
      frameBuilder,
      ANCHOR_Y: 0.55,
      TILE_ID_OCEAN: "OCEAN",
      getAnimatedTileFrame: vi.fn(),
      OCEAN_ANIM_TIME_SCALE: 0.25,
      getTileSpriteById: vi.fn(() => ({ ready: true, img: { width: 128, height: 128 } })),
      getRuntimeIsoTopCanvas,
      OCEAN_TOP_SCALE: 4,
      STAIR_TOP_SCALE: 1,
      FLOOR_TOP_SCALE: 1,
      OCEAN_BASE_FRAME_PX: 32,
      getRuntimeIsoDecalCanvas: vi.fn(),
      getDiamondFitCanvas: vi.fn(),
      getRuntimeDecalSprite: vi.fn(),
      T: 64,
      worldToScreen: (x: number, y: number) => ({ x: x - y, y: (x + y) * 0.5 }),
      camX: 0,
      camY: 0,
      ELEV_PX: 16,
      STAIR_TOP_DY: 8,
      decalsInView: () => [],
      viewRect: { minTx: 0, maxTx: 0, minTy: 0, maxTy: 0 },
      KindOrder,
      getZoneTrialObjectiveState: () => null,
      compiledMap: { originTx: 0, originTy: 0 },
      tileHAtWorld: () => 0,
      RENDER_ENTITY_SHADOWS: false,
      isGroundChunkTileAuthoritative: () => true,
      countRenderGroundStaticSurfaceExamined: countExamined,
      countRenderGroundStaticSurfaceAuthorityFiltered: countFiltered,
      countRenderGroundStaticSurfaceFallbackEmitted: countFallback,
      rampRoadTiles: new Set<string>(),
      staticRelightFrame: null,
      staticRelightBakeStore: new Map(),
      floorRelightPieceKey: vi.fn(),
      decalRelightPieceKey: vi.fn(),
      roadMarkingDecalScale: vi.fn(() => 1),
      shouldPixelSnapRoadMarking: vi.fn(() => false),
      SIDEWALK_SRC_SIZE: 128,
      SIDEWALK_ISO_HEIGHT: 64,
      snapPx: (value: number) => Math.floor(value),
      getRampQuadPoints: vi.fn(),
    } as any);

    const commands = Array.from(frameBuilder.sliceCommands.values()).flat();
    expect(commands).toHaveLength(0);
    expect(getRuntimeIsoTopCanvas).not.toHaveBeenCalled();
    expect(countExamined).toHaveBeenCalledTimes(1);
    expect(countFiltered).toHaveBeenCalledTimes(1);
    expect(countFallback).not.toHaveBeenCalled();
  });

  it("falls back to per-tile emission when static floor chunk authority is unavailable", () => {
    const frameBuilder = createRenderFrameBuilder();
    const normalizedTopImage = { width: 128, height: 64 } as any;
    const countExamined = vi.fn();
    const countFiltered = vi.fn();
    const countFallback = vi.fn();

    collectGroundDrawables({
      w: { timeSec: 0, time: 0, eAlive: [], npcs: [], neutralMobs: [], pzVisual: 0, pz: 0 },
      minSum: 0,
      maxSum: 0,
      minTy: 0,
      maxTy: 0,
      minTx: 0,
      maxTx: 0,
      isTileInRenderRadius: () => true,
      countRenderTileLoopIteration: () => {},
      surfacesAtXYCached: () => [{
        id: "surface_0_0",
        tx: 0,
        ty: 0,
        tile: { kind: "FLOOR", h: 0 },
        renderTopKind: "FLOOR",
        zLogical: 0,
        zBase: 0,
        renderAnchorY: 0.55,
        spriteIdTop: "tiles/floor/sidewalk/1",
      }],
      RENDER_ALL_HEIGHTS: true,
      activeH: 0,
      shouldCullBuildingAt: () => false,
      frameBuilder,
      ANCHOR_Y: 0.55,
      TILE_ID_OCEAN: "OCEAN",
      getAnimatedTileFrame: vi.fn(),
      OCEAN_ANIM_TIME_SCALE: 0.25,
      getTileSpriteById: vi.fn(() => ({ ready: true, img: { width: 128, height: 128 } })),
      getRuntimeIsoTopCanvas: vi.fn(() => normalizedTopImage),
      OCEAN_TOP_SCALE: 4,
      STAIR_TOP_SCALE: 1,
      FLOOR_TOP_SCALE: 1,
      OCEAN_BASE_FRAME_PX: 32,
      getRuntimeIsoDecalCanvas: vi.fn(),
      getDiamondFitCanvas: vi.fn(),
      getRuntimeDecalSprite: vi.fn(),
      T: 64,
      worldToScreen: (x: number, y: number) => ({ x: x - y, y: (x + y) * 0.5 }),
      camX: 0,
      camY: 0,
      ELEV_PX: 16,
      STAIR_TOP_DY: 8,
      decalsInView: () => [],
      viewRect: { minTx: 0, maxTx: 0, minTy: 0, maxTy: 0 },
      KindOrder,
      getZoneTrialObjectiveState: () => null,
      compiledMap: { originTx: 0, originTy: 0 },
      tileHAtWorld: () => 0,
      RENDER_ENTITY_SHADOWS: false,
      isGroundChunkTileAuthoritative: () => false,
      countRenderGroundStaticSurfaceExamined: countExamined,
      countRenderGroundStaticSurfaceAuthorityFiltered: countFiltered,
      countRenderGroundStaticSurfaceFallbackEmitted: countFallback,
      rampRoadTiles: new Set<string>(),
      staticRelightFrame: null,
      staticRelightBakeStore: new Map(),
      floorRelightPieceKey: vi.fn(),
      decalRelightPieceKey: vi.fn(),
      roadMarkingDecalScale: vi.fn(() => 1),
      shouldPixelSnapRoadMarking: vi.fn(() => false),
      SIDEWALK_SRC_SIZE: 128,
      SIDEWALK_ISO_HEIGHT: 64,
      snapPx: (value: number) => Math.floor(value),
      getRampQuadPoints: vi.fn(),
    } as any);

    const commands = Array.from(frameBuilder.sliceCommands.values()).flat();
    expect(commands).toHaveLength(1);
    expect(countExamined).toHaveBeenCalledTimes(1);
    expect(countFiltered).not.toHaveBeenCalled();
    expect(countFallback).toHaveBeenCalledTimes(1);
  });

  it("keeps animated ocean on the per-tile path even when chunk authority is available", () => {
    const frameBuilder = createRenderFrameBuilder();
    const oceanImage = { width: 32, height: 32 } as any;
    const projectedOcean = { width: 128, height: 64 } as any;
    const countExamined = vi.fn();
    const countFiltered = vi.fn();
    const countFallback = vi.fn();

    collectGroundDrawables({
      w: { timeSec: 0, time: 0, eAlive: [], npcs: [], neutralMobs: [], pzVisual: 0, pz: 0 },
      minSum: 0,
      maxSum: 0,
      minTy: 0,
      maxTy: 0,
      minTx: 0,
      maxTx: 0,
      isTileInRenderRadius: () => true,
      countRenderTileLoopIteration: () => {},
      surfacesAtXYCached: () => [{
        id: "surface_0_0",
        tx: 0,
        ty: 0,
        tile: { kind: "OCEAN", h: 0 },
        renderTopKind: "FLOOR",
        zLogical: 0,
        zBase: 0,
        renderAnchorY: 0.55,
        spriteIdTop: "tiles/ocean/0",
      }],
      RENDER_ALL_HEIGHTS: true,
      activeH: 0,
      shouldCullBuildingAt: () => false,
      frameBuilder,
      ANCHOR_Y: 0.55,
      TILE_ID_OCEAN: "OCEAN",
      getAnimatedTileFrame: vi.fn(() => ({ ready: true, img: oceanImage })),
      OCEAN_ANIM_TIME_SCALE: 0.25,
      getTileSpriteById: vi.fn(),
      getRuntimeIsoTopCanvas: vi.fn(),
      OCEAN_TOP_SCALE: 4,
      STAIR_TOP_SCALE: 1,
      FLOOR_TOP_SCALE: 1,
      OCEAN_BASE_FRAME_PX: 32,
      getRuntimeIsoDecalCanvas: vi.fn(() => projectedOcean),
      getDiamondFitCanvas: vi.fn(),
      getRuntimeDecalSprite: vi.fn(),
      T: 64,
      worldToScreen: (x: number, y: number) => ({ x: x - y, y: (x + y) * 0.5 }),
      camX: 0,
      camY: 0,
      ELEV_PX: 16,
      STAIR_TOP_DY: 8,
      decalsInView: () => [],
      viewRect: { minTx: 0, maxTx: 0, minTy: 0, maxTy: 0 },
      KindOrder,
      getZoneTrialObjectiveState: () => null,
      compiledMap: { originTx: 0, originTy: 0 },
      tileHAtWorld: () => 0,
      RENDER_ENTITY_SHADOWS: false,
      isGroundChunkTileAuthoritative: () => true,
      countRenderGroundStaticSurfaceExamined: countExamined,
      countRenderGroundStaticSurfaceAuthorityFiltered: countFiltered,
      countRenderGroundStaticSurfaceFallbackEmitted: countFallback,
      rampRoadTiles: new Set<string>(),
      staticRelightFrame: null,
      staticRelightBakeStore: new Map(),
      floorRelightPieceKey: vi.fn(),
      decalRelightPieceKey: vi.fn(),
      roadMarkingDecalScale: vi.fn(() => 1),
      shouldPixelSnapRoadMarking: vi.fn(() => false),
      SIDEWALK_SRC_SIZE: 128,
      SIDEWALK_ISO_HEIGHT: 64,
      snapPx: (value: number) => Math.floor(value),
      getRampQuadPoints: vi.fn(),
    } as any);

    const commands = Array.from(frameBuilder.sliceCommands.values()).flat();
    expect(commands).toHaveLength(1);
    expect(countExamined).not.toHaveBeenCalled();
    expect(countFiltered).not.toHaveBeenCalled();
    expect(countFallback).not.toHaveBeenCalled();
  });

  it("suppresses authoritative static decals before resolve/enqueue", () => {
    const frameBuilder = createRenderFrameBuilder();
    const getRuntimeDecalSprite = vi.fn();
    const countExamined = vi.fn();
    const countFiltered = vi.fn();
    const countFallback = vi.fn();

    collectGroundDrawables({
      w: { timeSec: 0, time: 0, eAlive: [], npcs: [], neutralMobs: [], pzVisual: 0, pz: 0 },
      minSum: 0,
      maxSum: 0,
      minTy: 0,
      maxTy: 0,
      minTx: 0,
      maxTx: 0,
      isTileInRenderRadius: () => true,
      countRenderTileLoopIteration: () => {},
      surfacesAtXYCached: () => [],
      RENDER_ALL_HEIGHTS: true,
      activeH: 0,
      shouldCullBuildingAt: () => false,
      frameBuilder,
      ANCHOR_Y: 0.55,
      TILE_ID_OCEAN: "OCEAN",
      getAnimatedTileFrame: vi.fn(),
      OCEAN_ANIM_TIME_SCALE: 0.25,
      getTileSpriteById: vi.fn(),
      getRuntimeIsoTopCanvas: vi.fn(),
      OCEAN_TOP_SCALE: 4,
      STAIR_TOP_SCALE: 1,
      FLOOR_TOP_SCALE: 1,
      OCEAN_BASE_FRAME_PX: 32,
      getRuntimeIsoDecalCanvas: vi.fn(),
      getDiamondFitCanvas: vi.fn(),
      getRuntimeDecalSprite,
      T: 64,
      worldToScreen: (x: number, y: number) => ({ x: x - y, y: (x + y) * 0.5 }),
      camX: 0,
      camY: 0,
      ELEV_PX: 16,
      STAIR_TOP_DY: 8,
      decalsInView: () => [{
        tx: 0,
        ty: 0,
        zLogical: 0,
        zBase: 0,
        renderAnchorY: 0.55,
        setId: "lane_marking",
        variantIndex: 0,
        rotationQuarterTurns: 0,
      }],
      viewRect: { minTx: 0, maxTx: 0, minTy: 0, maxTy: 0 },
      KindOrder,
      getZoneTrialObjectiveState: () => null,
      compiledMap: { originTx: 0, originTy: 0 },
      tileHAtWorld: () => 0,
      RENDER_ENTITY_SHADOWS: false,
      isGroundChunkTileAuthoritative: () => true,
      countRenderGroundStaticDecalExamined: countExamined,
      countRenderGroundStaticDecalAuthorityFiltered: countFiltered,
      countRenderGroundStaticDecalFallbackEmitted: countFallback,
      rampRoadTiles: new Set<string>(),
      staticRelightFrame: null,
      staticRelightBakeStore: new Map(),
      floorRelightPieceKey: vi.fn(),
      decalRelightPieceKey: vi.fn(),
      roadMarkingDecalScale: vi.fn(() => 1),
      shouldPixelSnapRoadMarking: vi.fn(() => false),
      SIDEWALK_SRC_SIZE: 128,
      SIDEWALK_ISO_HEIGHT: 64,
      snapPx: (value: number) => Math.floor(value),
      getRampQuadPoints: vi.fn(),
    } as any);

    const commands = Array.from(frameBuilder.sliceCommands.values()).flat();
    expect(commands).toHaveLength(0);
    expect(getRuntimeDecalSprite).not.toHaveBeenCalled();
    expect(countExamined).toHaveBeenCalledTimes(1);
    expect(countFiltered).toHaveBeenCalledTimes(1);
    expect(countFallback).not.toHaveBeenCalled();
  });
});
