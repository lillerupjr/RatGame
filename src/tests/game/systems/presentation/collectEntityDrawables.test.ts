import { describe, expect, it, vi } from "vitest";
import { collectEntityDrawables } from "../../../../game/systems/presentation/collection/collectEntityDrawables";
import { createRenderFrameBuilder } from "../../../../game/systems/presentation/frame/renderFrameBuilder";

function makeBaseInput(overrides: Record<string, unknown> = {}) {
  const frameBuilder = createRenderFrameBuilder();
  const baseWorld = {
    time: 0,
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
    ENEMY_TYPE: { BOSS: "BOSS" },
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
    resolveProjectileShadowFootOffset: vi.fn(),
    getProjectileSpriteByKind: vi.fn(() => null),
    PROJECTILE_BASE_DRAW_PX: 36,
    getProjectileDrawScale: vi.fn(() => 1),
    bazookaExhaustAssets: null,
    BAZOOKA_EXHAUST_OFFSET: 0,
    PRJ_KIND: { SPARK: 999 },
    VFX_CLIPS: [{ spriteIds: ["spark-0"], fps: 10, loop: true }],
    VFX_CLIP_INDEX: { LIGHTNING_PROJ: 0 },
    getSpriteById: vi.fn(() => null),
    snapToNearestWalkableGround: vi.fn(),
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
        eType: ["CHASER"],
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
    const input = makeBaseInput({
      w: {
        pAlive: [true],
        prHidden: [false],
        prPlayerFireX: [0],
        prPlayerFireY: [0],
        prZVisual: [0],
        prDirX: [1],
        prDirY: [0],
        prR: [4],
        prjKind: [1],
      },
      getProjectileSpriteByKind: vi.fn(() => ({ ready: true, img: projectileImage })),
      getDynamicAtlasFrameForImage: vi.fn((image: object) => (
        image === projectileImage ? { image: atlasImage, sx: 9, sy: 12, sw: 12, sh: 12 } : null
      )),
    });

    const commands = collectCommands(input);
    const projectileCommand = commands.find((command) => command.payload.projectileIndex === 0);

    expect(projectileCommand?.payload.image).toBe(atlasImage);
    expect(projectileCommand?.payload.sx).toBe(9);
    expect(projectileCommand?.payload.sy).toBe(12);
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
