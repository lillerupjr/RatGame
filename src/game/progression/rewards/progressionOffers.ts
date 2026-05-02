// @system   combat-mods/stat-resolution-loadout-effects
// @owns     generate typed ring, modifier-token, and hand-effect reward options
// @doc      docs/canonical/combat_mods_stat_resolution_loadout_effects.md
// @agents   no reward ticket scheduling, menu presentation, or ring state mutation; see rewardSchedulerSystem.ts, progressionRewardMenu.ts, and progressionRewardFlow.ts

import { getAllRingDefs, getRingDefById } from "../rings/ringContent";
import { collectWorldRewardRules } from "../effects/rewardRules";
import {
  ensureRingProgressionState,
  getAllFingerSlots,
} from "../rings/ringState";
import { collectWorldRingFamilyCounts } from "../rings/ringEffects";
import type {
  FingerSlotId,
  HandEffectType,
  HandId,
  ModifierTokenType,
  RingDef,
  RingFamilyId,
  RingTier,
} from "../rings/ringTypes";
import { RING_TIER_IDS } from "../rings/ringTypes";
import type {
  ProgressionRewardFamily,
  ProgressionRewardSource,
} from "./rewardFamilies";

export type RingRewardOption = {
  id: string;
  family: "RING";
  ringDefId: string;
  authoredTier: RingTier;
  rolledTier: RingTier;
};

export type ModifierTokenRewardOption = {
  id: string;
  family: "RING_MODIFIER_TOKEN";
  tokenType: ModifierTokenType;
};

export type HandEffectRewardOption = {
  id: string;
  family: "HAND_EFFECT";
  effectType: HandEffectType;
  handId?: HandId;
  slotId?: FingerSlotId;
};

export type ProgressionRewardOption =
  | RingRewardOption
  | ModifierTokenRewardOption
  | HandEffectRewardOption;

export type ProgressionRewardOptionView = {
  id: string;
  family: ProgressionRewardFamily;
  title: string;
  subtitle: string;
  authoredTier?: RingTier;
  rolledTier?: RingTier;
};

export const RING_REWARD_TIER_WEIGHTS: Record<RingTier, number> = {
  t0: 0.01,
  t1: 0.05,
  t2: 0.25,
  t3: 0.69,
};

const TOKEN_OPTION_SEQUENCE: ModifierTokenType[] = [
  "LEVEL_UP",
  "INCREASED_EFFECT_20",
  "LEVEL_UP",
];

type RingRewardGenerationOptions = {
  equippedFamilyCounts?: Partial<Record<RingFamilyId, number>>;
  equippedFamilyWeightMultiplier?: number;
};

function rngNext(world: any): number {
  if (typeof world?.rng?.float === "function") return world.rng.float();
  if (typeof world?.rng?.next === "function") return world.rng.next();
  throw new Error("generateProgressionOffers requires world.rng.float() or world.rng.next()");
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(0.999999999, value));
}

function pickUnique<T>(rng: () => number, input: readonly T[], count: number): T[] {
  const source = [...input];
  const out: T[] = [];
  const max = Math.min(Math.max(0, count), source.length);
  while (out.length < max) {
    const idx = Math.floor(clampUnit(rng()) * source.length);
    out.push(source[idx]);
    source.splice(idx, 1);
  }
  return out;
}

function pickOne<T>(rng: () => number, input: readonly T[]): T | undefined {
  if (input.length <= 0) return undefined;
  return input[Math.floor(clampUnit(rng()) * input.length)];
}

function pickOneWeighted<T>(
  rng: () => number,
  input: readonly T[],
  weightOf: (value: T) => number,
): T | undefined {
  if (input.length <= 0) return undefined;
  const weights = input.map((value) => Math.max(0, weightOf(value)));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) return pickOne(rng, input);

  const roll = clampUnit(rng()) * totalWeight;
  let cumulativeWeight = 0;
  for (let i = 0; i < input.length; i++) {
    cumulativeWeight += weights[i];
    if (roll < cumulativeWeight) return input[i];
  }

  return input[input.length - 1];
}

function rollRingRewardTier(rng: () => number): RingTier {
  const weightedTiers = RING_TIER_IDS.map((tier) => ({
    tier,
    weight: Math.max(0, RING_REWARD_TIER_WEIGHTS[tier]),
  }));
  const totalWeight = weightedTiers.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return "t3";

  const roll = clampUnit(rng()) * totalWeight;
  let cumulativeWeight = 0;
  for (const entry of weightedTiers) {
    cumulativeWeight += entry.weight;
    if (roll < cumulativeWeight) return entry.tier;
  }

  return weightedTiers[weightedTiers.length - 1]?.tier ?? "t3";
}

function getRewardEligibleRingDefs(): RingDef[] {
  return getAllRingDefs().filter((def) => def.familyId !== "starter");
}

function createRingOption(def: RingDef, rolledTier: RingTier): RingRewardOption {
  return {
    id: `RING:${def.id}`,
    family: "RING",
    ringDefId: def.id,
    authoredTier: def.tier,
    rolledTier,
  };
}

function createTokenOption(tokenType: ModifierTokenType, index: number): ModifierTokenRewardOption {
  return {
    id: `TOKEN:${tokenType}:${index}`,
    family: "RING_MODIFIER_TOKEN",
    tokenType,
  };
}

