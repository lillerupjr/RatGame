import { describe, expect, it, vi } from "vitest";
import { collectEntityDrawables } from "../../../../game/systems/presentation/collection/collectEntityDrawables";
import { createRenderFrameBuilder } from "../../../../game/systems/presentation/frame/renderFrameBuilder";
import { PRJ_KIND } from "../../../../game/factories/projectileFactory";

function makeBaseInput(overrides: Record<string, unknown> = {}) {
  const frameBuilder = createRenderFrameBuilder();
  const baseWorld = {
    time: 0,
    timeSec: 0,
    xAlive: [],
    xKind: [],
    xValue: [],
    eAlive: [],
    eType: [],
    eFaceX: [],
    eFaceY: [],
    evx: [],
    evy: [],
    npcs: [],
    neutralMobs: [],
    pAlive: [],
    prHidden: [],
    prPlayerFireX: [],
    prPlayerFireY: [],
    prZVisual: [],
    prZ: [],
    prDirX: [],
    prDirY: [],
    prSpawnTime: [],
    prR: [],
    prjKind: [],
    prTtl: [],
    playerBeamActive: false,
    pzVisual: 0,
    pz: 0,
    _plDir: "S",
    _plMoving: false,
  };
  const input = {
    frameBuilder,
    w: baseWorld,
    T: 64,
    getPickupWorld: vi.fn(() => ({ wx: 32, wy: 32 })),
    KENNEY_TILE_WORLD: 64,
    isTileInRenderRadius: () => true,
    tileHAtWorld: () => 0,
    KindOrder: { ENTITY: 10, VFX: 20 },
    toScreen: () => ({ x: 40, y: 50 }),
    getCurrencyFrame: vi.fn(() => null),
    ctx: {} as CanvasRenderingContext2D,
    coinColorFromValue: vi.fn(),
    getEnemyWorld: vi.fn(() => ({ wx: 32, wy: 32 })),
    ez: [],
    getEntityFeetPos: vi.fn(() => ({ slice: 0, within: 0, screenX: 40, screenY: 50 })),
    registry: { enemy: vi.fn(() => ({ color: "#f66" })) },
    EnemyId: { BOSS: "BOSS" },
    getBossAccent: vi.fn(() => null),
    LOOT_GOBLIN_GLOW_PULSE_MIN: 0,
    LOOT_GOBLIN_GLOW_PULSE_RANGE: 0,
    LOOT_GOBLIN_GLOW_PULSE_SPEED: 0,
    LOOT_GOBLIN_GLOW_OUTER_RADIUS_MULT: 0,
    LOOT_GOBLIN_GLOW_INNER_RADIUS_MULT: 0,
    ISO_X: 1,
    ISO_Y: 1,
    getEnemySpriteFrame: vi.fn(() => null),
    RENDER_ENTITY_ANCHORS: false,
    resolveAnchor01: vi.fn(),
    ENTITY_ANCHOR_X01_DEFAULT: 0.5,
    ENTITY_ANCHOR_Y01_DEFAULT: 0.5,
    drawEntityAnchorDebug: false,
    vendorNpcSpritesReady: vi.fn(() => false),
    getVendorNpcSpriteFrame: vi.fn(() => null),
    snapPx: (value: number) => value,
    debug: {},
    toScreenAtZ: vi.fn(() => ({ x: 0, y: 0 })),
    getProjectileWorld: vi.fn(() => ({ wx: 32, wy: 32 })),
    playerTxForProjectileCull: 0,
    playerTyForProjectileCull: 0,
    projectileTileRenderRadius: 4,
    px: 0,
    py: 0,
    getSupportSurfaceAt: vi.fn(() => ({ worldZ: 0 })),
    compiledMap: {},
    ELEV_PX: 16,
    worldDeltaToScreen: vi.fn(() => ({ dx: 1, dy: 0 })),
    getSpriteById: vi.fn(() => null),
    playerSpritesReady: vi.fn(() => false),
    getPlayerSpriteFrame: vi.fn(() => null),
    PLAYER_R: 0,
    getDynamicAtlasFrameForImage: vi.fn(() => null),
    ...overrides,
  } as any;
  if (overrides.w) input.w = { ...baseWorld, ...(overrides.w as object) };
  return input;
}

