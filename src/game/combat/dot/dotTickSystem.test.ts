import { describe, expect, test } from "vitest";
import { createWorld, type World } from "../../../engine/world/world";
import { stageDocks } from "../../content/stages";
import { anchorFromWorld } from "../../coords/anchor";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { addPoison, createEnemyAilmentsState } from "../../combat_mods/ailments/enemyAilments";
import { clearSpatialHash, insertEntity } from "../../util/spatialHash";
import { getEnemyWorld } from "../../coords/worldViews";
import { spawnZone, ZONE_KIND } from "../../factories/zoneFactory";
import { makeWeaponDotMeta } from "../damageMeta";
import { DOT_TICK_HZ } from "./dotConstants";
import { dotTickSystem } from "./dotTickSystem";

function spawnBasicEnemy(w: World, wx: number, wy: number, hp = 200): number {
  const enemyAnchor = anchorFromWorld(wx, wy, KENNEY_TILE_WORLD);
  const e = w.eAlive.length;
  w.eAlive.push(true);
  w.eType.push(1);
  w.egxi.push(enemyAnchor.gxi);
  w.egyi.push(enemyAnchor.gyi);
  w.egox.push(enemyAnchor.gox);
  w.egoy.push(enemyAnchor.goy);
  w.evx.push(0);
  w.evy.push(0);
  w.eFaceX.push(-1);
  w.eFaceY.push(0);
  w.eHp.push(hp);
  w.eHpMax.push(hp);
  w.eR.push(10);
  w.eSpeed.push(0);
  w.eDamage.push(0);
  w.ezVisual.push(w.pzVisual);
  w.ezLogical.push(w.pzLogical);
  w.ePoisonT.push(0);
  w.ePoisonDps.push(0);
  w.ePoisonedOnDeath.push(false);
  w.eSpawnTriggerId.push(undefined);
  return e;
}

function rebuildEnemyHash(w: World): void {
  clearSpatialHash(w.enemySpatialHash);
  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;
    const ew = getEnemyWorld(w, i, KENNEY_TILE_WORLD);
    insertEntity(w.enemySpatialHash, i, ew.wx, ew.wy, w.eR[i] ?? 0);
  }
}

describe("dotTickSystem", () => {
  test("uses 10Hz as the shared DoT cadence", () => {
    expect(DOT_TICK_HZ).toBe(10);
  });

  test("applies ailment DoT in exactly 10 ticks over 1 second", () => {
    const w = createWorld({ seed: 701, stage: stageDocks });
    const enemy = spawnBasicEnemy(w, 90, 0, 500);
    const st = createEnemyAilmentsState();
    addPoison(st, 20); // 10 dps
    w.eAilments[enemy] = st;
    const hpStart = w.eHp[enemy];

    dotTickSystem(w, 1.0);

    const ailmentHits = w.events.filter(
      (ev): ev is Extract<World["events"][number], { type: "ENEMY_HIT" }> =>
        ev.type === "ENEMY_HIT" && ev.damageMeta.cause.kind === "AILMENT",
    );
    expect(hpStart - w.eHp[enemy]).toBeCloseTo(10, 6);
    expect(ailmentHits.length).toBe(10);
  });

  test("applies zone DoT in exactly 10 ticks over 1 second", () => {
    const w = createWorld({ seed: 702, stage: stageDocks });
    const enemy = spawnBasicEnemy(w, 90, 0, 500);
    rebuildEnemyHash(w);
    const ew = getEnemyWorld(w, enemy, KENNEY_TILE_WORLD);
    spawnZone(w, {
      kind: ZONE_KIND.FIRE,
      x: ew.wx,
      y: ew.wy,
      radius: 80,
      damage: 3,
      tickEvery: 0.1,
      ttl: 2,
      followPlayer: false,
    });
    const hpStart = w.eHp[enemy];

    dotTickSystem(w, 1.0);

    const zoneHits = w.events.filter(
      (ev): ev is Extract<World["events"][number], { type: "ENEMY_HIT" }> =>
        ev.type === "ENEMY_HIT" && ev.damageMeta.cause.kind === "ENVIRONMENT",
    );
    expect(hpStart - w.eHp[enemy]).toBeCloseTo(30, 6);
    expect(zoneHits.length).toBe(10);
  });

  test("applies beam DoT in exactly 10 ticks over 1 second with no crits", () => {
    const w = createWorld({ seed: 703, stage: stageDocks });
    const enemy = spawnBasicEnemy(w, 90, 0, 500);
    const hpStart = w.eHp[enemy];

    w.playerBeamActive = true;
    w.playerBeamStartX = 0;
    w.playerBeamStartY = 0;
    w.playerBeamEndX = 220;
    w.playerBeamEndY = 0;
    w.playerBeamDirX = 1;
    w.playerBeamDirY = 0;
    w.playerBeamWidthPx = 12;
    w.playerBeamGlowIntensity = 1;
    w.playerBeamDpsPhys = 0;
    w.playerBeamDpsFire = 24;
    w.playerBeamDpsChaos = 0;
    w.playerBeamDamageMeta = makeWeaponDotMeta("JOEY_LASER_TEST");

    dotTickSystem(w, 1.0);

    const beamHits = w.events.filter(
      (ev): ev is Extract<World["events"][number], { type: "ENEMY_HIT" }> =>
        ev.type === "ENEMY_HIT"
        && ev.damageMeta.category === "DOT"
        && ev.damageMeta.cause.kind === "WEAPON",
    );
    expect(hpStart - w.eHp[enemy]).toBeCloseTo(24, 6);
    expect(beamHits.length).toBe(10);
    expect(beamHits.every((ev) => ev.isCrit === false)).toBe(true);
  });
});
