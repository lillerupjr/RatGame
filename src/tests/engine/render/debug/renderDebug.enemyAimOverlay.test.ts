import { describe, expect, it, vi } from "vitest";
import { createWorld } from "../../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../../engine/render/kenneyTiles";
import { stageDocks } from "../../../../game/content/stages";
import { EnemyId, spawnEnemyGrid } from "../../../../game/factories/enemyFactory";
import { getEnemyAimWorld } from "../../../../game/combat/aimPoints";
import { getEnemyWorld } from "../../../../game/coords/worldViews";
import { executeDebugPass } from "../../../../game/systems/presentation/debug/renderDebugPass";
import {
  drawEnemyAimOverlay,
  drawEnemyAimOverlayForVisibleEnemies,
  type DebugOverlayContext,
} from "../../../../engine/render/debug/renderDebug";

type FakeCtx = CanvasRenderingContext2D & {
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  ellipse: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  closePath: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  strokeRect: ReturnType<typeof vi.fn>;
  measureText: ReturnType<typeof vi.fn>;
  globalAlpha: number;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
};

function makeCtx(): FakeCtx {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 6 } as TextMetrics)),
    globalAlpha: 1,
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    fillStyle: "#000",
    strokeStyle: "#000",
  } as unknown as FakeCtx;
}

function makeWorldWithEnemy(): { world: ReturnType<typeof createWorld>; enemyIndex: number } {
  const world = createWorld({ seed: 404, stage: stageDocks });
  const enemyIndex = spawnEnemyGrid(world, EnemyId.MINION, 8, 8, KENNEY_TILE_WORLD);
  world.ezVisual[enemyIndex] = 0;
  return { world, enemyIndex };
}

function makeDebugContext(
  world: ReturnType<typeof createWorld>,
  toScreenAtZ: DebugOverlayContext["toScreenAtZ"],
  ctx = makeCtx(),
): DebugOverlayContext {
  return {
    ctx,
    w: world,
    ww: 320,
    hh: 180,
    px: 0,
    py: 0,
    camX: 0,
    camY: 0,
    T: KENNEY_TILE_WORLD,
    ELEV_PX: 16,
    renderAllHeights: false,
    maxNonStairSurfaceZ: () => 0,
    tileHAtWorld: () => 0,
    toScreen: () => ({ x: 0, y: 0 }),
    toScreenAtZ,
  };
}