function collectCommands(input: any): any[] {
  collectEntityDrawables(input);
  return Array.from(input.frameBuilder.sliceCommands.values()).flat() as any[];
}

describe("collectEntityDrawables", () => {
  it("keeps direct pickup frame lookup when no dynamic atlas frame exists", () => {
    const pickupImage = { width: 16, height: 16, id: "coin-frame" } as any;
    const input = makeBaseInput({
      w: {
        xAlive: [true],
        xKind: [1],
        xValue: [3],
      },
      getCurrencyFrame: vi.fn(() => ({ ready: true, img: pickupImage })),
    });

    const commands = collectCommands(input);
    const pickupCommand = commands.find((command) => command.payload.pickupIndex === 0);

    expect(pickupCommand).toBeTruthy();
    expect((pickupCommand as any).payload.image).toBe(pickupImage);
    expect((pickupCommand as any).payload.pickupKind).toBe(1);
  });

  it("routes pickup sprites through the dynamic atlas when a frame exists", () => {
    const pickupImage = { width: 16, height: 16, id: "coin-frame" } as any;
    const atlasImage = { width: 256, height: 256, id: "dynamic-atlas" } as any;
    const input = makeBaseInput({
      w: {
        xAlive: [true],
        xKind: [1],
        xValue: [3],
      },
      getCurrencyFrame: vi.fn(() => ({ ready: true, img: pickupImage })),
      getDynamicAtlasFrameForImage: vi.fn((image: object) => (
        image === pickupImage ? { image: atlasImage, sx: 11, sy: 13, sw: 16, sh: 16 } : null
      )),
    });

    const commands = collectCommands(input);
    const pickupCommand = commands.find((command) => command.payload.pickupIndex === 0);

    expect(pickupCommand?.payload.image).toBe(atlasImage);
    expect(pickupCommand?.payload.sx).toBe(11);
    expect(pickupCommand?.payload.sy).toBe(13);
    expect(pickupCommand?.payload.sw).toBe(16);
    expect(pickupCommand?.payload.sh).toBe(16);
  });

  it("routes enemy sprite-pack frames through the dynamic atlas", () => {
    const enemyImage = { width: 32, height: 32, id: "enemy-frame" } as any;
    const atlasImage = { width: 512, height: 512, id: "dynamic-atlas" } as any;
    const input = makeBaseInput({
      w: {
        eAlive: [true],
        eType: ["MINION"],
        eFaceX: [0],
        eFaceY: [1],
        evx: [0],
        evy: [0],
      },
      getEnemySpriteFrame: vi.fn(() => ({
        img: enemyImage,
        sx: 0,
        sy: 0,
        sw: 32,
        sh: 32,
        scale: 1,
        anchorX: 0.5,
        anchorY: 0.5,
      })),
      getDynamicAtlasFrameForImage: vi.fn((image: object) => (
        image === enemyImage ? { image: atlasImage, sx: 40, sy: 48, sw: 32, sh: 32 } : null
      )),
    });

    const commands = collectCommands(input);
    const enemyCommand = commands.find((command) => command.payload.enemyIndex === 0);

    expect(enemyCommand?.payload.image).toBe(atlasImage);
    expect(enemyCommand?.payload.sx).toBe(40);
    expect(enemyCommand?.payload.sy).toBe(48);
  });

  it("routes vendor NPC frames through the dynamic atlas", () => {
    const npcImage = { width: 24, height: 24, id: "vendor-frame" } as any;
    const atlasImage = { width: 512, height: 512, id: "dynamic-atlas" } as any;
    const input = makeBaseInput({
      w: {
        npcs: [{ wx: 32, wy: 32, dirCurrent: "S" }],
      },
      vendorNpcSpritesReady: vi.fn(() => true),
      getVendorNpcSpriteFrame: vi.fn(() => ({
        img: npcImage,
        sx: 0,
        sy: 0,
        sw: 24,
        sh: 24,
        scale: 1,
        anchorX: 0.5,
        anchorY: 0.5,
      })),
      getDynamicAtlasFrameForImage: vi.fn((image: object) => (
        image === npcImage ? { image: atlasImage, sx: 20, sy: 30, sw: 24, sh: 24 } : null
      )),
    });

    const commands = collectCommands(input);
    const npcCommand = commands.find((command) => command.payload.npcIndex === 0);

    expect(npcCommand?.payload.image).toBe(atlasImage);
    expect(npcCommand?.payload.sx).toBe(20);
    expect(npcCommand?.payload.sy).toBe(30);
  });

  it("routes neutral mob direct frames through the dynamic atlas", () => {
    const neutralFrame = { width: 20, height: 18, id: "pigeon-frame" } as any;
    const atlasImage = { width: 512, height: 512, id: "dynamic-atlas" } as any;
    const input = makeBaseInput({
      w: {
        neutralMobs: [{
          pos: { wx: 32, wy: 32, wzOffset: 0 },
          anim: { frameIndex: 0 },
          spriteFrames: [neutralFrame],
          render: {
            scale: 1,
            anchorX: 0.5,
            anchorY: 0.5,
            flipX: false,
          },
        }],
      },
      getDynamicAtlasFrameForImage: vi.fn((image: object) => (
        image === neutralFrame ? { image: atlasImage, sx: 70, sy: 80, sw: 20, sh: 18 } : null
      )),
    });

    const commands = collectCommands(input);
    const neutralCommand = commands.find((command) => command.payload.neutralMobIndex === 0);

    expect(neutralCommand?.payload.image).toBe(atlasImage);
    expect(neutralCommand?.payload.sx).toBe(70);
    expect(neutralCommand?.payload.sy).toBe(80);
  });

  it("routes projectile sprites through the dynamic atlas", () => {
    const projectileImage = { width: 12, height: 12, id: "knife" } as any;
    const atlasImage = { width: 256, height: 256, id: "dynamic-atlas" } as any;
    const getSpriteById = vi.fn((spriteId: string) => (
      spriteId === "projectiles/knife" ? { ready: true, img: projectileImage } : null
    ));
    const input = makeBaseInput({
      w: {
        pAlive: [true],
        prHidden: [false],
        prPlayerFireX: [0],
        prPlayerFireY: [0],
        prZVisual: [0],
        prDirX: [1],
        prDirY: [0],
        prSpawnTime: [0],
        prR: [4],
        prjKind: [PRJ_KIND.KNIFE],
      },
      getSpriteById,
      getDynamicAtlasFrameForImage: vi.fn((image: object) => (
        image === projectileImage ? { image: atlasImage, sx: 9, sy: 12, sw: 12, sh: 12 } : null
      )),
    });

    const commands = collectCommands(input);
    const projectileCommand = commands.find((command) => command.payload.projectileIndex === 0);

    expect(projectileCommand?.payload.image).toBe(atlasImage);
    expect(projectileCommand?.payload.sx).toBe(9);
    expect(projectileCommand?.payload.sy).toBe(12);
    expect(projectileCommand?.payload.rotationRad).toBe(0);
    expect(getSpriteById).toHaveBeenCalledWith("projectiles/knife");
  });

  it("selects animated projectile loop frames from prSpawnTime and preserves rotation", () => {
    const projectileImage = { width: 32, height: 32, id: "acid-loop-03" } as any;
    const atlasImage = { width: 256, height: 256, id: "dynamic-atlas" } as any;
    const getSpriteById = vi.fn((spriteId: string) => (
      spriteId === "vfx/projectiles/acid/loop/loop_03" ? { ready: true, img: projectileImage } : null
    ));
    const input = makeBaseInput({
      w: {
        timeSec: 0.12,
        pAlive: [true],
        prHidden: [false],
        prPlayerFireX: [0],
        prPlayerFireY: [0],
        prZVisual: [0],
        prDirX: [0],
        prDirY: [1],
        prSpawnTime: [0],
        prR: [4],
        prjKind: [PRJ_KIND.ACID],
      },
      getSpriteById,
      worldDeltaToScreen: vi.fn(() => ({ dx: 0, dy: 2 })),
      getDynamicAtlasFrameForImage: vi.fn((image: object) => (
        image === projectileImage ? { image: atlasImage, sx: 21, sy: 22, sw: 32, sh: 32 } : null
      )),
    });

    const commands = collectCommands(input);
    const projectileCommand = commands.find((command) => command.payload.projectileIndex === 0);

    expect(projectileCommand?.payload.image).toBe(atlasImage);
    expect(projectileCommand?.payload.sx).toBe(21);
    expect(projectileCommand?.payload.sy).toBe(22);
    expect(projectileCommand?.payload.rotationRad).toBeCloseTo(Math.PI / 2);
    expect(getSpriteById).toHaveBeenCalledWith("vfx/projectiles/acid/loop/loop_03");
  });

  it("emits composite bazooka body and exhaust through the same projectile path", () => {
    const bazookaBodyImage = { width: 36, height: 16, id: "bazooka-body" } as any;
    const exhaustImage = { width: 20, height: 20, id: "bazooka-exhaust" } as any;
    const atlasImage = { width: 512, height: 512, id: "dynamic-atlas" } as any;
    const getSpriteById = vi.fn((spriteId: string) => {
      if (spriteId === "projectiles/bazooka") return { ready: true, img: bazookaBodyImage };
      if (spriteId === "vfx/bazooka/exhaust_1/loop/loop_03") return { ready: true, img: exhaustImage };
      return null;
    });
    const input = makeBaseInput({
      w: {
        timeSec: 0.125,
        pAlive: [true],
        prHidden: [false],
        prPlayerFireX: [0],
        prPlayerFireY: [0],
        prZVisual: [0],
        prDirX: [1],
        prDirY: [0],
        prSpawnTime: [0],
        prR: [4],
        prjKind: [PRJ_KIND.MISSILE],
      },
      getSpriteById,
      getDynamicAtlasFrameForImage: vi.fn((image: object) => (
        image === bazookaBodyImage || image === exhaustImage
          ? { image: atlasImage, sx: 3, sy: 4, sw: (image as any).width, sh: (image as any).height }
          : null
      )),
    });

    const commands = collectCommands(input).filter((command) => command.payload.projectileIndex === 0);
    expect(commands).toHaveLength(2);

    const [exhaustCommand, bodyCommand] = commands;
    expect(exhaustCommand.key.stableId).toBeLessThan(bodyCommand.key.stableId);
    expect(exhaustCommand.payload.image).toBe(atlasImage);
    expect(exhaustCommand.payload.blendMode).toBe("additive");
    expect(exhaustCommand.payload.alpha).toBeCloseTo(0.95);
    expect(exhaustCommand.payload.rotationRad).toBeCloseTo(Math.PI / 2);
    expect(exhaustCommand.payload.dx).toBeCloseTo(0);
    expect(exhaustCommand.payload.dy).toBeCloseTo(45);

    expect(bodyCommand.payload.image).toBe(atlasImage);
    expect(bodyCommand.payload.rotationRad).toBeCloseTo(0);
    expect(bodyCommand.payload.dx).toBeCloseTo(22);
    expect(bodyCommand.payload.dy).toBeCloseTo(42);

    expect(getSpriteById).toHaveBeenCalledWith("projectiles/bazooka");
    expect(getSpriteById).toHaveBeenCalledWith("vfx/bazooka/exhaust_1/loop/loop_03");
  });

  it("routes player sprite-pack frames through the dynamic atlas", () => {
    const playerImage = { width: 32, height: 48, id: "player-frame" } as any;
    const atlasImage = { width: 512, height: 512, id: "dynamic-atlas" } as any;
    const input = makeBaseInput({
      playerSpritesReady: vi.fn(() => true),
      getPlayerSpriteFrame: vi.fn(() => ({
        img: playerImage,
        sx: 0,
        sy: 0,
        sw: 32,
        sh: 48,
        scale: 1,
        anchorX: 0.5,
        anchorY: 0.75,
      })),
      getDynamicAtlasFrameForImage: vi.fn((image: object) => (
        image === playerImage ? { image: atlasImage, sx: 90, sy: 100, sw: 32, sh: 48 } : null
      )),
    });

    const commands = collectCommands(input);
    const playerCommand = commands.find((command) => command.key.stableId === 0);

    expect(playerCommand?.payload.image).toBe(atlasImage);
    expect(playerCommand?.payload.sx).toBe(90);
    expect(playerCommand?.payload.sy).toBe(100);
  });
});
