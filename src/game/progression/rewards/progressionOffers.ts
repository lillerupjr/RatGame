import { getAllRingDefs, getRingDefById } from "../rings/ringContent";
import {
  ensureRingProgressionState,
  getAllFingerSlots,
} from "../rings/ringState";
import type {
  FingerSlotId,
  HandEffectType,
  HandId,
  ModifierTokenType,
} from "../rings/ringTypes";
import type {
  ProgressionRewardFamily,
  ProgressionRewardSource,
} from "./rewardFamilies";

export type RingRewardOption = {
  id: string;
  family: "RING";
  ringDefId: string;
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
};

const TOKEN_OPTION_SEQUENCE: ModifierTokenType[] = [
  "LEVEL_UP",
  "INCREASED_EFFECT_20",
  "LEVEL_UP",
];

function rngNext(world: any): number {
  if (typeof world?.rng?.float === "function") return world.rng.float();
  if (typeof world?.rng?.next === "function") return world.rng.next();
  throw new Error("generateProgressionOffers requires world.rng.float() or world.rng.next()");
}

function pickUnique<T>(rng: () => number, input: readonly T[], count: number): T[] {
  const source = [...input];
  const out: T[] = [];
  const max = Math.min(Math.max(0, count), source.length);
  while (out.length < max) {
    const idx = Math.floor(Math.max(0, Math.min(0.999999999, rng())) * source.length);
    out.push(source[idx]);
    source.splice(idx, 1);
  }
  return out;
}

function createRingOption(defId: string): RingRewardOption {
  return {
    id: `RING:${defId}`,
    family: "RING",
    ringDefId: defId,
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

function generateRingOptions(world: any, optionCount: number): ProgressionRewardOption[] {
  return pickUnique(() => rngNext(world), getAllRingDefs(), optionCount).map((def) => createRingOption(def.id));
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

export function progressionRewardOptionView(
  option: ProgressionRewardOption,
): ProgressionRewardOptionView {
  if (option.family === "RING") {
    const def = getRingDefById(option.ringDefId);
    return {
      id: option.id,
      family: option.family,
      title: def?.name ?? option.ringDefId,
      subtitle: def ? `${def.familyId} ring` : "Ring",
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
