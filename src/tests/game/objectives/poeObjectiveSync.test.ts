import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../../game/content/stages";
import { getAuthoredMapDefByMapId } from "../../../game/map/authored/authoredMapRegistry";
import { activateMapDef } from "../../../game/map/authoredMapActivation";
import { initializePoeMapObjective } from "../../../game/objectives/poeMapObjectiveSystem";
import { initObjectivesForFloor, objectiveSystem, resetObjectiveRuntime } from "../../../game/systems/progression/objective";
import { OBJECTIVE_TRIGGER_IDS } from "../../../game/systems/progression/objectiveSpec";

function setupPoeWorld(seed: number) {
  const world = createWorld({ seed, stage: stageDocks });
  const map = getAuthoredMapDefByMapId("DOCKS");
  expect(map).toBeTruthy();
  if (!map) throw new Error("missing docks map");
  activateMapDef(map, seed);
  world.currentFloorIntent = {
    nodeId: `poe-sync-${seed}`,
    zoneId: "DOCKS",
    depth: 1,
    floorIndex: 0,
    archetype: "SURVIVE",
    objectiveId: "POE_MAP_CLEAR",
  };
  return world;
}

describe("poe objective sync", () => {
  test("runtime pack total and objective required count stay aligned at init", () => {
    const world = setupPoeWorld(71_005);
    const poeInit = initializePoeMapObjective(world, { objectiveSeed: 71_005 });
    expect(poeInit.totalPacks).toBeGreaterThan(1);

    const objectiveSpec = {
      objectiveType: "POE_MAP_CLEAR" as const,
      params: {
        clearCount: Math.max(1, poeInit.totalPacks),
      },
    };

    world.currentObjectiveSpec = objectiveSpec;
    resetObjectiveRuntime(world);
    initObjectivesForFloor(world, {
      floorId: world.currentFloorIntent?.nodeId,
      floorIndex: world.currentFloorIntent?.floorIndex,
      objectiveSpec,
    });

    const objectiveDef = world.objectiveDefs[0];
    expect(objectiveDef?.completionRule.type).toBe("SIGNAL_COUNT");
    if (!objectiveDef || objectiveDef.completionRule.type !== "SIGNAL_COUNT") {
      throw new Error("missing PoE objective definition");
    }
    expect(objectiveDef.completionRule.count).toBe(poeInit.totalPacks);
  });

  test("one pack clear signal does not complete a multi-pack objective", () => {
    const world = setupPoeWorld(71_006);
    const poeInit = initializePoeMapObjective(world, { objectiveSeed: 71_006 });
    expect(poeInit.totalPacks).toBeGreaterThan(1);

    const objectiveSpec = {
      objectiveType: "POE_MAP_CLEAR" as const,
      params: {
        clearCount: Math.max(1, poeInit.totalPacks),
      },
    };

    world.currentObjectiveSpec = objectiveSpec;
    resetObjectiveRuntime(world);
    initObjectivesForFloor(world, {
      floorId: world.currentFloorIntent?.nodeId,
      floorIndex: world.currentFloorIntent?.floorIndex,
      objectiveSpec,
    });

    world.triggerSignals.push({
      type: "KILL",
      entityId: -1,
      triggerId: OBJECTIVE_TRIGGER_IDS.poePackClear,
    });
    objectiveSystem(world);

    expect(world.objectiveStates[0]?.progress.signalCount).toBe(1);
    expect(world.objectiveStates[0]?.status).toBe("ACTIVE");
  });
});