function createHandEffectOption(
  effectType: HandEffectType,
  target: { handId?: HandId; slotId?: FingerSlotId },
): HandEffectRewardOption {
  const targetKey = target.slotId ?? target.handId ?? "UNKNOWN";
  return {
    id: `HAND:${effectType}:${targetKey}`,
    family: "HAND_EFFECT",
    effectType,
    handId: target.handId,
    slotId: target.slotId,
  };
}

function ringCandidateWeight(def: RingDef, options: RingRewardGenerationOptions): number {
  const multiplier = Math.max(1, options.equippedFamilyWeightMultiplier ?? 1);
  if (multiplier <= 1) return 1;
  return (options.equippedFamilyCounts?.[def.familyId] ?? 0) > 0 ? multiplier : 1;
}

function generateRingOptions(
  world: any,
  optionCount: number,
  generationOptions: RingRewardGenerationOptions = {},
): ProgressionRewardOption[] {
  const remaining = getRewardEligibleRingDefs();
  const options: RingRewardOption[] = [];
  const max = Math.min(Math.max(0, optionCount), remaining.length);

  while (options.length < max) {
    const rolledTier = rollRingRewardTier(() => rngNext(world));
    const tierCandidates = remaining.filter((def) => def.tier === rolledTier);
    const candidates = tierCandidates.length > 0 ? tierCandidates : remaining;
    const selected = generationOptions.equippedFamilyWeightMultiplier && generationOptions.equippedFamilyWeightMultiplier > 1
      ? pickOneWeighted(() => rngNext(world), candidates, (def) => ringCandidateWeight(def, generationOptions))
      : pickOne(() => rngNext(world), candidates);
    if (!selected) break;

    const selectedIndex = remaining.findIndex((def) => def.id === selected.id);
    if (selectedIndex >= 0) remaining.splice(selectedIndex, 1);
    options.push(createRingOption(selected, rolledTier));
  }

  return options;
}

function generateModifierTokenOptions(optionCount: number): ProgressionRewardOption[] {
  return TOKEN_OPTION_SEQUENCE
    .slice(0, Math.max(0, optionCount))
    .map((tokenType, index) => createTokenOption(tokenType, index));
}

function generateHandEffectOptions(world: any, optionCount: number): ProgressionRewardOption[] {
  const state = ensureRingProgressionState(world);
  const baselineOptions: ProgressionRewardOption[] = [
    createHandEffectOption("ADD_FINGER", { handId: "LEFT" }),
    createHandEffectOption("ADD_FINGER", { handId: "RIGHT" }),
  ];
  if (optionCount <= baselineOptions.length) {
    return baselineOptions.slice(0, Math.max(0, optionCount));
  }

  const empowerOptions = getAllFingerSlots(state)
    .map((slot) => createHandEffectOption("EMPOWER_FINGER", { slotId: slot.slotId }));

  return [
    ...baselineOptions,
    ...pickUnique(() => rngNext(world), empowerOptions, optionCount - baselineOptions.length),
  ];
}

export function generateProgressionOffers(
  world: any,
  family: ProgressionRewardFamily,
  _source: ProgressionRewardSource,
  count: number,
): ProgressionRewardOption[] {
  if (family === "RING") return generateRingOptions(world, count);
  if (family === "RING_MODIFIER_TOKEN") return generateModifierTokenOptions(count);
  return generateHandEffectOptions(world, count);
}

export function generateProgressionRewardOffers(
  world: any,
  family: ProgressionRewardFamily,
  source: ProgressionRewardSource,
  count: number,
): ProgressionRewardOption[] {
  if (family !== "RING") return generateProgressionOffers(world, family, source, count);

  const rewardRules = collectWorldRewardRules(world);
  const optionCount = count + rewardRules.ringRewardOptionCountAdd;
  return generateRingOptions(world, optionCount, {
    equippedFamilyCounts: collectWorldRingFamilyCounts(world),
    equippedFamilyWeightMultiplier: rewardRules.equippedFamilyWeightMultiplier,
  });
}

export function progressionRewardOptionView(
  option: ProgressionRewardOption,
): ProgressionRewardOptionView {
  if (option.family === "RING") {
    const def = getRingDefById(option.ringDefId);
    return {
      id: option.id,
      family: option.family,
      title: def?.name ?? option.ringDefId,
      subtitle: def ? `${option.authoredTier} ${def.familyId} ring` : "Ring",
      authoredTier: option.authoredTier,
      rolledTier: option.rolledTier,
    };
  }

  if (option.family === "RING_MODIFIER_TOKEN") {
    return {
      id: option.id,
      family: option.family,
      title: option.tokenType === "LEVEL_UP" ? "Level-Up Token" : "20% Increased Effect",
      subtitle: option.tokenType === "LEVEL_UP"
        ? "Adds one passive point to a ring"
        : "Scales a ring's main effect",
    };
  }

  return {
    id: option.id,
    family: option.family,
    title: option.effectType === "ADD_FINGER"
      ? `Add ${option.handId ?? "Unknown"} Finger`
      : `Empower ${option.slotId ?? "Unknown"}`,
    subtitle: option.effectType === "ADD_FINGER"
      ? "Adds one ring slot"
      : "Improves a finger slot",
  };
}
