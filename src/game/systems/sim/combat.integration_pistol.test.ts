import { describe, expect, test } from "vitest";
import { createWorld, type World } from "../../../engine/world/world";
import { stageDocks } from "../../content/stages";
import { combatSystem } from "./combat";
import { projectilesSystem } from "./projectiles";
import { collisionsSystem } from "./collisions";
import { anchorFromWorld } from "../../coords/anchor";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { PRJ_KIND } from "../../factories/projectileFactory";
import { applyRelic } from "../progression/relics";

function setPlayerWorld(w: World, wx: number, wy: number): void {
  const a = anchorFromWorld(wx, wy, KENNEY_TILE_WORLD);
  w.pgxi = a.gxi;
  w.pgyi = a.gyi;
  w.pgox = a.gox;
  w.pgoy = a.goy;
}

describe("combatSystem pistol integration", () => {
  test("autofire spawns projectile and deals typed damage", () => {
    const w = createWorld({ seed: 1337, stage: stageDocks });

    w.events.length = 0;
    w.combatCardIds = [];
    w.primaryWeaponCdLeft = 0;

    setPlayerWorld(w, 0, 0);

    const enemyAnchor = anchorFromWorld(90, 0, KENNEY_TILE_WORLD);
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
    w.eHp.push(100);
    w.eHpMax.push(100);
    w.eR.push(10);
    w.eSpeed.push(0);
    w.eDamage.push(0);
    w.ezVisual.push(w.pzVisual);
    w.ezLogical.push(w.pzLogical);
    w.ePoisonT.push(0);
    w.ePoisonDps.push(0);
    w.ePoisonedOnDeath.push(false);
    w.eSpawnTriggerId.push(undefined);

    const hpStart = w.eHp[0];
    let spawned = false;
    let damageDealt = 0;

    for (let i = 0; i < 90; i++) {
      combatSystem(w, 1 / 60);
      if (w.pAlive.some(Boolean)) spawned = true;

      projectilesSystem(w, 1 / 60);

      for (let p = 0; p < w.pAlive.length; p++) {
        if (!w.pAlive[p]) continue;
        w.prCritChance[p] = 0;
      }

      const before = w.eHp[0];
      collisionsSystem(w, 1 / 60);
      if (w.eHp[0] < before) {
        damageDealt = before - w.eHp[0];
        break;
      }
    }

    expect(spawned).toBe(true);
    expect(w.pAlive.length).toBeGreaterThan(0);
    expect(hpStart - w.eHp[0]).toBeGreaterThan(0);
    expect(damageDealt).toBeCloseTo(8);
  });

  test("does not fire when no enemy is within weapon range", () => {
    const w = createWorld({ seed: 42, stage: stageDocks });
    w.events.length = 0;
    w.combatCardIds = [];
    w.primaryWeaponCdLeft = 0;
    setPlayerWorld(w, 0, 0);

    // Pistol range is 420; keep target safely outside.
    const enemyAnchor = anchorFromWorld(700, 0, KENNEY_TILE_WORLD);
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
    w.eHp.push(100);
    w.eHpMax.push(100);
    w.eR.push(10);
    w.eSpeed.push(0);
    w.eDamage.push(0);
    w.ezVisual.push(w.pzVisual);
    w.ezLogical.push(w.pzLogical);
    w.ePoisonT.push(0);
    w.ePoisonDps.push(0);
    w.ePoisonedOnDeath.push(false);
    w.eSpawnTriggerId.push(undefined);

    for (let i = 0; i < 120; i++) combatSystem(w, 1 / 60);

    expect(w.pAlive.some(Boolean)).toBe(false);
    expect(w.events.some((ev) => ev.type === "SFX" && (ev as any).id === "FIRE_OTHER")).toBe(false);
  });

  test("SPEC_DOT_SPECIALIST applies 50% less hit damage", () => {
    const w = createWorld({ seed: 9001, stage: stageDocks });
    w.events.length = 0;
    w.combatCardIds = [];
    w.primaryWeaponCdLeft = 0;
    setPlayerWorld(w, 0, 0);
    applyRelic(w, "SPEC_DOT_SPECIALIST");

    const enemyAnchor = anchorFromWorld(90, 0, KENNEY_TILE_WORLD);
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
    w.eHp.push(100);
    w.eHpMax.push(100);
    w.eR.push(10);
    w.eSpeed.push(0);
    w.eDamage.push(0);
    w.ezVisual.push(w.pzVisual);
    w.ezLogical.push(w.pzLogical);
    w.ePoisonT.push(0);
    w.ePoisonDps.push(0);
    w.ePoisonedOnDeath.push(false);
    w.eSpawnTriggerId.push(undefined);

    let damageDealt = 0;
    for (let i = 0; i < 90; i++) {
      combatSystem(w, 1 / 60);
      projectilesSystem(w, 1 / 60);
      for (let p = 0; p < w.pAlive.length; p++) {
        if (!w.pAlive[p]) continue;
        w.prCritChance[p] = 0;
      }
      const before = w.eHp[0];
      collisionsSystem(w, 1 / 60);
      if (w.eHp[0] < before) {
        damageDealt = before - w.eHp[0];
        break;
      }
    }

    expect(damageDealt).toBeCloseTo(4);
  });

  test("JOEY uses continuous laser beam profile in combat-mods primary fire", () => {
    const w = createWorld({ seed: 1234, stage: stageDocks });
    w.events.length = 0;
    w.combatCardIds = [];
    w.primaryWeaponCdLeft = 0;
    (w as any).currentCharacterId = "JOEY";
    w.rng.range = (() => 0.99) as any;

    setPlayerWorld(w, 0, 0);

    const enemyAnchor = anchorFromWorld(90, 0, KENNEY_TILE_WORLD);
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
    w.eHp.push(200);
    w.eHpMax.push(200);
    w.eR.push(10);
    w.eSpeed.push(0);
    w.eDamage.push(0);
    w.ezVisual.push(w.pzVisual);
    w.ezLogical.push(w.pzLogical);
    w.ePoisonT.push(0);
    w.ePoisonDps.push(0);
    w.ePoisonedOnDeath.push(false);
    w.eSpawnTriggerId.push(undefined);

    collisionsSystem(w, 1 / 60);

    const hpStart = w.eHp[0];
    for (let i = 0; i < 60; i++) {
      combatSystem(w, 1 / 60);
      collisionsSystem(w, 1 / 60);
    }

    expect(w.playerBeamActive).toBe(true);
    expect(w.playerBeamEndX).toBeGreaterThan(w.playerBeamStartX);
    expect(w.pAlive.some(Boolean)).toBe(false);
    const dealt = hpStart - w.eHp[0];
    expect(dealt).toBeGreaterThan(20);
    expect(dealt).toBeLessThan(26);
    expect(w.events.some((ev) => ev.type === "SFX" && (ev as any).id === "FIRE_OTHER")).toBe(true);
  });

  test("JOEY beam deactivates when no enemy is in range", () => {
    const w = createWorld({ seed: 5678, stage: stageDocks });
    w.events.length = 0;
    w.combatCardIds = [];
    w.primaryWeaponCdLeft = 0;
    (w as any).currentCharacterId = "JOEY";
    setPlayerWorld(w, 0, 0);

    for (let i = 0; i < 90; i++) {
      combatSystem(w, 1 / 60);
      collisionsSystem(w, 1 / 60);
    }

    expect(w.playerBeamActive).toBe(false);
    expect(w.pAlive.some(Boolean)).toBe(false);
    expect(w.events.some((ev) => ev.type === "ENEMY_HIT")).toBe(false);
  });

  test("HOBO uses syringe profile with split damage and innate pierce", () => {
    const w = createWorld({ seed: 3333, stage: stageDocks });
    w.events.length = 0;
    w.combatCardIds = [];
    w.primaryWeaponCdLeft = 0;
    (w as any).currentCharacterId = "HOBO";

    setPlayerWorld(w, 0, 0);

    const enemyAnchor = anchorFromWorld(90, 0, KENNEY_TILE_WORLD);
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
    w.eHp.push(200);
    w.eHpMax.push(200);
    w.eR.push(10);
    w.eSpeed.push(0);
    w.eDamage.push(0);
    w.ezVisual.push(w.pzVisual);
    w.ezLogical.push(w.pzLogical);
    w.ePoisonT.push(0);
    w.ePoisonDps.push(0);
    w.ePoisonedOnDeath.push(false);
    w.eSpawnTriggerId.push(undefined);

    // Prime enemy spatial hash so combat target acquisition can find the enemy.
    collisionsSystem(w, 1 / 60);
    combatSystem(w, 1 / 60);
    const firstProjectile = w.pAlive.findIndex(Boolean);
    expect(firstProjectile).toBeGreaterThanOrEqual(0);
    expect(w.prjKind[firstProjectile]).toBe(PRJ_KIND.SYRINGE);
    expect(w.prDmgPhys[firstProjectile]).toBeCloseTo(9);
    expect(w.prDmgChaos[firstProjectile]).toBeCloseTo(9);
    expect(w.prPierce[firstProjectile]).toBe(1);
    expect(w.prChancePoison[firstProjectile]).toBeCloseTo(0.25);
  });

  test("TOMMY uses shotgun profile with 4 projectiles per shot", () => {
    const w = createWorld({ seed: 2222, stage: stageDocks });
    w.events.length = 0;
    w.combatCardIds = [];
    w.primaryWeaponCdLeft = 0;
    (w as any).currentCharacterId = "TOMMY";
    setPlayerWorld(w, 0, 0);

    const enemyAnchor = anchorFromWorld(0, 0, KENNEY_TILE_WORLD);
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
    w.eHp.push(300);
    w.eHpMax.push(300);
    w.eR.push(10);
    w.eSpeed.push(0);
    w.eDamage.push(0);
    w.ezVisual.push(w.pzVisual);
    w.ezLogical.push(w.pzLogical);
    w.ePoisonT.push(0);
    w.ePoisonDps.push(0);
    w.ePoisonedOnDeath.push(false);
    w.eSpawnTriggerId.push(undefined);

    // Prime enemy spatial hash so combat target acquisition can find the enemy.
    collisionsSystem(w, 1 / 60);
    combatSystem(w, 1 / 60);
    const aliveProjectileCount = w.pAlive.filter(Boolean).length;
    expect(aliveProjectileCount).toBe(4);
  });

  test("JAMAL uses throwing knife profile with hidden +1 projectile as a sequential 2-knife burst", () => {
    const w = createWorld({ seed: 7777, stage: stageDocks });
    w.events.length = 0;
    w.combatCardIds = [];
    w.primaryWeaponCdLeft = 0;
    (w as any).currentCharacterId = "JAMAL";
    setPlayerWorld(w, 0, 0);

    const enemyAnchor = anchorFromWorld(0, 0, KENNEY_TILE_WORLD);
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
    w.eHp.push(300);
    w.eHpMax.push(300);
    w.eR.push(10);
    w.eSpeed.push(0);
    w.eDamage.push(0);
    w.ezVisual.push(w.pzVisual);
    w.ezLogical.push(w.pzLogical);
    w.ePoisonT.push(0);
    w.ePoisonDps.push(0);
    w.ePoisonedOnDeath.push(false);
    w.eSpawnTriggerId.push(undefined);

    // Prime enemy spatial hash so combat target acquisition can find the enemy.
    collisionsSystem(w, 1 / 60);
    combatSystem(w, 1 / 60);
    const firstProjectile = w.pAlive.findIndex(Boolean);
    expect(firstProjectile).toBeGreaterThanOrEqual(0);
    expect(w.prjKind[firstProjectile]).toBe(PRJ_KIND.KNIFE);
    let aliveProjectileCount = w.pAlive.filter(Boolean).length;
    expect(aliveProjectileCount).toBe(1);

    for (let i = 0; i < 13; i++) combatSystem(w, 1 / 60);
    aliveProjectileCount = w.pAlive.filter(Boolean).length;
    expect(aliveProjectileCount).toBe(2);

    const fireSfxEvents = w.events.filter((ev) => ev.type === "SFX" && (ev as any).id === "FIRE_OTHER");
    expect(fireSfxEvents.length).toBe(2);
  });
});
