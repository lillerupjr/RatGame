import { describe, expect, it, vi } from "vitest";
import { collectGroundDrawables } from "../../../../game/systems/presentation/collection/collectGroundDrawables";
import type { RenderCommand } from "../../../../game/systems/presentation/contracts/renderCommands";
import { createRenderFrameBuilder } from "../../../../game/systems/presentation/frame/renderFrameBuilder";
import { KindOrder } from "../../../../game/systems/presentation/worldRenderOrdering";

describe("collectGroundDrawables", () => {
  it("normalizes authored square floor tops before emitting projected surfaces", () => {
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
      { semanticFamily: "groundSurface"; finalForm: "projectedSurface" }
    >["payload"];
    expect(getRuntimeIsoTopCanvas).toHaveBeenCalledWith(rawTopImage, 0);
    expect(command.semanticFamily).toBe("groundSurface");
    expect(command.finalForm).toBe("projectedSurface");
    expect(payload.image).toBe(normalizedTopImage);
    expect(payload.sourceWidth).toBe(128);
    expect(payload.sourceHeight).toBe(64);
    expect(payload.triangles).toHaveLength(2);
    expect(payload.triangles[0].srcPoints[0]).toEqual({ x: 64, y: 0 });
    expect(payload.triangles[1].srcPoints[2]).toEqual({ x: 0, y: 32 });
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
      { semanticFamily: "groundDecal"; finalForm: "projectedSurface" }
    >["payload"];

    expect(command.semanticFamily).toBe("groundDecal");
    expect(command.finalForm).toBe("projectedSurface");
    expect(payload.image).toBe(diamondDecal);
    expect(payload.triangles[0].dstPoints[0]).toEqual({ x: 0, y: -36 });
    expect(payload.triangles[0].dstPoints[1]).toEqual({ x: 64, y: -4 });
    expect(payload.triangles[0].dstPoints[2]).toEqual({ x: 0, y: 28 });
    expect(payload.triangles[1].dstPoints[2]).toEqual({ x: -64, y: -4 });
  });
});
