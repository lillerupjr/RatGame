import { describe, expect, test } from "vitest";
import {
  markRareTripleClearsFromSignalsAndEvents,
  syncRareTripleObjectiveStateFromClears,
} from "../../../../game/systems/progression/rareTripleObjectiveSync";
import { OBJECTIVE_TRIGGER_IDS } from "../../../../game/systems/progression/objectiveSpec";
import { maybeStartFloorEndCountdown } from "../../../../game/systems/progression/floorEndCountdown";
import { EnemyId } from "../../../../game/factories/enemyFactory";
import { makeUnknownDamageMeta } from "../../../../game/combat/damageMeta";

function makeRareTripleWorld(): any {
  return {
    floorArchetype: "RARE_TRIPLE",
    rareTriple: { spawnPointsWorld: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }], completed: [false, false, false] },
    triggerSignals: [],
    events: [],
    eType: [],
    eSpawnTriggerId: [],
    objectiveDefs: [
      {
        id: "OBJ_RARE_TRIPLE",
        listensTo: [
          `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}1`,
          `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}2`,
          `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}3`,
        ],
        completionRule: { type: "SIGNAL_COUNT", count: 3, signalType: "KILL" },
        outcomes: [],
      },
    ],
    objectiveStates: [{ id: "OBJ_RARE_TRIPLE", status: "ACTIVE", progress: { signalCount: 0 } }],
  };
}

describe("rareTripleObjectiveSync", () => {
  test("does not mark rare zones from ENTER signals", () => {
    const world = makeRareTripleWorld();
    world.triggerSignals = [
      { type: "ENTER", entityId: 0, triggerId: `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}1` },
      { type: "ENTER", entityId: 0, triggerId: `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}2` },
      { type: "ENTER", entityId: 0, triggerId: `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}3` },
    ];

    markRareTripleClearsFromSignalsAndEvents(world);
    syncRareTripleObjectiveStateFromClears(world);

    expect(world.rareTriple.completed).toEqual([false, false, false]);
    expect(world.objectiveStates[0].status).toBe("ACTIVE");
    expect(world.objectiveStates[0].progress.signalCount).toBe(0);
  });

  test("records rare zone clears from kill events using ENEMY_KILLED.spawnTriggerId", () => {
    const world = makeRareTripleWorld();
    world.eType[7] = EnemyId.TANK;
    world.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: 7,
      x: 0,
      y: 0,
      spawnTriggerId: `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}3`,
      source: "OTHER",
      damageMeta: makeUnknownDamageMeta("TEST_RARE_ZONE_KILL"),
    });

    markRareTripleClearsFromSignalsAndEvents(world);
    expect(world.rareTriple.completed).toEqual([false, false, true]);
  });

  test("records rare zone clears from kill events using spawn trigger ownership fallback", () => {
    const world = makeRareTripleWorld();
    world.eType[7] = EnemyId.LEAPER1;
    world.eSpawnTriggerId[7] = `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}3`;
    world.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: 7,
      x: 0,
      y: 0,
      source: "OTHER",
      damageMeta: makeUnknownDamageMeta("TEST_RARE_ZONE_FALLBACK"),
    });

    markRareTripleClearsFromSignalsAndEvents(world);
    expect(world.rareTriple.completed).toEqual([false, false, true]);
  });

  test("ignores non-rare kills even if trigger ownership matches", () => {
    const world = makeRareTripleWorld();
    world.eType[7] = EnemyId.MINION;
    world.eSpawnTriggerId[7] = `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}3`;
    world.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: 7,
      x: 0,
      y: 0,
      source: "OTHER",
      damageMeta: makeUnknownDamageMeta("TEST_NON_RARE_KILL"),
    });

    markRareTripleClearsFromSignalsAndEvents(world);
    expect(world.rareTriple.completed).toEqual([false, false, false]);
  });

  test("completes objective once all three clears are observed (docks rare-triple regression)", () => {
    const world = makeRareTripleWorld();
    world.rareTriple.completed = [true, true, true];

    syncRareTripleObjectiveStateFromClears(world);
    expect(world.objectiveStates[0].progress.signalCount).toBe(3);
    expect(world.objectiveStates[0].status).toBe("COMPLETED");
  });

  test("docks rare-triple flow can start floor end countdown after 3 attributed kills", () => {
    const world = makeRareTripleWorld();
    world.eType[0] = EnemyId.TANK;
    world.eType[1] = EnemyId.LEAPER1;
    world.eType[2] = EnemyId.BURSTER;
    world.floorIndex = 0;
    world.runState = "FLOOR";
    world.floorEndCountdownActive = false;
    world.floorEndCountdownSec = 0;
    world.floorEndCountdownStartedKey = null;
    world.events = [
      {
        type: "ENEMY_KILLED",
        enemyIndex: 0,
        x: 0,
        y: 0,
        spawnTriggerId: `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}1`,
        source: "OTHER",
        damageMeta: makeUnknownDamageMeta("TEST_RARE_TRIPLE_KILL_1"),
      },
      {
        type: "ENEMY_KILLED",
        enemyIndex: 1,
        x: 0,
        y: 0,
        spawnTriggerId: `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}2`,
        source: "OTHER",
        damageMeta: makeUnknownDamageMeta("TEST_RARE_TRIPLE_KILL_2"),
      },
      {
        type: "ENEMY_KILLED",
        enemyIndex: 2,
        x: 0,
        y: 0,
        spawnTriggerId: `${OBJECTIVE_TRIGGER_IDS.rareZonePrefix}3`,
        source: "OTHER",
        damageMeta: makeUnknownDamageMeta("TEST_RARE_TRIPLE_KILL_3"),
      },
    ];

    markRareTripleClearsFromSignalsAndEvents(world);
    syncRareTripleObjectiveStateFromClears(world);
    const started = maybeStartFloorEndCountdown(world);

    expect(world.objectiveStates[0].status).toBe("COMPLETED");
    expect(started).toBe(true);
    expect(world.floorEndCountdownActive).toBe(true);
  });
});
