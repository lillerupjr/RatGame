// @system   ring-progression/system
// @owns     collect reward manipulation rules from equipped ring runtime effects
// @doc      docs/canonical/ring_progression_system.md
// @agents   no reward option generation or reward UI state; see progressionOffers.ts and progressionRewardFlow.ts

import type { RewardRuleDef, RuntimeEffect } from "./effectTypes";
import { collectWorldRuntimeEffects } from "./worldEffects";

export type RewardRulesSnapshot = {
  ringRewardOptionCountAdd: number;
  equippedFamilyWeightMultiplier: number;
  ringRewardRerollCount: number;
};

export const EMPTY_REWARD_RULES_SNAPSHOT: RewardRulesSnapshot = {
  ringRewardOptionCountAdd: 0,
  equippedFamilyWeightMultiplier: 1,
  ringRewardRerollCount: 0,
};

function finiteNonNegativeInt(value: unknown): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : 0;
}

function finitePositiveMultiplier(value: unknown): number {
  return Number.isFinite(value) ? Math.max(1, Number(value)) : 1;
}

function applyRewardRule(snapshot: RewardRulesSnapshot, rule: RewardRuleDef): void {
  if (rule.kind === "RING_REWARD_OPTION_COUNT_ADD") {
    snapshot.ringRewardOptionCountAdd += finiteNonNegativeInt(rule.add);
    return;
  }

  if (rule.kind === "RING_REWARD_EQUIPPED_FAMILY_WEIGHT_MULTIPLIER") {
    snapshot.equippedFamilyWeightMultiplier *= finitePositiveMultiplier(rule.multiplier);
    return;
  }

  snapshot.ringRewardRerollCount += finiteNonNegativeInt(rule.count);
}

export function collectRewardRulesFromRuntimeEffects(
  runtimeEffects: readonly RuntimeEffect[],
): RewardRulesSnapshot {
  const snapshot: RewardRulesSnapshot = { ...EMPTY_REWARD_RULES_SNAPSHOT };
  for (const runtimeEffect of runtimeEffects) {
    const effect = runtimeEffect.effect;
    if (effect.kind !== "REWARD_RULES") continue;
    for (const rule of effect.rules) {
      applyRewardRule(snapshot, rule);
    }
  }
  return snapshot;
}

export function collectWorldRewardRules(world: any): RewardRulesSnapshot {
  return collectRewardRulesFromRuntimeEffects(collectWorldRuntimeEffects(world));
}
