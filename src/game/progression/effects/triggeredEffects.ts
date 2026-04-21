import type { World } from "../../../engine/world/world";
import { emitEvent } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import {
  addIgniteStacksFromSnapshots,
  applyIgniteStacked,
  createEnemyAilmentsState,
  type EnemyAilmentsState,
} from "../../combat_mods/ailments/enemyAilments";
import { applyAilmentsFromHit, ensureEnemyAilmentsAt } from "../../combat_mods/ailments/applyAilmentsFromHit";
import { resolveDotStats, resolveWeaponStats } from "../../combat_mods/stats/combatStatsResolver";
import { makePlayerTriggerHitMeta, isProcDamage } from "../../combat/damageMeta";
import { getEnemyAimWorld, getPlayerAimWorld } from "../../combat/aimPoints";
import { getEnemyWorld } from "../../coords/worldViews";
import type { GameEvent, TriggerKey } from "../../events";
import { PRJ_KIND, spawnProjectile } from "../../factories/projectileFactory";
import { queryCircle } from "../../util/spatialHash";
import { isEnemyInCircle } from "../../systems/sim/hitDetection";
import { finalizeEnemyDeath } from "../../systems/enemies/finalize";
import { collectWorldCombatRules, applyChaosHitConversion, scaleTriggerProcChance, type CombatRulesSnapshot } from "./combatRules";
import { collectWorldRuntimeEffects, collectWorldStatMods } from "./worldEffects";
import type {
  RuntimeEffect,
  SpawnProjectileTriggeredActionDef,
  TriggerDamageType,
  TriggeredEffectActionDef,
} from "./effectTypes";
import { resolveCombatStarterWeaponId } from "../../combat_mods/content/weapons/characterStarterMap";
import { getCombatStarterWeaponById } from "../../combat_mods/content/weapons/starterWeapons";

type EnemyHitEvent = Extract<GameEvent, { type: "ENEMY_HIT" }>;
type EnemyKilledEvent = Extract<GameEvent, { type: "ENEMY_KILLED" }>;
type PlayerCombatEvent = EnemyHitEvent | EnemyKilledEvent;

type TypedDamageBundle = {
  physical: number;
  fire: number;
  chaos: number;
  total: number;
};

