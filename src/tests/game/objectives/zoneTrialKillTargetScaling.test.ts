import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../../game/content/stages";
import { getAuthoredMapDefByMapId } from "../../../game/map/authored/authoredMapRegistry";
import { activateMapDef } from "../../../game/map/authoredMapActivation";
import { startZoneTrial, getZoneTrialObjectiveState } from "../../../game/objectives/zoneObjectiveSystem";

describe("zone trial kill target scaling", () => {
  test("scales kill target from delve encounter pressure", () => {
    const world = createWorld({ seed: 101, stage: stageDocks });
    const mapDef = getAuthoredMapDefByMapId("china_town");
    expect(mapDef).toBeTruthy();
    if (!mapDef) return;
    activateMapDef(mapDef, 101);

    world.delveScaling = {
      hpMult: 1.5,
      damageMult: 1,
      spawnRateMult: 1.25,
    };
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

    const raw = Math.round(10 * 1.25 * 1.5 * 1.15);
    const expected = Math.max(1, Math.min(20, raw));
    expect(state.zones[0].killTarget).toBe(expected);
  });
});