describe("drawEnemyAimOverlay", () => {
  it("renders nothing when the overlay flag is off", () => {
    const { world } = makeWorldWithEnemy();
    const ctx = makeCtx();
    const debugContext = makeDebugContext(world, () => ({ x: 120, y: 80 }), ctx);

    drawEnemyAimOverlay(debugContext, false);

    expect(ctx.ellipse).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("skips enemies whose overlay geometry is fully off-screen", () => {
    const { world } = makeWorldWithEnemy();
    const ctx = makeCtx();
    const debugContext = makeDebugContext(world, () => ({ x: 999, y: 999 }), ctx);

    drawEnemyAimOverlay(debugContext, true);

    expect(ctx.ellipse).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("draws one collision ellipse and the three diagnostic labels for an on-screen enemy", () => {
    const { world, enemyIndex } = makeWorldWithEnemy();
    const ctx = makeCtx();
    const centerWorld = getEnemyWorld(world, enemyIndex, KENNEY_TILE_WORLD);
    const debugContext = makeDebugContext(
      world,
      (x, y) => ({
        x: 120 + (x - centerWorld.wx) * 4,
        y: 80 + (y - centerWorld.wy) * 4,
      }),
      ctx,
    );

    drawEnemyAimOverlay(debugContext, true);

    expect(ctx.ellipse).toHaveBeenCalledTimes(1);
    expect(ctx.fillText).toHaveBeenNthCalledWith(1, "collision center", expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenNthCalledWith(2, "feet anchor", expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenNthCalledWith(3, "aiming point", expect.any(Number), expect.any(Number));
  });

  it("projects collision, feet, and aim through separate overlay paths", () => {
    const { world, enemyIndex } = makeWorldWithEnemy();
    const centerWorld = getEnemyWorld(world, enemyIndex, KENNEY_TILE_WORLD);
    const aimWorld = getEnemyAimWorld(world, enemyIndex);
    const toScreenAtZ = vi.fn((x: number, y: number, _zVisual: number) => ({
      x: 100 + (x - centerWorld.wx) * 8,
      y: 70 + (y - centerWorld.wy) * 8,
    }));
    const debugContext = makeDebugContext(world, toScreenAtZ);

    drawEnemyAimOverlay(debugContext, true);

    expect(toScreenAtZ).toHaveBeenCalledTimes(3);
    expect(toScreenAtZ).toHaveBeenNthCalledWith(1, centerWorld.wx, centerWorld.wy, 0);
    expect(toScreenAtZ).toHaveBeenNthCalledWith(2, centerWorld.wx, centerWorld.wy, 0);
    expect(toScreenAtZ).toHaveBeenNthCalledWith(3, aimWorld.x, aimWorld.y, 0);
  });

  it("uses the world-pass ctx instead of a stale nested debugContext ctx", () => {
    const { world } = makeWorldWithEnemy();
    const staleCtx = makeCtx();
    const passCtx = makeCtx();
    const debugContext = makeDebugContext(world, () => ({ x: 120, y: 80 }), staleCtx);

    executeDebugPass({
      phase: "world",
      input: {
        ctx: passCtx,
        debugContext,
        viewRect: {} as any,
        toScreen: () => ({ x: 0, y: 0 }),
        tileWorld: KENNEY_TILE_WORLD,
        isTileInRenderRadius: () => true,
        deferredStructureSliceDebugDraws: [],
        flags: {
          showGrid: false,
          showEntityAnchorOverlay: false,
          showWalkMask: false,
          showRamps: false,
          showOccluders: false,
          showDecals: false,
          showProjectileFaces: false,
          showTriggers: false,
          showRoadSemantic: false,
          showStructureHeights: false,
          showStructureCollision: false,
          showStructureSlices: false,
          showStructureTriangleFootprint: false,
          showStructureAnchors: false,
          showStructureTriangleOwnershipSort: false,
          perfOverlayMode: "off",
          showEnemyAimOverlay: true,
          showLootGoblinOverlay: false,
          showMapOverlays: true,
          showZoneObjectiveBounds: false,
          showSweepShadowDebug: false,
          showTileHeightMap: false,
          shadowSunTimeHour: 17,
          shadowSunAzimuthDeg: -1,
          sunElevationOverrideEnabled: false,
          sunElevationOverrideDeg: 45,
        },
      },
    });

    expect(passCtx.ellipse).toHaveBeenCalled();
    expect(staleCtx.ellipse).not.toHaveBeenCalled();
  });
});

describe("drawEnemyAimOverlayForVisibleEnemies", () => {
  it("skips enemies outside the render-radius visibility gate", () => {
    const { world } = makeWorldWithEnemy();
    const ctx = makeCtx();
    const debugContext = makeDebugContext(world, () => ({ x: 120, y: 80 }), ctx);

    drawEnemyAimOverlayForVisibleEnemies(debugContext, true, () => false);

    expect(ctx.ellipse).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("draws visible enemies even when projected points exceed debugContext ww/hh", () => {
    const { world } = makeWorldWithEnemy();
    const ctx = makeCtx();
    const debugContext = makeDebugContext(world, () => ({ x: 999, y: 999 }), ctx);

    drawEnemyAimOverlayForVisibleEnemies(debugContext, true, () => true);

    expect(ctx.ellipse).toHaveBeenCalledTimes(1);
    expect(ctx.fillText).toHaveBeenCalledTimes(3);
  });
});
