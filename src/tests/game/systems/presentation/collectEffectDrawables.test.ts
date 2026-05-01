import { describe, expect, it, vi } from "vitest";
import { collectEffectDrawables } from "../../../../game/systems/presentation/collection/collectEffectDrawables";
import { createRenderFrameBuilder } from "../../../../game/systems/presentation/frame/renderFrameBuilder";

describe("collectEffectDrawables", () => {
  it("routes VFX sprites through the dynamic atlas when a frame exists", () => {
    const frameBuilder = createRenderFrameBuilder();
    const vfxImage = { width: 64, height: 64, id: "explosion-frame" } as any;
    const atlasImage = { width: 512, height: 512, id: "dynamic-atlas" } as any;
    const input = {
      frameBuilder,
      w: {
        zAlive: [],
        vfxAlive: [true],
        vfxX: [64],
        vfxY: [64],
        vfxClipId: [0],
        vfxElapsed: [0],
        vfxRadius: [0],
        vfxScale: [1],
        vfxOffsetYPx: [0],
      },
      T: 64,
      ZONE_KIND: {},
      getZoneWorld: vi.fn(),
      KENNEY_TILE_WORLD: 64,
      snapToNearestWalkableGround: vi.fn(),
      isTileInRenderRadius: () => true,
      KindOrder: { ENTITY: 10, VFX: 20 },
      toScreen: () => ({ x: 100, y: 120 }),
      ISO_X: 1,
      ISO_Y: 1,
      renderFireZoneVfx: vi.fn(),
      getSpriteById: vi.fn(() => ({ ready: true, img: vfxImage })),
      VFX_CLIPS: [{ spriteIds: ["vfx/explosion_1/1_frame_01"], fps: 20, loop: false }],
      tileHAtWorld: () => 0,
      ctx: {} as CanvasRenderingContext2D,
      getDynamicAtlasFrameForImage: vi.fn((image: object) => (
        image === vfxImage ? { image: atlasImage, sx: 14, sy: 18, sw: 64, sh: 64 } : null
      )),
    } as any;

    collectEffectDrawables(input);

    const commands = Array.from(frameBuilder.sliceCommands.values()).flat() as any[];
    const vfxCommand = commands.find((command) => command.payload.vfxIndex === 0);

    expect(vfxCommand?.payload.image).toBe(atlasImage);
    expect(vfxCommand?.payload.sx).toBe(14);
    expect(vfxCommand?.payload.sy).toBe(18);
  });

  it("routes ground-decal VFX through the world primitive path", () => {
    const frameBuilder = createRenderFrameBuilder();
    const vfxImage = { width: 64, height: 64, id: "ground-vfx-frame" } as any;
    const input = {
      frameBuilder,
      w: {
        zAlive: [],
        vfxAlive: [true],
        vfxX: [96],
        vfxY: [160],
        vfxClipId: [0],
        vfxElapsed: [0],
        vfxRadius: [0],
        vfxScale: [1.2],
        vfxOffsetYPx: [0],
      },
      T: 64,
      ZONE_KIND: {},
      getZoneWorld: vi.fn(),
      KENNEY_TILE_WORLD: 64,
      snapToNearestWalkableGround: vi.fn(),
      isTileInRenderRadius: () => true,
      KindOrder: { ENTITY: 10, VFX: 20 },
      toScreen: () => ({ x: 100, y: 120 }),
      ISO_X: 1,
      ISO_Y: 1,
      renderFireZoneVfx: vi.fn(),
      getSpriteById: vi.fn(() => ({ ready: true, img: vfxImage })),
      VFX_CLIPS: [{ spriteIds: ["vfx/explosions/3_green/explosion-f1"], fps: 18, loop: false, projection: "ground_decal" }],
      tileHAtWorld: () => 0,
      ctx: {} as CanvasRenderingContext2D,
      getDynamicAtlasFrameForImage: vi.fn(),
    } as any;

    collectEffectDrawables(input);

    const commands = Array.from(frameBuilder.sliceCommands.values()).flat() as any[];
    const vfxCommand = commands.find((command) => command.payload.groundVfx);

    expect(vfxCommand?.semanticFamily).toBe("worldPrimitive");
    expect(vfxCommand?.payload.groundVfx).toMatchObject({
      image: vfxImage,
      tx: 1,
      ty: 2,
      scale: 1.2,
    });
  });

  it("prefers explicit VFX scale over radius-derived sizing for billboards", () => {
    const frameBuilder = createRenderFrameBuilder();
    const vfxImage = { width: 64, height: 64, id: "scaled-vfx-frame" } as any;
    const input = {
      frameBuilder,
      w: {
        zAlive: [],
        vfxAlive: [true],
        vfxX: [64],
        vfxY: [64],
        vfxClipId: [0],
        vfxElapsed: [0],
        vfxRadius: [128],
        vfxScale: [2],
        vfxOffsetYPx: [0],
      },
      T: 64,
      ZONE_KIND: {},
      getZoneWorld: vi.fn(),
      KENNEY_TILE_WORLD: 64,
      snapToNearestWalkableGround: vi.fn(),
      isTileInRenderRadius: () => true,
      KindOrder: { ENTITY: 10, VFX: 20 },
      toScreen: () => ({ x: 100, y: 120 }),
      ISO_X: 1,
      ISO_Y: 1,
      renderFireZoneVfx: vi.fn(),
      getSpriteById: vi.fn(() => ({ ready: true, img: vfxImage })),
      VFX_CLIPS: [{ spriteIds: ["vfx/explosions/1/explosion-b1"], fps: 18, loop: false, projection: "billboard" }],
      tileHAtWorld: () => 0,
      ctx: {} as CanvasRenderingContext2D,
      getDynamicAtlasFrameForImage: vi.fn(() => null),
    } as any;

    collectEffectDrawables(input);

    const commands = Array.from(frameBuilder.sliceCommands.values()).flat() as any[];
    const vfxCommand = commands.find((command) => command.payload.vfxIndex === 0);

    expect(vfxCommand?.payload.dw).toBe(128);
    expect(vfxCommand?.payload.dh).toBe(128);
  });

  it("renders boss cast world effects through the existing world quad path", () => {
    const frameBuilder = createRenderFrameBuilder();
    const radioactiveImage = { width: 64, height: 64, id: "radioactive-icon" } as any;
    const atlasImage = { width: 256, height: 256, id: "dynamic-atlas-radioactive" } as any;
    const input = {
      frameBuilder,
      w: {
        zAlive: [],
        vfxAlive: [],
        timeSec: 0.125,
        bossRuntime: {
          encounters: [
            {
              activeCast: {
                worldEffects: [
                  {
                    id: "telegraph_1",
                    spriteId: "vfx/icons/radioactive",
                    worldX: 160,
                    worldY: 224,
                    baseScale: 0.9,
                    alpha: 0.95,
                    pulse: {
                      minScale: 0.9,
                      maxScale: 1.1,
                      cycleSec: 0.5,
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      T: 64,
      ZONE_KIND: {},
      getZoneWorld: vi.fn(),
      KENNEY_TILE_WORLD: 64,
      snapToNearestWalkableGround: vi.fn(),
      isTileInRenderRadius: () => true,
      KindOrder: { ENTITY: 10, VFX: 20 },
      toScreen: (x: number, y: number) => ({ x, y }),
      ISO_X: 1,
      ISO_Y: 1,
      renderFireZoneVfx: vi.fn(),
      getSpriteById: vi.fn((spriteId: string) => (
        spriteId === "vfx/icons/radioactive" ? { ready: true, img: radioactiveImage } : null
      )),
      VFX_CLIPS: [],
      tileHAtWorld: () => 0,
      ctx: {} as CanvasRenderingContext2D,
      getDynamicAtlasFrameForImage: vi.fn((image: object) => (
        image === radioactiveImage ? { image: atlasImage, sx: 8, sy: 12, sw: 64, sh: 64 } : null
      )),
    } as any;

    collectEffectDrawables(input);

    const commands = Array.from(frameBuilder.sliceCommands.values()).flat() as any[];
    const worldEffectCommand = commands.find((command) => (
      command.semanticFamily === "worldSprite"
      && command.finalForm === "quad"
      && command.payload.image === atlasImage
    ));

    expect(worldEffectCommand?.payload).toMatchObject({
      image: atlasImage,
      sx: 8,
      sy: 12,
      sw: 64,
      sh: 64,
      alpha: 0.95,
    });
    expect(worldEffectCommand?.payload.dw).toBeGreaterThan(57);
    expect(worldEffectCommand?.payload.dh).toBeGreaterThan(57);
  });

  it("routes projected boss cast world effects through the ground projection path", () => {
    const frameBuilder = createRenderFrameBuilder();
    const radioactiveImage = { width: 64, height: 64, id: "radioactive-icon" } as any;
    const input = {
      frameBuilder,
      w: {
        zAlive: [],
        vfxAlive: [],
        timeSec: 0.125,
        bossRuntime: {
          encounters: [
            {
              activeCast: {
                worldEffects: [
                  {
                    id: "telegraph_projected",
                    spriteId: "vfx/icons/radioactive",
                    worldX: 224,
                    worldY: 224,
                    tileTx: 3,
                    tileTy: 3,
                    projectionMode: "ground_iso",
                    baseScale: 0.9,
                    alpha: 0.95,
                  },
                ],
              },
            },
          ],
        },
      },
      T: 64,
      ZONE_KIND: {},
      getZoneWorld: vi.fn(),
      KENNEY_TILE_WORLD: 64,
      snapToNearestWalkableGround: vi.fn(),
      isTileInRenderRadius: () => true,
      KindOrder: { ENTITY: 10, VFX: 20 },
      toScreen: (x: number, y: number) => ({ x, y }),
      ISO_X: 1,
      ISO_Y: 1,
      renderFireZoneVfx: vi.fn(),
      getSpriteById: vi.fn((spriteId: string) => (
        spriteId === "vfx/icons/radioactive" ? { ready: true, img: radioactiveImage } : null
      )),
      VFX_CLIPS: [],
      tileHAtWorld: () => 0,
      ctx: {} as CanvasRenderingContext2D,
      getDynamicAtlasFrameForImage: vi.fn(),
    } as any;

    collectEffectDrawables(input);

    const commands = Array.from(frameBuilder.sliceCommands.values()).flat() as any[];
    const projectedCommand = commands.find((command) => command.payload.groundVfx?.bossWorldEffectId === "telegraph_projected");

    expect(projectedCommand?.semanticFamily).toBe("worldPrimitive");
    expect(projectedCommand?.payload.groundVfx).toMatchObject({
      image: radioactiveImage,
      tx: 3,
      ty: 3,
      scale: 0.9,
      bossWorldEffectId: "telegraph_projected",
    });
  });
});
