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
});
