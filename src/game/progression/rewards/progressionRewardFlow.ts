import { recomputeDerivedStats } from "../../stats/derivedStats";
import {
  applyHandEffect,
  ensureRingProgressionState,
  equipRing,
  grantModifierToken,
  resolveRingEquipTargetSlotId,
} from "../rings/ringState";
import type { ProgressionRewardOption } from "./progressionOffers";
import { generateProgressionOffers } from "./progressionOffers";
import type {
  ProgressionRewardFamily,
  ProgressionRewardSource,
} from "./rewardFamilies";

export type ProgressionRewardState = {
  active: boolean;
  family: ProgressionRewardFamily;
  source: ProgressionRewardSource;
  options: ProgressionRewardOption[];
};

const DEFAULT_FAMILY: ProgressionRewardFamily = "RING";
const DEFAULT_SOURCE: ProgressionRewardSource = "FLOOR_COMPLETION";

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
  state.options = generateProgressionOffers(world, family, source, optionCount);
}

export function applyProgressionRewardOption(world: any, option: ProgressionRewardOption): void {
  if (option.family === "RING") {
    const progression = ensureRingProgressionState(world);
    const slotId = resolveRingEquipTargetSlotId(progression);
    if (!slotId) {
      throw new Error("No finger slots available for ring reward");
    }
    equipRing(world, option.ringDefId, slotId);
    recomputeDerivedStats(world);
    return;
  }

  if (option.family === "RING_MODIFIER_TOKEN") {
    grantModifierToken(world, option.tokenType);
    return;
  }

  applyHandEffect(world, option.effectType, {
    handId: option.handId,
    slotId: option.slotId,
  });
  recomputeDerivedStats(world);
}

export function chooseProgressionReward(world: any, optionId: string): void {
  const state = ensureProgressionRewardState(world);
  if (!state.active) return;

  const option = state.options.find((candidate) => candidate.id === optionId);
  if (!option || option.family !== state.family) {
    throw new Error(`Invalid progression reward choice: ${optionId}`);
  }

  applyProgressionRewardOption(world, option);
  state.active = false;
  state.options = [];
}

export function cancelProgressionReward(world: any): void {
  const state = ensureProgressionRewardState(world);
  state.active = false;
  state.options = [];
}
