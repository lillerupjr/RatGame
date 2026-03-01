import { describe, expect, test } from "vitest";
import {
  markBossTripleClearsFromSignalsAndEvents,
  syncBossTripleObjectiveStateFromClears,
} from "../../../../game/systems/progression/bossTripleObjectiveSync";
import { OBJECTIVE_TRIGGER_IDS } from "../../../../game/systems/progression/objectiveSpec";
import { maybeStartFloorEndCountdown } from "../../../../game/systems/progression/floorEndCountdown";

function makeBossTripleWorld(): any {
  return {
    floorArchetype: "BOSS_TRIPLE",
    bossTriple: { spawnPointsWorld: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }], completed: [false, false, false] },
    triggerSignals: [],
    events: [],
    eSpawnTriggerId: [],
    objectiveDefs: [
      {
        id: "OBJ_BOSS_RARES",
        listensTo: [
          `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}1`,
          `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}2`,
          `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}3`,
        ],
        completionRule: { type: "SIGNAL_COUNT", count: 3, signalType: "KILL" },
        outcomes: [],
      },
    ],
    objectiveStates: [{ id: "OBJ_BOSS_RARES", status: "ACTIVE", progress: { signalCount: 0 } }],
  };
}

describe("bossTripleObjectiveSync", () => {
  test("does not mark boss zones from ENTER signals", () => {
    const world = makeBossTripleWorld();
    world.triggerSignals = [
      { type: "ENTER", entityId: 0, triggerId: `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}1` },
      { type: "ENTER", entityId: 0, triggerId: `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}2` },
      { type: "ENTER", entityId: 0, triggerId: `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}3` },
    ];

    markBossTripleClearsFromSignalsAndEvents(world);
    syncBossTripleObjectiveStateFromClears(world);

    expect(world.bossTriple.completed).toEqual([false, false, false]);
    expect(world.objectiveStates[0].status).toBe("ACTIVE");
    expect(world.objectiveStates[0].progress.signalCount).toBe(0);
  });

  test("records boss zone clears from kill events using ENEMY_KILLED.spawnTriggerId", () => {
    const world = makeBossTripleWorld();
    world.events.push({
      type: "ENEMY_KILLED",
      enemyIndex: 7,
      x: 0,
      y: 0,
      spawnTriggerId: `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}3`,
      source: "OTHER",
    });

    markBossTripleClearsFromSignalsAndEvents(world);
    expect(world.bossTriple.completed).toEqual([false, false, true]);
  });

  test("records boss zone clears from kill events using spawn trigger ownership fallback", () => {
    const world = makeBossTripleWorld();
    world.eSpawnTriggerId[7] = `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}3`;
    world.events.push({ type: "ENEMY_KILLED", enemyIndex: 7, x: 0, y: 0, source: "OTHER" });

    markBossTripleClearsFromSignalsAndEvents(world);
    expect(world.bossTriple.completed).toEqual([false, false, true]);
  });

  test("completes objective once all three clears are observed (docks boss-triple regression)", () => {
    const world = makeBossTripleWorld();
    world.bossTriple.completed = [true, true, true];

    syncBossTripleObjectiveStateFromClears(world);
    expect(world.objectiveStates[0].progress.signalCount).toBe(3);
    expect(world.objectiveStates[0].status).toBe("COMPLETED");
  });

  test("docks boss-triple flow can start floor end countdown after 3 attributed kills", () => {
    const world = makeBossTripleWorld();
    world.floorIndex = 0;
    world.runState = "FLOOR";
    world.floorEndCountdownActive = false;
    world.floorEndCountdownSec = 0;
    world.floorEndCountdownStartedKey = null;
    world.events = [
      { type: "ENEMY_KILLED", enemyIndex: 0, x: 0, y: 0, spawnTriggerId: `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}1`, source: "OTHER" },
      { type: "ENEMY_KILLED", enemyIndex: 1, x: 0, y: 0, spawnTriggerId: `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}2`, source: "OTHER" },
      { type: "ENEMY_KILLED", enemyIndex: 2, x: 0, y: 0, spawnTriggerId: `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}3`, source: "OTHER" },
    ];

    markBossTripleClearsFromSignalsAndEvents(world);
    syncBossTripleObjectiveStateFromClears(world);
    const started = maybeStartFloorEndCountdown(world);

    expect(world.objectiveStates[0].status).toBe("COMPLETED");
    expect(started).toBe(true);
    expect(world.floorEndCountdownActive).toBe(true);
  });
});
