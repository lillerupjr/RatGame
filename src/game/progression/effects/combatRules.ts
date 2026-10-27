// @system   ring-progression/system
// @owns     collect, scale, and snapshot combat-rule runtime effects
// @doc      docs/canonical/ring_progression_system.md
// @agents   no trigger action execution or weapon stat resolution; see triggeredEffects.ts and combatStatsResolver.ts

import { collectWorldRingFamilyCounts, collectWorldRingRuntimeEffects } from "../rings/ringEffects";
import type {
  CombatRuleDef,
  RuntimeEffect,
  TriggerDamageType,
} from "./effectTypes";

export type TypedHitDamage = {
  physical: number;
  fire: number;
  chaos: number;
};

export type CombatRulesSnapshot = {
  everyNthShotCrits: number | null;
  piercePoisonedTargets: boolean;
  pierceHitsMoreDamageToPoisoned: number;
  moreDamageToBurningTargets: number;
  pointBlankDamageFalloff: {
    maxRangePx: number;
    maxMore: number;
  } | null;
  pointBlankCloseHitKnockback: {
    rangePx: number;
    basePushPx: number;
    bonusPushPx: number;
  } | null;
  noPierceNearbyHitDamageIncreased: {
    rangePx: number;
    increased: number;
  } | null;
  projectileHitDamageIncreasedPerPiercedEnemy: number;
  physicalHitDamageIncreased: number;
  suppressNonPhysicalHitDamage: boolean;
  critRollsTwice: boolean;
  triggeredHitsCanApplyDots: boolean;
  convertAllHitDamageToChaos: boolean;
  poisonExtraStackChance: number;
  doubleTriggers: boolean;
  triggerProcChanceIncreased: number;
  retryFailedTriggerProcsOnce: boolean;
  poisonedEnemiesExplodeOnDeath: {
    radius: number;
    damageScalar: number;
    damageType: TriggerDamageType;
  } | null;
  burningEnemiesMoveSpeedReduced: number;
  poisonedEnemiesDamageReduced: number;
  poisonTrail: {
    radius: number;
    poisonDps: number;
    tickEvery: number;
    trailTtl: number;
    dropEvery: number;
  } | null;
  laserExecutor: {
    thresholdFraction: number;
    rangePx: number;
    scanEvery: number;
  } | null;
  physicalHitStunChance: {
    chance: number;
    stunDurationSec: number;
  } | null;
  timedNextShotEmpower: {
    chargeEvery: number;
    physicalDamageIncreased: number;
  } | null;
  killEmpowerNextShot: {
    damageIncreased: number;
  } | null;
  critMoveSpeedBuff: {
    moveSpeedIncreased: number;
    durationSec: number;
  } | null;
  livingBomb: {
    markEvery: number;
    speedIncreased: number;
    explosionDamageScalar: number;
    explosionRadius: number;
  } | null;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function scaleValue(value: number, increasedEffectScalar: number): number {
  return value * (1 + increasedEffectScalar);
}

export function scaleCombatRule(
  rule: CombatRuleDef,
  increasedEffectScalar = 0,
): CombatRuleDef {
  if (increasedEffectScalar === 0) return rule;

  switch (rule.kind) {
    case "PIERCE_HITS_MORE_DAMAGE_TO_POISONED":
      return { ...rule, more: scaleValue(rule.more, increasedEffectScalar) };
    case "MORE_DAMAGE_TO_BURNING_TARGETS":
      return { ...rule, more: scaleValue(rule.more, increasedEffectScalar) };
    case "POINT_BLANK_DAMAGE_FALLOFF":
      return {
        ...rule,
        maxRangePx: scaleValue(rule.maxRangePx, increasedEffectScalar),
        maxMore: scaleValue(rule.maxMore, increasedEffectScalar),
      };
    case "POINT_BLANK_CLOSE_HIT_KNOCKBACK":
      return {
        ...rule,
        rangePx: scaleValue(rule.rangePx, increasedEffectScalar),
        basePushPx: scaleValue(rule.basePushPx, increasedEffectScalar),
        bonusPushPx: scaleValue(rule.bonusPushPx, increasedEffectScalar),
      };
    case "NO_PIERCE_NEARBY_HIT_DAMAGE_INCREASED":
      return {
        ...rule,
        rangePx: scaleValue(rule.rangePx, increasedEffectScalar),
        increased: scaleValue(rule.increased, increasedEffectScalar),
      };
    case "PHYSICAL_HIT_DAMAGE_INCREASED_NON_PHYSICAL_SUPPRESSED":
      return { ...rule, increased: scaleValue(rule.increased, increasedEffectScalar) };
    case "PHYSICAL_HIT_DAMAGE_INCREASED_PER_EQUIPPED_FAMILY_RING":
      return { ...rule, increasedPerRing: scaleValue(rule.increasedPerRing, increasedEffectScalar) };
    case "PROJECTILE_HIT_DAMAGE_INCREASED_PER_PIERCED_ENEMY":
      return { ...rule, increasedPerEnemy: scaleValue(rule.increasedPerEnemy, increasedEffectScalar) };
    case "POISON_EXTRA_STACK_CHANCE":
      return { ...rule, chance: clamp01(scaleValue(rule.chance, increasedEffectScalar)) };
    case "TRIGGER_PROC_CHANCE_INCREASED":
      return { ...rule, increased: scaleValue(rule.increased, increasedEffectScalar) };
    case "POISONED_ENEMIES_EXPLODE_ON_DEATH":
      return {
        ...rule,
        damageScalar: scaleValue(rule.damageScalar, increasedEffectScalar),
        radius: scaleValue(rule.radius, increasedEffectScalar),
      };
    case "BURNING_ENEMIES_MOVE_SPEED_REDUCED":
      return { ...rule, reduced: scaleValue(rule.reduced, increasedEffectScalar) };
    case "POISONED_ENEMIES_DAMAGE_REDUCED":
      return { ...rule, reduced: scaleValue(rule.reduced, increasedEffectScalar) };
    case "POISON_TRAIL":
      return {
        ...rule,
        radius: scaleValue(rule.radius, increasedEffectScalar),
        poisonDps: scaleValue(rule.poisonDps, increasedEffectScalar),
      };
    case "LASER_EXECUTOR":
      return {
        ...rule,
        rangePx: scaleValue(rule.rangePx, increasedEffectScalar),
        thresholdFraction: clamp01(scaleValue(rule.thresholdFraction, increasedEffectScalar)),
      };
    case "PHYSICAL_HIT_STUN_CHANCE":
      return {
        ...rule,
        chance: clamp01(scaleValue(rule.chance, increasedEffectScalar)),
        stunDurationSec: scaleValue(rule.stunDurationSec, increasedEffectScalar),
      };
    case "TIMED_NEXT_SHOT_EMPOWER":
      return {
        ...rule,
        physicalDamageIncreased: scaleValue(rule.physicalDamageIncreased, increasedEffectScalar),
      };
    case "KILL_EMPOWER_NEXT_SHOT":
      return {
        ...rule,
        damageIncreased: scaleValue(rule.damageIncreased, increasedEffectScalar),
      };
    case "CRIT_MOVE_SPEED_BUFF":
      return {
        ...rule,
        moveSpeedIncreased: scaleValue(rule.moveSpeedIncreased, increasedEffectScalar),
        durationSec: scaleValue(rule.durationSec, increasedEffectScalar),
      };
    case "LIVING_BOMB":
      return {
        ...rule,
        explosionDamageScalar: scaleValue(rule.explosionDamageScalar, increasedEffectScalar),
        explosionRadius: scaleValue(rule.explosionRadius, increasedEffectScalar),
      };
    default:
      return rule;
  }
}

export function collectCombatRulesFromRuntimeEffects(
  effects: readonly RuntimeEffect[] = [],
): CombatRuleDef[] {
  const rules: CombatRuleDef[] = [];

  for (const runtimeEffect of effects) {
    const effect = runtimeEffect.effect;
    if (effect.kind !== "COMBAT_RULES") continue;
    const scalar = runtimeEffect.increasedEffectScalar ?? 0;
    for (const rule of effect.rules) {
      rules.push(scaleCombatRule(rule, scalar));
    }
  }

  return rules;
}

export function buildCombatRulesSnapshot(
  rules: readonly CombatRuleDef[] = [],
  args: {
    equippedRingFamilyCounts?: Partial<Record<string, number>>;
  } = {},
): CombatRulesSnapshot {
  const snapshot: CombatRulesSnapshot = {
    everyNthShotCrits: null,
    piercePoisonedTargets: false,
    pierceHitsMoreDamageToPoisoned: 0,
    moreDamageToBurningTargets: 0,
    pointBlankDamageFalloff: null,
    pointBlankCloseHitKnockback: null,
    noPierceNearbyHitDamageIncreased: null,
    projectileHitDamageIncreasedPerPiercedEnemy: 0,
    physicalHitDamageIncreased: 0,
    suppressNonPhysicalHitDamage: false,
    critRollsTwice: false,
    triggeredHitsCanApplyDots: false,
    convertAllHitDamageToChaos: false,
    poisonExtraStackChance: 0,
    doubleTriggers: false,
    triggerProcChanceIncreased: 0,
    retryFailedTriggerProcsOnce: false,
    poisonedEnemiesExplodeOnDeath: null,
    burningEnemiesMoveSpeedReduced: 0,
    poisonedEnemiesDamageReduced: 0,
    poisonTrail: null,
    laserExecutor: null,
    physicalHitStunChance: null,
    timedNextShotEmpower: null,
    killEmpowerNextShot: null,
    critMoveSpeedBuff: null,
    livingBomb: null,
  };

  for (const rule of rules) {
    switch (rule.kind) {
      case "EVERY_NTH_SHOT_CRITS":
        snapshot.everyNthShotCrits =
          snapshot.everyNthShotCrits == null
            ? Math.max(1, Math.floor(rule.everyShots))
            : Math.min(snapshot.everyNthShotCrits, Math.max(1, Math.floor(rule.everyShots)));
        break;
      case "PIERCE_POISONED_TARGETS":
        snapshot.piercePoisonedTargets = true;
        break;
      case "PIERCE_HITS_MORE_DAMAGE_TO_POISONED":
        snapshot.pierceHitsMoreDamageToPoisoned += Math.max(0, rule.more);
        break;
      case "MORE_DAMAGE_TO_BURNING_TARGETS":
        snapshot.moreDamageToBurningTargets += Math.max(0, rule.more);
        break;
      case "POINT_BLANK_DAMAGE_FALLOFF":
        if (!snapshot.pointBlankDamageFalloff) {
          snapshot.pointBlankDamageFalloff = {
            maxRangePx: Math.max(0, rule.maxRangePx),
            maxMore: Math.max(0, rule.maxMore),
          };
        } else {
          snapshot.pointBlankDamageFalloff.maxRangePx = Math.max(
            snapshot.pointBlankDamageFalloff.maxRangePx,
            Math.max(0, rule.maxRangePx),
          );
          snapshot.pointBlankDamageFalloff.maxMore += Math.max(0, rule.maxMore);
        }
        break;
      case "POINT_BLANK_CLOSE_HIT_KNOCKBACK":
        if (!snapshot.pointBlankCloseHitKnockback) {
          snapshot.pointBlankCloseHitKnockback = {
            rangePx: Math.max(0, rule.rangePx),
            basePushPx: Math.max(0, rule.basePushPx),
            bonusPushPx: Math.max(0, rule.bonusPushPx),
          };
        } else {
          snapshot.pointBlankCloseHitKnockback.rangePx = Math.max(
            snapshot.pointBlankCloseHitKnockback.rangePx,
            Math.max(0, rule.rangePx),
          );
          snapshot.pointBlankCloseHitKnockback.basePushPx += Math.max(0, rule.basePushPx);
          snapshot.pointBlankCloseHitKnockback.bonusPushPx += Math.max(0, rule.bonusPushPx);
        }
        break;
      case "NO_PIERCE_NEARBY_HIT_DAMAGE_INCREASED":
        if (!snapshot.noPierceNearbyHitDamageIncreased) {
          snapshot.noPierceNearbyHitDamageIncreased = {
            rangePx: Math.max(0, rule.rangePx),
            increased: Math.max(0, rule.increased),
          };
        } else {
          snapshot.noPierceNearbyHitDamageIncreased.rangePx = Math.max(
            snapshot.noPierceNearbyHitDamageIncreased.rangePx,
            Math.max(0, rule.rangePx),
          );
          snapshot.noPierceNearbyHitDamageIncreased.increased += Math.max(0, rule.increased);
        }
        break;
      case "PHYSICAL_HIT_DAMAGE_INCREASED_NON_PHYSICAL_SUPPRESSED":
        snapshot.physicalHitDamageIncreased += Math.max(0, rule.increased);
        snapshot.suppressNonPhysicalHitDamage = true;
        break;
      case "PHYSICAL_HIT_DAMAGE_INCREASED_PER_EQUIPPED_FAMILY_RING": {
        const equippedCount = Math.max(
          0,
          Math.floor(args.equippedRingFamilyCounts?.[rule.familyId] ?? 0),
        );
        snapshot.physicalHitDamageIncreased += equippedCount * Math.max(0, rule.increasedPerRing);
        break;
      }
      case "PROJECTILE_HIT_DAMAGE_INCREASED_PER_PIERCED_ENEMY":
        snapshot.projectileHitDamageIncreasedPerPiercedEnemy += Math.max(0, rule.increasedPerEnemy);
        break;
      case "CRIT_ROLLS_TWICE":
        snapshot.critRollsTwice = true;
        break;
      case "TRIGGERED_HITS_CAN_APPLY_DOTS":
        snapshot.triggeredHitsCanApplyDots = true;
        break;
      case "CONVERT_ALL_HIT_DAMAGE_TO_CHAOS":
        snapshot.convertAllHitDamageToChaos = true;
        break;
      case "POISON_EXTRA_STACK_CHANCE":
        snapshot.poisonExtraStackChance = clamp01(
          snapshot.poisonExtraStackChance + Math.max(0, rule.chance),
        );
        break;
      case "DOUBLE_TRIGGERS":
        snapshot.doubleTriggers = true;
        break;
      case "TRIGGER_PROC_CHANCE_INCREASED":
        snapshot.triggerProcChanceIncreased += Math.max(0, rule.increased);
        break;
      case "RETRY_FAILED_TRIGGER_PROCS_ONCE":
        snapshot.retryFailedTriggerProcsOnce = true;
        break;
      case "POISONED_ENEMIES_EXPLODE_ON_DEATH":
        if (!snapshot.poisonedEnemiesExplodeOnDeath) {
          snapshot.poisonedEnemiesExplodeOnDeath = {
            radius: Math.max(0, rule.radius),
            damageScalar: Math.max(0, rule.damageScalar),
            damageType: rule.damageType,
          };
        } else {
          snapshot.poisonedEnemiesExplodeOnDeath.radius = Math.max(
            snapshot.poisonedEnemiesExplodeOnDeath.radius,
            Math.max(0, rule.radius),
          );
          snapshot.poisonedEnemiesExplodeOnDeath.damageScalar = Math.max(
            snapshot.poisonedEnemiesExplodeOnDeath.damageScalar,
            Math.max(0, rule.damageScalar),
          );
        }
        break;
      case "BURNING_ENEMIES_MOVE_SPEED_REDUCED":
        snapshot.burningEnemiesMoveSpeedReduced += Math.max(0, rule.reduced);
        break;
      case "POISONED_ENEMIES_DAMAGE_REDUCED":
        snapshot.poisonedEnemiesDamageReduced += Math.max(0, rule.reduced);
        break;
      case "POISON_TRAIL":
        if (!snapshot.poisonTrail) {
          snapshot.poisonTrail = {
            radius: Math.max(0, rule.radius),
            poisonDps: Math.max(0, rule.poisonDps),
            tickEvery: Math.max(0.02, rule.tickEvery),
            trailTtl: Math.max(0, rule.trailTtl),
            dropEvery: Math.max(0.02, rule.dropEvery),
          };
        } else {
          snapshot.poisonTrail.poisonDps = Math.max(snapshot.poisonTrail.poisonDps, Math.max(0, rule.poisonDps));
          snapshot.poisonTrail.radius = Math.max(snapshot.poisonTrail.radius, Math.max(0, rule.radius));
        }
        break;
      case "LASER_EXECUTOR":
        if (!snapshot.laserExecutor) {
          snapshot.laserExecutor = {
            thresholdFraction: clamp01(Math.max(0, rule.thresholdFraction)),
            rangePx: Math.max(0, rule.rangePx),
            scanEvery: Math.max(0.1, rule.scanEvery),
          };
        } else {
          snapshot.laserExecutor.thresholdFraction = clamp01(
            Math.max(snapshot.laserExecutor.thresholdFraction, Math.max(0, rule.thresholdFraction)),
          );
          snapshot.laserExecutor.rangePx = Math.max(snapshot.laserExecutor.rangePx, Math.max(0, rule.rangePx));
          snapshot.laserExecutor.scanEvery = Math.min(snapshot.laserExecutor.scanEvery, Math.max(0.1, rule.scanEvery));
        }
        break;
      case "PHYSICAL_HIT_STUN_CHANCE":
        if (!snapshot.physicalHitStunChance) {
          snapshot.physicalHitStunChance = {
            chance: clamp01(Math.max(0, rule.chance)),
            stunDurationSec: Math.max(0, rule.stunDurationSec),
          };
        } else {
          snapshot.physicalHitStunChance.chance = clamp01(
            Math.max(snapshot.physicalHitStunChance.chance, Math.max(0, rule.chance)),
          );
          snapshot.physicalHitStunChance.stunDurationSec = Math.max(
            snapshot.physicalHitStunChance.stunDurationSec,
            Math.max(0, rule.stunDurationSec),
          );
        }
        break;
      case "TIMED_NEXT_SHOT_EMPOWER":
        if (!snapshot.timedNextShotEmpower) {
          snapshot.timedNextShotEmpower = {
            chargeEvery: Math.max(0.1, rule.chargeEvery),
            physicalDamageIncreased: Math.max(0, rule.physicalDamageIncreased),
          };
        } else {
          snapshot.timedNextShotEmpower.chargeEvery = Math.min(
            snapshot.timedNextShotEmpower.chargeEvery,
            Math.max(0.1, rule.chargeEvery),
          );
          snapshot.timedNextShotEmpower.physicalDamageIncreased = Math.max(
            snapshot.timedNextShotEmpower.physicalDamageIncreased,
            Math.max(0, rule.physicalDamageIncreased),
          );
        }
        break;
      case "KILL_EMPOWER_NEXT_SHOT":
        if (!snapshot.killEmpowerNextShot) {
          snapshot.killEmpowerNextShot = {
            damageIncreased: Math.max(0, rule.damageIncreased),
          };
        } else {
          snapshot.killEmpowerNextShot.damageIncreased += Math.max(0, rule.damageIncreased);
        }
        break;
      case "CRIT_MOVE_SPEED_BUFF":
        if (!snapshot.critMoveSpeedBuff) {
          snapshot.critMoveSpeedBuff = {
            moveSpeedIncreased: Math.max(0, rule.moveSpeedIncreased),
            durationSec: Math.max(0, rule.durationSec),
          };
        } else {
          snapshot.critMoveSpeedBuff.moveSpeedIncreased = Math.max(
            snapshot.critMoveSpeedBuff.moveSpeedIncreased,
            Math.max(0, rule.moveSpeedIncreased),
          );
          snapshot.critMoveSpeedBuff.durationSec = Math.max(
            snapshot.critMoveSpeedBuff.durationSec,
            Math.max(0, rule.durationSec),
          );
        }
        break;
      case "LIVING_BOMB":
        if (!snapshot.livingBomb) {
          snapshot.livingBomb = {
            markEvery: Math.max(0.1, rule.markEvery),
            speedIncreased: Math.max(0, rule.speedIncreased),
            explosionDamageScalar: Math.max(0, rule.explosionDamageScalar),
            explosionRadius: Math.max(0, rule.explosionRadius),
          };
        } else {
          snapshot.livingBomb.explosionDamageScalar = Math.max(
            snapshot.livingBomb.explosionDamageScalar,
            Math.max(0, rule.explosionDamageScalar),
          );
          snapshot.livingBomb.explosionRadius = Math.max(
            snapshot.livingBomb.explosionRadius,
            Math.max(0, rule.explosionRadius),
          );
        }
        break;
    }
  }

  return snapshot;
}

export function collectWorldCombatRules(world: any): CombatRulesSnapshot {
  return buildCombatRulesSnapshot(
    collectCombatRulesFromRuntimeEffects(collectWorldRingRuntimeEffects(world)),
    { equippedRingFamilyCounts: collectWorldRingFamilyCounts(world) },
  );
}

export function applyChaosHitConversion(
  damage: TypedHitDamage,
  rules: CombatRulesSnapshot,
): TypedHitDamage {
  if (!rules.convertAllHitDamageToChaos) return damage;
  const total = Math.max(0, damage.physical) + Math.max(0, damage.fire) + Math.max(0, damage.chaos);
  return {
    physical: 0,
    fire: 0,
    chaos: total,
  };
}

export function scaleTriggerProcChance(
  baseChance: number,
  rules: CombatRulesSnapshot,
): number {
  return clamp01(Math.max(0, baseChance) * (1 + Math.max(0, rules.triggerProcChanceIncreased)));
}

export function applyPhysicalHitDamageIncreased(
  damage: TypedHitDamage,
  rules: CombatRulesSnapshot,
): TypedHitDamage {
  const scale = 1 + Math.max(0, rules.physicalHitDamageIncreased);
  return {
    physical: Math.max(0, damage.physical) * scale,
    fire: Math.max(0, damage.fire),
    chaos: Math.max(0, damage.chaos),
  };
}

export function applyProjectilePiercedEnemyDamageIncreased(
  damage: TypedHitDamage,
  rules: CombatRulesSnapshot,
  piercedEnemyCount: number,
): TypedHitDamage {
  const count = Math.max(0, Math.floor(piercedEnemyCount));
  const increased = Math.max(0, rules.projectileHitDamageIncreasedPerPiercedEnemy);
  if (count <= 0 || increased <= 0) return damage;
  const scale = 1 + count * increased;
  return {
    physical: Math.max(0, damage.physical) * scale,
    fire: Math.max(0, damage.fire) * scale,
    chaos: Math.max(0, damage.chaos) * scale,
  };
}

export function applyNonPhysicalHitDamageSuppression(
  damage: TypedHitDamage,
  rules: CombatRulesSnapshot,
): TypedHitDamage {
  if (!rules.suppressNonPhysicalHitDamage) return damage;
  return {
    physical: Math.max(0, damage.physical),
    fire: 0,
    chaos: 0,
  };
}
