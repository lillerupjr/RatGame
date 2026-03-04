import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../../game/content/stages";
import { resolveBuildingCandidates } from "../../../game/content/buildings";
import { getAuthoredMapDefByMapId } from "../../../game/map/authored/authoredMapRegistry";
import { activateMapDef } from "../../../game/map/authoredMapActivation";
import { getZoneTrialObjectiveState, startZoneTrial } from "../../../game/objectives/zoneObjectiveSystem";

describe("zone trial china_town placement", () => {
  test("china_town authored map resolves expected map skin and building pack", () => {
    const map = getAuthoredMapDefByMapId("china_town");
    expect(map).toBeTruthy();
    expect(map?.mapSkinId).toBe("china_town");
    expect(map?.buildingPackId).toBe("china_town_buildings");

    const candidates = resolveBuildingCandidates("china_town_buildings");
    expect(candidates.length).toBeGreaterThan(0);
  });

  test("zone placement pipeline yields candidates on china_town", () => {
    const world = createWorld({ seed: 12345, stage: stageDocks });
    const map = getAuthoredMapDefByMapId("china_town");
    expect(map).toBeTruthy();
    if (!map) return;

    activateMapDef(map, 12345);
    world.currentObjectiveSpec = {
      objectiveType: "ZONE_TRIAL",
      params: {
        zoneCount: 2,
        zoneSize: 4,
        killTargetPerZone: 8,
      },
    };

    startZoneTrial(world);
    const state = getZoneTrialObjectiveState(world);
    expect(state).toBeTruthy();
    expect(state?.zones.length ?? 0).toBeGreaterThan(0);
  });
});
