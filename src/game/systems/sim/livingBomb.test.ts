import { describe, expect, test } from "vitest";
import { buildCombatRulesSnapshot } from "../../progression/effects/combatRules";
import { tickLivingBomb, isLivingBombMarked, clearLivingBombMark } from "./livingBomb";

function stubWorld(enemies: { x: number; y: number; alive: boolean; hp: number; hpMax: number }[] = []): any {
  const w: any = {
    events: [],
    playerX: 100,
    playerY: 100,
    playerR: 8,
    eAlive: enemies.map((e) => e.alive),
    eHp: enemies.map((e) => e.hp),
    eHpMax: enemies.map((e) => e.hpMax),
    eR: enemies.map(() => 8),
    eX: enemies.map((e) => e.x),
    eY: enemies.map((e) => e.y),
    enemySpatialHash: {
      _entries: enemies.map((e, i) => ({ index: i, x: e.x, y: e.y })),
    },
    camera: { worldX: 0, worldY: 0, scale: 1, viewW: 800, viewH: 600, tileScale: 1 },
    kenney: { tileWorldWidth: 32, tileWorldHeight: 32 },
  };
  return w;
}

// Minimal spatial hash support for queryCircle used in livingBomb
// We need to mock queryCircle's behavior - it just returns indices of nearby enemies
// The actual module uses a spatial hash, but we can patch it for tests
import * as spatialHashModule from "../../util/spatialHash";
import * as hitDetectionModule from "./hitDetection";
import * as coordsModule from "../../coords/worldViews";

// Override to make tests work without full world setup
const originalQueryCircle = spatialHashModule.queryCircle;

function patchWorldForCoords(w: any) {
  // Provide enough structure for getPlayerWorld/getEnemyWorld to work
  // These typically read from world coordinate arrays
  if (!w._coordsPatched) {
    w._coordsPatched = true;
  }
}

describe("livingBomb", () => {
  test("does nothing without combat rule", () => {
    const world = stubWorld();
    const combatRules = buildCombatRulesSnapshot([]);
    tickLivingBomb(world, 10, combatRules);
    expect((world as any)._livingBomb).toBeUndefined();
  });

  test("initializes state lazily", () => {
    const world = stubWorld();
    const combatRules = buildCombatRulesSnapshot([
      { kind: "LIVING_BOMB", markEvery: 20, speedIncreased: 0.5, explosionDamageScalar: 3.0, explosionRadius: 150 },
    ]);
    // Tick with small dt so cooldown doesn't trigger
    tickLivingBomb(world, 0.1, combatRules);
    const state = (world as any)._livingBomb;
    expect(state).toBeDefined();
    expect(state.markedEnemyIndex).toBeNull();
  });

  test("isLivingBombMarked returns false when no enemy marked", () => {
    const world = stubWorld();
    expect(isLivingBombMarked(world, 0)).toBe(false);
  });

  test("isLivingBombMarked returns true for marked enemy index", () => {
    const world = stubWorld();
    (world as any)._livingBomb = { cooldown: 20, markedEnemyIndex: 3 };
    expect(isLivingBombMarked(world, 3)).toBe(true);
    expect(isLivingBombMarked(world, 0)).toBe(false);
  });

  test("clearLivingBombMark clears when matching", () => {
    const world = stubWorld();
    (world as any)._livingBomb = { cooldown: 20, markedEnemyIndex: 3 };
    clearLivingBombMark(world, 3);
    expect((world as any)._livingBomb.markedEnemyIndex).toBeNull();
  });

  test("clearLivingBombMark does not clear when not matching", () => {
    const world = stubWorld();
    (world as any)._livingBomb = { cooldown: 20, markedEnemyIndex: 3 };
    clearLivingBombMark(world, 5);
    expect((world as any)._livingBomb.markedEnemyIndex).toBe(3);
  });

  test("clears mark when marked enemy is dead", () => {
    const world = stubWorld([
      { x: 120, y: 120, alive: false, hp: 0, hpMax: 100 },
    ]);
    (world as any)._livingBomb = { cooldown: 10, markedEnemyIndex: 0 };

    const combatRules = buildCombatRulesSnapshot([
      { kind: "LIVING_BOMB", markEvery: 20, speedIncreased: 0.5, explosionDamageScalar: 3.0, explosionRadius: 150 },
    ]);

    tickLivingBomb(world, 0.1, combatRules);
    expect((world as any)._livingBomb.markedEnemyIndex).toBeNull();
  });
});
