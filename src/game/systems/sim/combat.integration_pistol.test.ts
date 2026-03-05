import { describe, expect, test } from "vitest";
import { createWorld, type World } from "../../../engine/world/world";
import { stageDocks } from "../../content/stages";
import { combatSystem } from "./combat";
import { projectilesSystem } from "./projectiles";
import { collisionsSystem } from "./collisions";
import { dotTickSystem } from "../../combat/dot/dotTickSystem";
import { DOT_TICK_INTERVAL_SEC } from "../../combat/dot/dotConstants";
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

function runJoeyBeamDamageScenario(options?: {
  cards?: string[];
  durationSec?: number;
  dt?: number;
}): {
  world: World;
  enemy: number;
  damage: number;
  beamHits: Array<Extract<World["events"][number], { type: "ENEMY_HIT" }>>;
} {
  const dt = options?.dt ?? (1 / 60);
  const durationSec = options?.durationSec ?? 1;
  const steps = Math.round(durationSec / dt);

  const world = createWorld({ seed: 4040, stage: stageDocks });
  world.events.length = 0;
  world.combatCardIds = [...(options?.cards ?? [])];
  world.primaryWeaponCdLeft = 0;
  (world as any).currentCharacterId = "JOEY";
  world.rng.range = (() => 0.99) as any;
  setPlayerWorld(world, 0, 0);
  const enemy = spawnBasicEnemy(world, 90, 0, 5000);

  collisionsSystem(world, dt);
  const hpStart = world.eHp[enemy];
  for (let i = 0; i < steps; i++) {
    combatSystem(world, dt);
    collisionsSystem(world, dt);
    dotTickSystem(world, dt);
  }

  const beamHits = world.events.filter(
    (ev): ev is Extract<typeof ev, { type: "ENEMY_HIT" }> =>
      ev.type === "ENEMY_HIT"
      && ev.damageMeta.category === "DOT"
      && ev.damageMeta.cause.kind === "WEAPON",
  );

  return {
    world,
    enemy,
    damage: hpStart - world.eHp[enemy],
    beamHits,
  };
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
    expect(damageDealt).toBeCloseTo(12);
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

    expect(damageDealt).toBeCloseTo(6);
  });

  test("global hit damage scales hit-derived poison once (no DoT double dip)", () => {
    const runScenario = (withGlobalHitMore: boolean): { hitDamage: number; poisonDps: number } => {
      const w = createWorld({ seed: withGlobalHitMore ? 9003 : 9002, stage: stageDocks });
      w.events.length = 0;
      w.combatCardIds = [];
      w.primaryWeaponCdLeft = 0;
      (w as any).currentCharacterId = "HOBO";
      setPlayerWorld(w, 0, 0);
      if (withGlobalHitMore) applyRelic(w, "SPEC_DAMAGE_MORE_200_MAX_LIFE_LESS_50");
      const enemy = spawnBasicEnemy(w, 90, 0, 500);

      for (let i = 0; i < 180; i++) {
        combatSystem(w, 1 / 60);
        projectilesSystem(w, 1 / 60);
        for (let p = 0; p < w.pAlive.length; p++) {
          if (!w.pAlive[p]) continue;
          w.prCritChance[p] = 0;
          w.prChancePoison[p] = 1;
          w.prChanceIgnite[p] = 0;
          w.prChanceBleed[p] = 0;
        }
        const before = w.eHp[enemy];
        collisionsSystem(w, 1 / 60);
        if (w.eHp[enemy] >= before) continue;
        const hitDamage = before - w.eHp[enemy];
        const poisonDps = w.eAilments?.[enemy]?.poison?.[0]?.dps ?? 0;
        if (poisonDps > 0) return { hitDamage, poisonDps };
      }

      throw new Error("Expected at least one poison-applying hit in scenario.");
    };

    const baseline = runScenario(false);
    const boosted = runScenario(true);

    expect(boosted.hitDamage).toBeCloseTo(baseline.hitDamage * 3, 6);
    expect(boosted.poisonDps).toBeCloseTo(baseline.poisonDps * 3, 6);
  });

  test("JOEY uses continuous laser beam profile in combat-mods primary fire", () => {
    const w = createWorld({ seed: 1234, stage: stageDocks });
    w.events.length = 0;
    w.combatCardIds = [];
    w.primaryWeaponCdLeft = 0;
    (w as any).currentCharacterId = "JOEY";
    w.rng.range = (() => 0.99) as any;

    setPlayerWorld(w, 0, 0);

    const firstEnemy = spawnBasicEnemy(w, 90, 0, 200);

    collisionsSystem(w, 1 / 60);

    const hpStart = w.eHp[firstEnemy];
    for (let i = 0; i < 60; i++) {
      combatSystem(w, 1 / 60);
      collisionsSystem(w, 1 / 60);
      dotTickSystem(w, 1 / 60);
    }

    expect(w.playerBeamActive).toBe(true);
    expect(w.playerBeamEndX - w.playerBeamStartX).toBeGreaterThan(150);
    expect(w.pAlive.some(Boolean)).toBe(false);
    const dealt = hpStart - w.eHp[firstEnemy];
    expect(dealt).toBeGreaterThan(20);
    expect(dealt).toBeLessThan(26);
    expect(w.events.some((ev) => ev.type === "SFX" && (ev as any).id === "FIRE_OTHER")).toBe(true);
  });

  test("JOEY beam pierces through all enemies in the line (unlimited target hits)", () => {
    const w = createWorld({ seed: 1900, stage: stageDocks });
    w.events.length = 0;
    w.combatCardIds = [];
    w.primaryWeaponCdLeft = 0;
    (w as any).currentCharacterId = "JOEY";
    w.rng.range = (() => 0.99) as any;
    setPlayerWorld(w, 0, 0);

    const e1 = spawnBasicEnemy(w, 90, 0, 200);
    const e2 = spawnBasicEnemy(w, 180, 0, 200);
    const e3 = spawnBasicEnemy(w, 270, 0, 200);
    collisionsSystem(w, 1 / 60);

    const hp1 = w.eHp[e1];
    const hp2 = w.eHp[e2];
    const hp3 = w.eHp[e3];

    for (let i = 0; i < 12; i++) {
      combatSystem(w, 1 / 60);
      collisionsSystem(w, 1 / 60);
      dotTickSystem(w, 1 / 60);
    }

    expect(w.eHp[e1]).toBeLessThan(hp1);
    expect(w.eHp[e2]).toBeLessThan(hp2);
    expect(w.eHp[e3]).toBeLessThan(hp3);
  });

  test("JOEY beam ignores pierce stat for hit count", () => {
    const mk = (withPierceCard: boolean) => {
      const w = createWorld({ seed: 1901, stage: stageDocks });
      w.events.length = 0;
      w.combatCardIds = withPierceCard ? ["CARD_PIERCE_1"] : [];
      w.primaryWeaponCdLeft = 0;
      (w as any).currentCharacterId = "JOEY";
      w.rng.range = (() => 0.99) as any;
      setPlayerWorld(w, 0, 0);
      const enemies = [
        spawnBasicEnemy(w, 90, 0, 200),
        spawnBasicEnemy(w, 180, 0, 200),
        spawnBasicEnemy(w, 270, 0, 200),
      ];
      collisionsSystem(w, 1 / 60);
      for (let i = 0; i < 12; i++) {
        combatSystem(w, 1 / 60);
        collisionsSystem(w, 1 / 60);
        dotTickSystem(w, 1 / 60);
      }
      let hitCount = 0;
      for (let i = 0; i < enemies.length; i++) {
        if (w.eHp[enemies[i]] < 200) hitCount += 1;
      }
      return hitCount;
    };

    expect(mk(false)).toBe(3);
    expect(mk(true)).toBe(3);
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

  test("JOEY beam ticks at 10Hz and emits non-crit DOT hits", () => {
    const out = runJoeyBeamDamageScenario({ durationSec: 1, dt: DOT_TICK_INTERVAL_SEC });
    expect(out.damage).toBeCloseTo(24, 6);
    expect(out.beamHits.length).toBe(10);
    expect(out.beamHits.every((ev) => ev.isCrit === false)).toBe(true);
    expect(out.beamHits.every((ev) => ev.damageMeta.category === "DOT")).toBe(true);
  });

  test("JOEY beam ignores fire-rate and crit/ailment chance scaling", () => {
    const baseline = runJoeyBeamDamageScenario({ durationSec: 2 });
    const withFireRate = runJoeyBeamDamageScenario({
      durationSec: 2,
      cards: ["CARD_FIRE_RATE_4"],
    });
    const withCritAndAilmentCards = runJoeyBeamDamageScenario({
      durationSec: 2,
      cards: ["CARD_CRIT_CHANCE_4", "CARD_CRIT_MULTI_4", "CARD_IGNITE_CHANCE_1", "CARD_POISON_CHANCE_1"],
    });

    expect(withFireRate.damage).toBeCloseTo(baseline.damage, 6);
    expect(withCritAndAilmentCards.damage).toBeCloseTo(baseline.damage, 6);

    const st = withCritAndAilmentCards.world.eAilments?.[withCritAndAilmentCards.enemy];
    expect(st?.bleed.length ?? 0).toBe(0);
    expect(st?.ignite.length ?? 0).toBe(0);
    expect(st?.poison.length ?? 0).toBe(0);
    expect(withCritAndAilmentCards.beamHits.every((ev) => ev.isCrit === false)).toBe(true);
  });

  test("JOEY beam benefits from generic damage increased cards", () => {
    const baseline = runJoeyBeamDamageScenario({ durationSec: 2 });
    const withDamageInc = runJoeyBeamDamageScenario({
      durationSec: 2,
      cards: ["CARD_DAMAGE_INC_1"],
    });

    expect(withDamageInc.damage).toBeGreaterThan(baseline.damage);
    expect(withDamageInc.damage).toBeCloseTo(baseline.damage * 1.2, 6);
  });

  test("HOBO uses syringe profile with chaos-only damage, no innate pierce, and higher poison chance", () => {
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
    expect(w.prDmgPhys[firstProjectile]).toBeCloseTo(0);
    expect(w.prDmgChaos[firstProjectile]).toBeCloseTo(18);
    expect(w.prPierce[firstProjectile]).toBe(0);
    expect(w.prChancePoison[firstProjectile]).toBeCloseTo(0.5);
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

  test("enemy contact emits PLAYER_HIT with ENEMY damage metadata", () => {
    const w = createWorld({ seed: 8080, stage: stageDocks });
    w.events.length = 0;
    setPlayerWorld(w, 0, 0);

    const enemy = spawnBasicEnemy(w, 0, 0, 100);
    w.eDamage[enemy] = 12;

    collisionsSystem(w, 1 / 60);

    const playerHit = w.events.find(
      (ev): ev is Extract<(typeof w.events)[number], { type: "PLAYER_HIT" }> => ev.type === "PLAYER_HIT",
    );
    expect(playerHit).toBeTruthy();
    if (!playerHit) return;

    expect(playerHit.damageMeta.category).toBe("HIT");
    expect(playerHit.damageMeta.cause.kind).toBe("ENEMY");
    if (playerHit.damageMeta.cause.kind === "ENEMY") {
      expect(playerHit.damageMeta.cause.attackId).toBe("CONTACT_BODY");
      expect(playerHit.damageMeta.cause.mode).toBe("INTRINSIC");
    }
    expect(playerHit.damageMeta.instigator.actor).toBe("ENEMY");
    expect(playerHit.damageMeta.instigator.id).toBe(String(enemy));
    expect(playerHit.damageMeta.isProcDamage === true).toBe(false);
  });
});
