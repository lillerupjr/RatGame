import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../../game/content/stages";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { tileToWorldCenter } from "../../../game/coords/tile";
import { tileToGrid } from "../../../game/coords/grid";
import { getActiveMap } from "../../../game/map/compile/kenneyMap";
import { getAuthoredMapDefByMapId } from "../../../game/map/authored/authoredMapRegistry";
import { activateMapDef } from "../../../game/map/proceduralMapBridge";
import { getZoneTrialObjectiveState, startZoneTrial, updateZoneTrialObjective } from "../../../game/objectives/zoneObjectiveSystem";
import { makeUnknownDamageMeta } from "../../../game/combat/damageMeta";

function setPlayerToTile(world: any, tx: number, ty: number): void {
  const center = tileToWorldCenter(tx, ty, KENNEY_TILE_WORLD);
  const g = tileToGrid(center.wx / KENNEY_TILE_WORLD, center.wy / KENNEY_TILE_WORLD);
  const gxi = Math.floor(g.gx);
  const gyi = Math.floor(g.gy);
  world.pgxi = gxi;
  world.pgyi = gyi;
  world.pgox = g.gx - gxi;
  world.pgoy = g.gy - gyi;
}

describe("zone trial player-position gating", () => {
  test("counts kills only when player is inside a zone, independent of enemy death location", () => {
    const world = createWorld({ seed: 789, stage: stageDocks });
    const mapDef = getAuthoredMapDefByMapId("china_town");
    expect(mapDef).toBeTruthy();
    if (!mapDef) return;
    activateMapDef(mapDef, 789);

    world.currentObjectiveSpec = {
      objectiveType: "ZONE_TRIAL",
      params: {
        zoneCount: 2,
        zoneSize: 4,
        killTargetPerZone: 2,
      },
    };

    startZoneTrial(world);
    const state = getZoneTrialObjectiveState(world);
    expect(state).toBeTruthy();
    if (!state || state.zones.length === 0) return;

    const compiled = getActiveMap();
    const originTx = compiled.originTx;
    const originTy = compiled.originTy;
    const zone = state.zones[0];
    const zoneAbsTx = originTx + zone.tileX;
    const zoneAbsTy = originTy + zone.tileY;

    let outsideAbsTx = zoneAbsTx;
    let outsideAbsTy = zoneAbsTy;
    let foundOutside = false;
    for (let y = originTy; y < originTy + compiled.height && !foundOutside; y++) {
      for (let x = originTx; x < originTx + compiled.width; x++) {
        const localX = x - originTx;
        const localY = y - originTy;
        let insideAny = false;
        for (let i = 0; i < state.zones.length; i++) {
          const z = state.zones[i];
          if (
            localX >= z.tileX &&
            localX < z.tileX + z.tileW &&
            localY >= z.tileY &&
            localY < z.tileY + z.tileH
          ) {
            insideAny = true;
            break;
          }
        }
        if (!insideAny) {
          outsideAbsTx = x;
          outsideAbsTy = y;
          foundOutside = true;
          break;
        }
      }
    }
    expect(foundOutside).toBe(true);

    // Outside all zones: kill should not count.
    setPlayerToTile(world, outsideAbsTx, outsideAbsTy);
    world.events = [
      {
        type: "ENEMY_KILLED",
        enemyIndex: 0,
        x: 99999,
        y: 99999,
        source: "OTHER" as const,
        damageMeta: makeUnknownDamageMeta("TEST_OUTSIDE_ZONE_KILL"),
      },
    ];
    updateZoneTrialObjective(world);
    expect(zone.killCount).toBe(0);

    // Inside zone: kill should count even when enemy death is far outside the zone.
    setPlayerToTile(world, zoneAbsTx, zoneAbsTy);
    const far = tileToWorldCenter(outsideAbsTx, outsideAbsTy, KENNEY_TILE_WORLD);
    world.events = [
      {
        type: "ENEMY_KILLED",
        enemyIndex: 1,
        x: far.wx,
        y: far.wy,
        source: "OTHER" as const,
        damageMeta: makeUnknownDamageMeta("TEST_INSIDE_ZONE_KILL"),
      },
    ];
    updateZoneTrialObjective(world);
    expect(zone.killCount).toBe(1);
  });
});