type TriggeredAilmentProfile = {
  bleed: number;
  ignite: number;
  poison: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function scaleValue(value: number, increasedEffectScalar: number): number {
  return value * (1 + increasedEffectScalar);
}

function scaleTriggeredAction(
  action: TriggeredEffectActionDef,
  increasedEffectScalar = 0,
): TriggeredEffectActionDef {
  if (increasedEffectScalar === 0) return action;

  switch (action.kind) {
    case "GAIN_ARMOR":
      return { ...action, amount: scaleValue(action.amount, increasedEffectScalar) };
    case "SPAWN_PROJECTILE":
      return {
        ...action,
        rangePx: action.rangePx == null ? action.rangePx : scaleValue(action.rangePx, increasedEffectScalar),
        speed: scaleValue(action.speed, increasedEffectScalar),
        ttl: scaleValue(action.ttl, increasedEffectScalar),
        radius: scaleValue(action.radius, increasedEffectScalar),
        damageScalar: scaleValue(action.damageScalar, increasedEffectScalar),
        explodeRadius: action.explodeRadius == null ? action.explodeRadius : scaleValue(action.explodeRadius, increasedEffectScalar),
      };
    case "EXPLODE_ON_DEATH":
      return {
        ...action,
        radius: scaleValue(action.radius, increasedEffectScalar),
        damageScalar: scaleValue(action.damageScalar, increasedEffectScalar),
      };
    case "SPREAD_IGNITE_ON_DEATH":
      return { ...action, radius: scaleValue(action.radius, increasedEffectScalar) };
    case "APPLY_IGNITE_FROM_HIT":
      return { ...action, damageScalar: scaleValue(action.damageScalar, increasedEffectScalar) };
    default:
      return action;
  }
}

function playerCombatEventMatchesTrigger(triggerKey: TriggerKey, event: GameEvent): event is PlayerCombatEvent {
  const isPlayerEvent = (event as EnemyHitEvent | EnemyKilledEvent).damageMeta?.instigator?.actor === "PLAYER";
  const isBaseCombatEvent = isPlayerEvent && !isProcDamage((event as EnemyHitEvent | EnemyKilledEvent).damageMeta);

  if (triggerKey === "ON_HIT") {
    return event.type === "ENEMY_HIT" && isBaseCombatEvent;
  }
  if (triggerKey === "ON_CRIT") {
    return event.type === "ENEMY_HIT" && event.isCrit && isBaseCombatEvent;
  }
  if (triggerKey === "ON_KILL") {
    return event.type === "ENEMY_KILLED" && isBaseCombatEvent;
  }
  return false;
}

function eventTypedDamage(event: PlayerCombatEvent): TypedDamageBundle {
  const physical = Number.isFinite(event.dmgPhys) ? Math.max(0, event.dmgPhys as number) : 0;
  const fire = Number.isFinite(event.dmgFire) ? Math.max(0, event.dmgFire as number) : 0;
  const chaos = Number.isFinite(event.dmgChaos) ? Math.max(0, event.dmgChaos as number) : 0;
  const typedTotal = physical + fire + chaos;
  if (typedTotal > 0) {
    return { physical, fire, chaos, total: typedTotal };
  }

  const total = Math.max(0, Number.isFinite(event.damage) ? (event.damage as number) : 0);
  return { physical: total, fire: 0, chaos: 0, total };
}

function ensureEnemyAilments(world: World, enemyIndex: number): EnemyAilmentsState {
  if (!world.eAilments) world.eAilments = [];
  return ensureEnemyAilmentsAt(world.eAilments, enemyIndex);
}

function resolveCurrentTriggeredAilmentProfile(
  world: World,
  rules: CombatRulesSnapshot,
): TriggeredAilmentProfile {
  if (!rules.triggeredHitsCanApplyDots) {
    return { bleed: 0, ignite: 0, poison: 0 };
  }

  const weaponId = resolveCombatStarterWeaponId((world as any).currentCharacterId);
  const weapon = getCombatStarterWeaponById(weaponId);
  const resolved = resolveWeaponStats(weapon, {
    statMods: collectWorldStatMods(world),
  });

  return {
    bleed: resolved.chanceToBleed,
    ignite: resolved.chanceToIgnite,
    poison: resolved.chanceToPoison,
  };
}

function nearestEnemiesInRange(
  world: World,
  centerX: number,
  centerY: number,
  rangePx: number,
  limit: number,
  excludeEnemyIndex: number,
): number[] {
  if (!(rangePx > 0)) return [];
  const nearby = queryCircle(world.enemySpatialHash, centerX, centerY, rangePx + 50);
  const seen = new Set<number>();
  const candidates: Array<{ enemyIndex: number; dist2: number }> = [];

  for (let i = 0; i < nearby.length; i++) {
    const enemyIndex = nearby[i];
    if (enemyIndex === excludeEnemyIndex) continue;
    if (seen.has(enemyIndex)) continue;
    seen.add(enemyIndex);
    if (!world.eAlive[enemyIndex]) continue;
    if (!isEnemyInCircle(world, enemyIndex, centerX, centerY, rangePx)) continue;
    const enemyAim = getEnemyAimWorld(world, enemyIndex);
    const dx = enemyAim.x - centerX;
    const dy = enemyAim.y - centerY;
    candidates.push({ enemyIndex, dist2: dx * dx + dy * dy });
  }

  candidates.sort((left, right) => {
    if (left.dist2 !== right.dist2) return left.dist2 - right.dist2;
    return left.enemyIndex - right.enemyIndex;
  });
  return candidates.slice(0, limit).map((candidate) => candidate.enemyIndex);
}

function resolveTargetEnemyIndex(
  world: World,
  event: PlayerCombatEvent,
  action: SpawnProjectileTriggeredActionDef,
): number {
  if (action.targeting === "EVENT_ENEMY") {
    return event.enemyIndex >= 0 && world.eAlive[event.enemyIndex] ? event.enemyIndex : -1;
  }

  const excludeEnemyIndex = event.type === "ENEMY_HIT" ? event.enemyIndex : event.enemyIndex;
  const origin =
    event.enemyIndex >= 0 && world.eAlive[event.enemyIndex]
      ? getEnemyAimWorld(world, event.enemyIndex)
      : { x: event.x, y: event.y };
  const rangePx = Math.max(0, action.rangePx ?? 0);
  const nearby = nearestEnemiesInRange(world, origin.x, origin.y, rangePx, 1, excludeEnemyIndex);
  if (nearby.length > 0) return nearby[0];
  return event.enemyIndex >= 0 && world.eAlive[event.enemyIndex] ? event.enemyIndex : -1;
}

function resolveProjectileOrigin(
  world: World,
  event: PlayerCombatEvent,
  action: SpawnProjectileTriggeredActionDef,
): { x: number; y: number } {
  if (action.origin === "PLAYER_AIM") {
    return getPlayerAimWorld(world);
  }
  if (event.enemyIndex >= 0 && world.eAlive[event.enemyIndex]) {
    return getEnemyAimWorld(world, event.enemyIndex);
  }
  return { x: event.x, y: event.y };
}

function resolveTypedDamageByKind(
  damageType: TriggerDamageType,
  event: PlayerCombatEvent,
  damageScalar: number,
): TypedDamageBundle {
  const typed = eventTypedDamage(event);
  const total = Math.max(0, typed.total * Math.max(0, damageScalar));

  switch (damageType) {
    case "PHYSICAL":
      return { physical: total, fire: 0, chaos: 0, total };
    case "FIRE":
      return { physical: 0, fire: total, chaos: 0, total };
    case "CHAOS":
      return { physical: 0, fire: 0, chaos: total, total };
    case "MATCH_HIT":
    default: {
      if (typed.total <= 0) return { physical: total, fire: 0, chaos: 0, total };
      const scale = total / typed.total;
      return {
        physical: typed.physical * scale,
        fire: typed.fire * scale,
        chaos: typed.chaos * scale,
        total,
      };
    }
  }
}

function resolveTriggerDamageBundle(
  event: PlayerCombatEvent,
  damageType: TriggerDamageType,
  damageScalar: number,
  rules: CombatRulesSnapshot,
): TypedDamageBundle {
  const raw = resolveTypedDamageByKind(damageType, event, damageScalar);
  const converted = applyChaosHitConversion(
    { physical: raw.physical, fire: raw.fire, chaos: raw.chaos },
    rules,
  );
  return {
    physical: converted.physical,
    fire: converted.fire,
    chaos: converted.chaos,
    total: converted.physical + converted.fire + converted.chaos,
  };
}

function applyTriggeredAilments(
  world: World,
  enemyIndex: number,
  dealt: TypedDamageBundle,
  ailmentProfile: TriggeredAilmentProfile,
  rules: CombatRulesSnapshot,
  dotStats: ReturnType<typeof resolveDotStats>,
): void {
  if (
    ailmentProfile.bleed <= 0
    && ailmentProfile.ignite <= 0
    && ailmentProfile.poison <= 0
  ) {
    return;
  }

  const ailmentState = ensureEnemyAilments(world, enemyIndex);
  applyAilmentsFromHit(
    ailmentState,
    { physical: dealt.physical, fire: dealt.fire, chaos: dealt.chaos },
    ailmentProfile,
    {
      bleed: world.rng.range(0, 1),
      ignite: world.rng.range(0, 1),
      poison: world.rng.range(0, 1),
    },
    {
      poisonDamageMult: dotStats.poisonDamageMult,
      igniteDamageMult: dotStats.igniteDamageMult,
      poisonDurationMult: dotStats.dotDurationMult,
      igniteDurationMult: dotStats.dotDurationMult,
      additionalPoisonStackChance: rules.poisonExtraStackChance,
      additionalPoisonStackRoll: world.rng.range(0, 1),
    },
  );
}

function spawnTriggeredProjectile(
  world: World,
  runtimeEffect: RuntimeEffect,
  event: PlayerCombatEvent,
  action: SpawnProjectileTriggeredActionDef,
  rules: CombatRulesSnapshot,
  ailmentProfile: TriggeredAilmentProfile,
): void {
  const targetEnemyIndex = resolveTargetEnemyIndex(world, event, action);
  if (targetEnemyIndex < 0 || !world.eAlive[targetEnemyIndex]) return;

  const from = resolveProjectileOrigin(world, event, action);
  const to = getEnemyAimWorld(world, targetEnemyIndex);
  const dirX = to.x - from.x;
  const dirY = to.y - from.y;
  const len = Math.hypot(dirX, dirY) || 1;
  const damage = resolveTriggerDamageBundle(event, action.damageType, action.damageScalar, rules);
  const meta = makePlayerTriggerHitMeta(runtimeEffect.source.ringDefId ?? runtimeEffect.source.id, {
    category: "HIT",
    instigatorId: "player",
    isProcDamage: true,
  });

  const projectileIndex = spawnProjectile(world, {
    kind: action.projectileKind,
    x: from.x,
    y: from.y,
    dirX: dirX / len,
    dirY: dirY / len,
    speed: action.speed,
    damage: damage.total,
    dmgPhys: damage.physical,
    dmgFire: damage.fire,
    dmgChaos: damage.chaos,
    critChance: 0,
    critMulti: 1,
    chanceBleed: ailmentProfile.bleed,
    chanceIgnite: ailmentProfile.ignite,
    chancePoison: ailmentProfile.poison,
    radius: action.radius,
    pierce: 0,
    ttl: action.ttl,
    targetX: to.x,
    targetY: to.y,
    explodeRadius: action.explodeRadius,
    noCollide: !!action.noCollide,
    damageMeta: meta,
  });

  if (action.explodeRadius && damage.total > 0) {
    world.prDamage[projectileIndex] = 0;
    world.prDmgPhys[projectileIndex] = 0;
    world.prDmgFire[projectileIndex] = 0;
    world.prDmgChaos[projectileIndex] = 0;
    world.prExplodeDmg[projectileIndex] = damage.total;
    world.prExplodeTtl[projectileIndex] = 0.25;
  }
  world.prLastHitEnemy[projectileIndex] = targetEnemyIndex;
  emitEvent(world, { type: "SFX", id: "FIRE_OTHER", vol: 0.35 });
}

function applyTriggeredExplosion(
  world: World,
  runtimeEffect: RuntimeEffect,
  event: EnemyKilledEvent,
  action: Extract<TriggeredEffectActionDef, { kind: "EXPLODE_ON_DEATH" }>,
  rules: CombatRulesSnapshot,
  ailmentProfile: TriggeredAilmentProfile,
  dotStats: ReturnType<typeof resolveDotStats>,
): void {
  const centerX = event.x;
  const centerY = event.y;
  const basisValue =
    action.damageBasis === "TARGET_MAX_LIFE"
      ? Math.max(0, world.eHpMax[event.enemyIndex] ?? 0)
      : eventTypedDamage(event).total;
  const damage = resolveTriggerDamageBundle(
    {
      ...event,
      damage: basisValue,
      dmgPhys: basisValue,
      dmgFire: 0,
      dmgChaos: 0,
    },
    action.damageType,
    action.damageScalar,
    rules,
  );
  if (!(damage.total > 0)) return;

  const meta = makePlayerTriggerHitMeta(runtimeEffect.source.ringDefId ?? runtimeEffect.source.id, {
    category: "HIT",
    instigatorId: "player",
    isProcDamage: true,
  });

  emitEvent(world, { type: "VFX", id: "EXPLOSION", x: centerX, y: centerY, radius: action.radius });
  emitEvent(world, { type: "SFX", id: "EXPLOSION_SYRINGE", vol: 0.55 });

  const nearby = queryCircle(world.enemySpatialHash, centerX, centerY, action.radius + 50);
  const seen = new Set<number>();
  for (let i = 0; i < nearby.length; i++) {
    const enemyIndex = nearby[i];
    if (enemyIndex === event.enemyIndex) continue;
    if (seen.has(enemyIndex)) continue;
    seen.add(enemyIndex);
    if (!world.eAlive[enemyIndex]) continue;
    if (!isEnemyInCircle(world, enemyIndex, centerX, centerY, action.radius)) continue;

    applyTriggeredAilments(world, enemyIndex, damage, ailmentProfile, rules, dotStats);

    world.eHp[enemyIndex] -= damage.total;
    const enemyAim = getEnemyAimWorld(world, enemyIndex);
    emitEvent(world, {
      type: "ENEMY_HIT",
      enemyIndex,
      damage: damage.total,
      dmgPhys: damage.physical,
      dmgFire: damage.fire,
      dmgChaos: damage.chaos,
      x: enemyAim.x,
      y: enemyAim.y,
      isCrit: false,
      damageMeta: meta,
      source: "OTHER",
    });

    if (world.eHp[enemyIndex] > 0) continue;

    finalizeEnemyDeath(world, enemyIndex, {
      damageMeta: meta,
      source: "OTHER",
      damage: damage.total,
      dmgPhys: damage.physical,
      dmgFire: damage.fire,
      dmgChaos: damage.chaos,
      isCrit: false,
      x: enemyAim.x,
      y: enemyAim.y,
    });
  }
}

function applyIgniteSpreadOnDeath(
  world: World,
  event: EnemyKilledEvent,
  radius: number,
): void {
  const deadState = world.eAilments?.[event.enemyIndex];
  const deadIgniteRaw = (deadState as any)?.ignite;
  const deadIgniteStacks = Array.isArray(deadIgniteRaw)
    ? deadIgniteRaw
    : (deadIgniteRaw ? [deadIgniteRaw] : []);
  if (deadIgniteStacks.length <= 0) return;

  const nearby = queryCircle(world.enemySpatialHash, event.x, event.y, radius + 50);
  const seen = new Set<number>();
  for (let i = 0; i < nearby.length; i++) {
    const enemyIndex = nearby[i];
    if (enemyIndex === event.enemyIndex) continue;
    if (seen.has(enemyIndex)) continue;
    seen.add(enemyIndex);
    if (!world.eAlive[enemyIndex]) continue;
    if (!isEnemyInCircle(world, enemyIndex, event.x, event.y, radius)) continue;
    if (!world.eAilments) world.eAilments = [];
    if (!world.eAilments[enemyIndex]) world.eAilments[enemyIndex] = createEnemyAilmentsState();
    addIgniteStacksFromSnapshots(world.eAilments[enemyIndex]!, deadIgniteStacks);
  }
}

function applyIgniteFromHit(
  world: World,
  event: EnemyHitEvent,
  damageScalar: number,
  dotStats: ReturnType<typeof resolveDotStats>,
): void {
  if (event.enemyIndex < 0 || !world.eAlive[event.enemyIndex]) return;
  const dealt = eventTypedDamage(event);
  const damageTotal = Math.max(0, dealt.total * Math.max(0, damageScalar));
  if (!(damageTotal > 0)) return;
  const ailmentState = ensureEnemyAilments(world, event.enemyIndex);
  applyIgniteStacked(ailmentState, damageTotal * dotStats.igniteDamageMult, {
    durationMult: dotStats.dotDurationMult,
  });
}

function applyTriggeredAction(
  world: World,
  action: TriggeredEffectActionDef,
  runtimeEffect: RuntimeEffect,
  event: PlayerCombatEvent,
  rules: CombatRulesSnapshot,
  ailmentProfile: TriggeredAilmentProfile,
  dotStats: ReturnType<typeof resolveDotStats>,
): void {
  switch (action.kind) {
    case "GAIN_ARMOR": {
      const nextArmor = (Number.isFinite(world.currentArmor) ? world.currentArmor : 0) + action.amount;
      const maxArmor = Number.isFinite(world.maxArmor) ? world.maxArmor : 0;
      world.currentArmor = Math.max(0, Math.min(maxArmor, nextArmor));
      return;
    }
    case "SPAWN_PROJECTILE":
      spawnTriggeredProjectile(world, runtimeEffect, event, action, rules, ailmentProfile);
      return;
    case "EXPLODE_ON_DEATH":
      if (event.type === "ENEMY_KILLED") {
        applyTriggeredExplosion(world, runtimeEffect, event, action, rules, ailmentProfile, dotStats);
      }
      return;
    case "SPREAD_IGNITE_ON_DEATH":
      if (event.type === "ENEMY_KILLED") {
        applyIgniteSpreadOnDeath(world, event, action.radius);
      }
      return;
    case "APPLY_IGNITE_FROM_HIT":
      if (event.type === "ENEMY_HIT") {
        applyIgniteFromHit(world, event, action.damageScalar, dotStats);
      }
      return;
  }
}

function shouldProc(
  world: World,
  baseChance: number,
  retryFailedOnce: boolean,
): boolean {
  const firstRoll = world.rng.range(0, 1);
  if (firstRoll < baseChance) return true;
  if (!retryFailedOnce) return false;
  return world.rng.range(0, 1) < baseChance;
}

export function processProgressionTriggeredEffects(world: any): void {
  if (!Array.isArray(world?.events) || world.events.length <= 0) return;
  const runtimeEffects = collectWorldRuntimeEffects(world);
  const rules = collectWorldCombatRules(world);
  const dotStats = resolveDotStats({ statMods: collectWorldStatMods(world) });
  const ailmentProfile = resolveCurrentTriggeredAilmentProfile(world, rules);
  const eventCount = world.events.length;

  for (const runtimeEffect of runtimeEffects) {
    const effect = runtimeEffect.effect;
    if (effect.kind !== "TRIGGERED") continue;

    const action = scaleTriggeredAction(effect.action, runtimeEffect.increasedEffectScalar ?? 0);
    const scaledProcChance = scaleTriggerProcChance(
      scaleValue(effect.procChance ?? 1, runtimeEffect.increasedEffectScalar ?? 0),
      rules,
    );

    for (let index = 0; index < eventCount; index++) {
      const event = world.events[index] as GameEvent;
      if (!playerCombatEventMatchesTrigger(effect.triggerKey, event)) continue;
      if (scaledProcChance < 1 && !shouldProc(world, scaledProcChance, rules.retryFailedTriggerProcsOnce)) {
        continue;
      }

      applyTriggeredAction(world, action, runtimeEffect, event, rules, ailmentProfile, dotStats);
      if (rules.doubleTriggers) {
        applyTriggeredAction(world, action, runtimeEffect, event, rules, ailmentProfile, dotStats);
      }
    }
  }
}
