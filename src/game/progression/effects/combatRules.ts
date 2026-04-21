import { collectWorldRingRuntimeEffects } from "../rings/ringEffects";
import type {
  CombatRuleDef,
  RuntimeEffect,
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
  critRollsTwice: boolean;
  triggeredHitsCanApplyDots: boolean;
  convertAllHitDamageToChaos: boolean;
  poisonExtraStackChance: number;
  doubleTriggers: boolean;
  triggerProcChanceIncreased: number;
  retryFailedTriggerProcsOnce: boolean;
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
    case "POISON_EXTRA_STACK_CHANCE":
      return { ...rule, chance: clamp01(scaleValue(rule.chance, increasedEffectScalar)) };
    case "TRIGGER_PROC_CHANCE_INCREASED":
      return { ...rule, increased: scaleValue(rule.increased, increasedEffectScalar) };
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
): CombatRulesSnapshot {
  const snapshot: CombatRulesSnapshot = {
    everyNthShotCrits: null,
    piercePoisonedTargets: false,
    pierceHitsMoreDamageToPoisoned: 0,
    moreDamageToBurningTargets: 0,
    pointBlankDamageFalloff: null,
    pointBlankCloseHitKnockback: null,
    critRollsTwice: false,
    triggeredHitsCanApplyDots: false,
    convertAllHitDamageToChaos: false,
    poisonExtraStackChance: 0,
    doubleTriggers: false,
    triggerProcChanceIncreased: 0,
    retryFailedTriggerProcsOnce: false,
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
    }
  }

  return snapshot;
}

export function collectWorldCombatRules(world: any): CombatRulesSnapshot {
  return buildCombatRulesSnapshot(
    collectCombatRulesFromRuntimeEffects(collectWorldRingRuntimeEffects(world)),
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
