import { describe, expect, test } from "vitest";
import { createWorld } from "../../../../engine/world/world";
import { stageDocks } from "../../../../game/content/stages";
import { EnemyId } from "../../../../game/factories/enemyFactory";
import { getEnemyWorld } from "../../../../game/coords/worldViews";
import { KENNEY_TILE_WORLD } from "../../../../engine/render/kenneyTiles";
import { walkInfo } from "../../../../game/map/compile/kenneyMap";
import { getAuthoredMapDefByMapId } from "../../../../game/map/authored/authoredMapRegistry";
import { activateMapDef } from "../../../../game/map/authoredMapActivation";
import {
  LOOT_GOBLIN_TRIGGER_PREFIX,
  resetLootGoblinFloorState,
  scheduleLootGoblinGoldBurst,
  tickLootGoblinGoldBurst,
  trySpawnLootGoblinForFloor,
} from "../../../../game/systems/neutral/lootGoblin";

describe("loot_goblin progression runtime", () => {
  test("spawn roll fail does not spawn loot goblin", () => {
    const w = createWorld({ seed: 10_001, stage: stageDocks });
    const mapDef = getAuthoredMapDefByMapId("china_town");
    expect(mapDef).toBeTruthy();
    if (!mapDef) return;
    activateMapDef(mapDef, 10_001);

    w.rng = {
      int: () => 2, // fail 1-in-2 roll
      range: (min: number) => min,
    } as any;

    trySpawnLootGoblinForFloor(w);
    expect(w.eAlive.length).toBe(0);
  });

  test("spawn roll success spawns one tagged loot goblin on walkable tile", () => {
    const w = createWorld({ seed: 10_002, stage: stageDocks });
    const mapDef = getAuthoredMapDefByMapId("china_town");
    expect(mapDef).toBeTruthy();
    if (!mapDef) return;
    activateMapDef(mapDef, 10_002);

    w.rng = {
      int: () => 1, // always pass chance roll and deterministic shuffle choices
      range: (min: number) => min,
    } as any;

    trySpawnLootGoblinForFloor(w);
    expect(w.eAlive.length).toBe(1);
    expect(w.eType[0]).toBe(EnemyId.LOOT_GOBLIN);
    expect(w.eBaseLife[0]).toBe(500);
    expect(typeof w.eSpawnTriggerId[0]).toBe("string");
    expect((w.eSpawnTriggerId[0] ?? "").startsWith(LOOT_GOBLIN_TRIGGER_PREFIX)).toBe(true);

    const ew = getEnemyWorld(w, 0, KENNEY_TILE_WORLD);
    const info = walkInfo(ew.wx, ew.wy, KENNEY_TILE_WORLD);
    expect(info.walkable).toBe(true);
  });

  test("scheduled goblin burst emits exactly 300x1g over time", () => {
    const w = createWorld({ seed: 10_003, stage: stageDocks });
    resetLootGoblinFloorState(w);

    scheduleLootGoblinGoldBurst(w, 0, 0);
    tickLootGoblinGoldBurst(w, 0);
    expect(w.xAlive.filter(Boolean)).toHaveLength(0);

    // Burst cadence is 2x faster than before (0.05s interval),
    // so all 300 one-gold drops should finish around 15s.
    for (let i = 0; i < 151; i++) {
      tickLootGoblinGoldBurst(w, 0.1);
    }

    const aliveCoinIndexes = w.xAlive
      .map((alive, idx) => (alive ? idx : -1))
      .filter((idx) => idx >= 0);
    expect(aliveCoinIndexes).toHaveLength(300);
    const total = aliveCoinIndexes.reduce((sum, idx) => sum + (w.xValue[idx] ?? 0), 0);
    expect(total).toBe(300);
  });

  test("reset clears pending scheduled goblin drops", () => {
    const w = createWorld({ seed: 10_004, stage: stageDocks });
    scheduleLootGoblinGoldBurst(w, 0, 0);
    resetLootGoblinFloorState(w);

    for (let i = 0; i < 320; i++) {
      tickLootGoblinGoldBurst(w, 0.1);
    }

    expect(w.xAlive.filter(Boolean)).toHaveLength(0);
  });
});
