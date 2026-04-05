import type { World } from "../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { makeEnemyHitMeta } from "../combat/damageMeta";
import { getEnemyWorld, getPlayerWorld } from "../coords/worldViews";
import { spawnProjectile } from "../factories/projectileFactory";
import { spawnZone, ZONE_KIND } from "../factories/zoneFactory";
import { bossRegistry } from "./bossRegistry";
import {
  getBossDefinitionForEntity,
  getBossEncounterForEntity,
} from "./bossRuntime";
import type { BossAbilityDefinition } from "./bossAbilities";

function getBossDamageScale(world: World, enemyIndex: number): number {
  const boss = getBossDefinitionForEntity(world, enemyIndex);
  if (!boss) return 1;
  const baseDamage = Math.max(1, boss.stats.contactDamage);
  const runtimeDamage = Math.max(0, world.eDamage?.[enemyIndex] ?? boss.stats.contactDamage);
  return runtimeDamage / baseDamage;
}

function pickNextAbility(
  world: World,
  enemyIndex: number,
): BossAbilityDefinition | null {
  const boss = getBossDefinitionForEntity(world, enemyIndex);
  const encounter = getBossEncounterForEntity(world, enemyIndex);
  if (!boss || !encounter) return null;

  let bestAbility: BossAbilityDefinition | null = null;
  let bestWeight = -Infinity;

  for (let i = 0; i < boss.abilityLoadout.length; i++) {
    const entry = boss.abilityLoadout[i];
    const cooldownLeft = encounter.cooldowns[entry.abilityId] ?? 0;
    if (cooldownLeft > 0) continue;
    const ability = bossRegistry.ability(entry.abilityId);
    const priority = Number.isFinite(entry.priority) ? (entry.priority as number) : 0;
    const weight = Number.isFinite(entry.weight) ? (entry.weight as number) : 1;
    const score = priority * 100 + weight + world.rng.range(0, 0.5);
    if (score <= bestWeight) continue;
    bestWeight = score;
    bestAbility = ability;
  }

  return bestAbility;
}

function fireProjectileFan(world: World, enemyIndex: number, ability: BossAbilityDefinition): void {
  if (ability.kind !== "projectile_fan") return;
  const boss = getBossDefinitionForEntity(world, enemyIndex);
  if (!boss) return;

  const ew = getEnemyWorld(world, enemyIndex, KENNEY_TILE_WORLD);
  const pw = getPlayerWorld(world, KENNEY_TILE_WORLD);
  const dx = pw.wx - ew.wx;
  const dy = pw.wy - ew.wy;
  const baseAngle = Math.atan2(dy, dx);
  const count = Math.max(1, Math.floor(ability.projectileCount));
  const spreadRad = (ability.spreadDeg * Math.PI) / 180;
  const startAngle = baseAngle - spreadRad * 0.5;
  const step = count <= 1 ? 0 : spreadRad / (count - 1);
  const damageScale = getBossDamageScale(world, enemyIndex);
  const scaledDamage = Math.max(0, Math.round(ability.damage * damageScale));

  for (let i = 0; i < count; i++) {
    const angle = startAngle + step * i;
    spawnProjectile(world, {
      kind: ability.projectileKind,
      x: ew.wx,
      y: ew.wy,
      dirX: Math.cos(angle),
      dirY: Math.sin(angle),
      speed: ability.speed,
      damage: scaledDamage,
      dmgPhys: scaledDamage,
      dmgFire: 0,
      dmgChaos: 0,
      radius: ability.radius,
      pierce: 0,
      maxDist: ability.speed * ability.ttl,
      ttl: ability.ttl,
      hitsPlayer: true,
      noCollide: true,
      z: (world.ezVisual?.[enemyIndex] ?? 0) + 1,
      zLogical: (world.ezLogical?.[enemyIndex] ?? 0) + 1,
      damageMeta: makeEnemyHitMeta(boss.id, ability.attackId, {
        category: "HIT",
        mode: "INTRINSIC",
        instigatorId: String(enemyIndex),
      }),
    });
  }
}

function spawnHazardPuddle(world: World, enemyIndex: number, ability: BossAbilityDefinition): void {
  if (ability.kind !== "hazard_puddle") return;
  const boss = getBossDefinitionForEntity(world, enemyIndex);
  if (!boss) return;

  const pw = getPlayerWorld(world, KENNEY_TILE_WORLD);
  const angle = world.rng.range(0, Math.PI * 2);
  const radius = world.rng.range(ability.minOffset, ability.maxOffset);
  const damageScale = getBossDamageScale(world, enemyIndex);
  const scaledDamage = Math.max(0, Math.round(ability.damage * damageScale));
  spawnZone(world, {
    kind: ZONE_KIND.HAZARD,
    x: pw.wx + Math.cos(angle) * radius,
    y: pw.wy + Math.sin(angle) * radius,
    radius: ability.radius,
    damage: 0,
    damagePlayer: scaledDamage,
    tickEvery: ability.tickEvery,
    ttl: ability.ttl,
    followPlayer: false,
    playerDamageMeta: makeEnemyHitMeta(boss.id, ability.attackId, {
      category: "DOT",
      mode: "INTRINSIC",
      instigatorId: String(enemyIndex),
      isProcDamage: false,
    }),
  });
}

function castBossAbility(world: World, enemyIndex: number, ability: BossAbilityDefinition): void {
  switch (ability.kind) {
    case "projectile_fan":
      fireProjectileFan(world, enemyIndex, ability);
      return;
    case "hazard_puddle":
      spawnHazardPuddle(world, enemyIndex, ability);
      return;
  }
}

export function bossEncounterSystem(world: World, dt: number): void {
  const encounters = world.bossRuntime.encounters;
  for (let i = 0; i < encounters.length; i++) {
    const encounter = encounters[i];
    if (encounter.status !== "ACTIVE") continue;

    const enemyIndex = encounter.enemyIndex;
    if (!world.eAlive[enemyIndex]) continue;

    encounter.globalCooldownLeftSec = Math.max(0, encounter.globalCooldownLeftSec - dt);
    const cooldownIds = Object.keys(encounter.cooldowns);
    for (let j = 0; j < cooldownIds.length; j++) {
      const id = cooldownIds[j];
      encounter.cooldowns[id] = Math.max(0, encounter.cooldowns[id] - dt);
    }

    if (encounter.globalCooldownLeftSec > 0) continue;

    const ability = pickNextAbility(world, enemyIndex);
    if (!ability) continue;

    castBossAbility(world, enemyIndex, ability);
    encounter.cooldowns[ability.id] = Math.max(0.1, ability.cooldownSec);
    encounter.globalCooldownLeftSec = 0.7;
    encounter.lastAbilityId = ability.id;
  }
}
