import { recomputeDerivedStats } from "../../stats/derivedStats";
import { RING_DEFS_V1, getRingDefById } from "../rings/ringContent";
import {
  applyHandEffect,
  equipRing,
  firstEmptyFingerSlot,
  getAllFingerSlots,
  grantModifierToken,
  ensureRingProgressionState,
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

export type ProgressionRewardState = {
  active: boolean;
  family: ProgressionRewardFamily;
  source: ProgressionRewardSource;
  options: string[];
};

export type ProgressionRewardOptionView = {
  id: string;
  family: ProgressionRewardFamily;
  title: string;
  subtitle: string;
};

const DEFAULT_FAMILY: ProgressionRewardFamily = "RING";
const DEFAULT_SOURCE: ProgressionRewardSource = "FLOOR_COMPLETION";

const TOKEN_OPTIONS: ModifierTokenType[] = ["LEVEL_UP", "INCREASED_EFFECT_20", "LEVEL_UP"];

export function ensureProgressionRewardState(world: any): ProgressionRewardState {
  if (!world.progressionReward) {
    world.progressionReward = {
      active: false,
      family: DEFAULT_FAMILY,
      source: DEFAULT_SOURCE,
      options: [],
    } satisfies ProgressionRewardState;
  }
  return world.progressionReward as ProgressionRewardState;
}

function rngNext(world: any): number {
  if (typeof world?.rng?.float === "function") return world.rng.float();
  if (typeof world?.rng?.next === "function") return world.rng.next();
  throw new Error("progressionRewardFlow requires world.rng.float() or world.rng.next()");
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

function generateRingOptions(world: any, optionCount: number): string[] {
  return pickUnique(() => rngNext(world), RING_DEFS_V1, optionCount).map((def) => def.id);
}

function generateModifierTokenOptions(optionCount: number): string[] {
  return TOKEN_OPTIONS.slice(0, Math.max(0, optionCount));
}

function handOptionId(effectType: HandEffectType, target: string): string {
  return `HAND:${effectType}:${target}`;
}

function generateHandEffectOptions(world: any, optionCount: number): string[] {
  const state = ensureRingProgressionState(world);
  const options: string[] = [
    handOptionId("ADD_FINGER", "LEFT"),
    handOptionId("ADD_FINGER", "RIGHT"),
  ];
  for (const slot of getAllFingerSlots(state)) {
    options.push(handOptionId("EMPOWER_FINGER", slot.slotId));
  }
  return options.slice(0, Math.max(0, optionCount));
}

export function beginProgressionReward(
  world: any,
  family: ProgressionRewardFamily,
  source: ProgressionRewardSource,
  optionCount: number,
): void {
  const state = ensureProgressionRewardState(world);
  if (state.active) return;
  state.active = true;
  state.family = family;
  state.source = source;
  if (family === "RING") {
    state.options = generateRingOptions(world, optionCount);
  } else if (family === "RING_MODIFIER_TOKEN") {
    state.options = generateModifierTokenOptions(optionCount);
  } else {
    state.options = generateHandEffectOptions(world, optionCount);
  }
}

function chooseRing(world: any, ringDefId: string): void {
  if (!getRingDefById(ringDefId)) throw new Error(`Unknown ring reward option: ${ringDefId}`);
  const progression = ensureRingProgressionState(world);
  const slot = firstEmptyFingerSlot(progression) ?? getAllFingerSlots(progression)[0] ?? null;
  if (!slot) throw new Error("No finger slots available for ring reward");
  equipRing(world, ringDefId, slot.slotId);
  recomputeDerivedStats(world);
}

function chooseModifierToken(world: any, tokenId: string): void {
  if (tokenId !== "LEVEL_UP" && tokenId !== "INCREASED_EFFECT_20") {
    throw new Error(`Unknown ring modifier token: ${tokenId}`);
  }
  grantModifierToken(world, tokenId);
}

function chooseHandEffect(world: any, optionId: string): void {
  const [, rawEffectType, ...targetParts] = optionId.split(":");
  const rawTarget = targetParts.join(":");
  if (rawEffectType === "ADD_FINGER") {
    const handId = rawTarget as HandId;
    if (handId !== "LEFT" && handId !== "RIGHT") throw new Error(`Unknown hand target: ${rawTarget}`);
    applyHandEffect(world, "ADD_FINGER", { handId });
    return;
  }
  if (rawEffectType === "EMPOWER_FINGER") {
    applyHandEffect(world, "EMPOWER_FINGER", { slotId: rawTarget as FingerSlotId });
    recomputeDerivedStats(world);
    return;
  }
  throw new Error(`Unknown hand effect option: ${optionId}`);
}

export function chooseProgressionReward(world: any, optionId: string): void {
  const state = ensureProgressionRewardState(world);
  if (!state.active) return;
  if (!state.options.includes(optionId)) {
    throw new Error(`Invalid progression reward choice: ${optionId}`);
  }

  if (state.family === "RING") chooseRing(world, optionId);
  else if (state.family === "RING_MODIFIER_TOKEN") chooseModifierToken(world, optionId);
  else chooseHandEffect(world, optionId);

  state.active = false;
  state.options = [];
}

export function cancelProgressionReward(world: any): void {
  const state = ensureProgressionRewardState(world);
  state.active = false;
  state.options = [];
}

export function progressionRewardOptionView(
  family: ProgressionRewardFamily,
  optionId: string,
): ProgressionRewardOptionView {
  if (family === "RING") {
    const def = getRingDefById(optionId);
    return {
      id: optionId,
      family,
      title: def?.name ?? optionId,
      subtitle: def ? `${def.familyId} ring` : "Ring",
    };
  }
  if (family === "RING_MODIFIER_TOKEN") {
    return {
      id: optionId,
      family,
      title: optionId === "LEVEL_UP" ? "Level-Up Token" : "20% Increased Effect",
      subtitle: optionId === "LEVEL_UP"
        ? "Adds one passive point to a ring"
        : "Scales a ring's main effect",
    };
  }

  const [, effectType, ...targetParts] = optionId.split(":");
  const target = targetParts.join(":");
  return {
    id: optionId,
    family,
    title: effectType === "ADD_FINGER" ? `Add ${target} Finger` : `Empower ${target}`,
    subtitle: effectType === "ADD_FINGER" ? "Adds one ring slot" : "Improves a finger slot",
  };
}
