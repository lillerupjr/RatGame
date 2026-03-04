import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../../game/content/stages";
import { getAuthoredMapDefByMapId } from "../../../game/map/authored/authoredMapRegistry";
import { activateMapDef } from "../../../game/map/authoredMapActivation";
import { startZoneTrial, getZoneTrialObjectiveState } from "../../../game/objectives/zoneObjectiveSystem";
import { DEFAULT_SPAWN_TUNING } from "../../../game/balance/spawnTuningDefaults";

describe("zone trial kill target scaling", () => {
  test("scales kill target by spawnPerDepth and hpPerDepth at depth 2", () => {
    const world = createWorld({ seed: 101, stage: stageDocks });
    const mapDef = getAuthoredMapDefByMapId("china_town");
    expect(mapDef).toBeTruthy();
    if (!mapDef) return;
    activateMapDef(mapDef, 101);

    world.floorIndex = 1; // effective depth = 2
    world.delveDepth = 0 as any;
    world.currentObjectiveSpec = {
      objectiveType: "ZONE_TRIAL",
      params: {
        zoneCount: 1,
        zoneSize: 4,
        killTargetPerZone: 10,
      },
    };

    startZoneTrial(world);
    const state = getZoneTrialObjectiveState(world);
    expect(state).toBeTruthy();
    if (!state || state.zones.length === 0) return;

    const raw = Math.round(
      10 *
        Math.pow(DEFAULT_SPAWN_TUNING.spawnPerDepth, 1) *
        Math.pow(DEFAULT_SPAWN_TUNING.hpPerDepth, 1),
    );
    const expected = Math.max(1, Math.min(200, raw));
    expect(state.zones[0].killTarget).toBe(expected);
  });
});
