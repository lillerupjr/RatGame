// @system   combat-mods/stat-resolution-loadout-effects
// @owns     open, validate, apply, and clear progression reward choices
// @doc      docs/canonical/combat_mods_stat_resolution_loadout_effects.md
// @agents   no reward ticket scheduling or option UI rendering; see rewardSchedulerSystem.ts and progressionRewardMenu.ts

import { recomputeDerivedStats } from "../../stats/derivedStats";
import { collectWorldRewardRules } from "../effects/rewardRules";
import {
  ensureRingProgressionState,
  equipRing,
  resolveRingEquipTargetSlotId,
} from "../rings/ringState";
import type { ProgressionRewardOption } from "./progressionOffers";
import { generateProgressionRewardOffers } from "./progressionOffers";
import type {
  ProgressionRewardFamily,
  ProgressionRewardSource,
} from "./rewardFamilies";

export type ProgressionRewardState = {
  active: boolean;
  family: ProgressionRewardFamily;
  source: ProgressionRewardSource;
  baseOptionCount: number;
  rerollsRemaining: number;
  renderSeq: number;
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
      baseOptionCount: 0,
      rerollsRemaining: 0,
      renderSeq: 0,
      options: [],
    } satisfies ProgressionRewardState;
  }

  const state = world.progressionReward as ProgressionRewardState;
  if (!Number.isFinite(state.baseOptionCount)) state.baseOptionCount = 0;
  if (!Number.isFinite(state.rerollsRemaining)) state.rerollsRemaining = 0;
  if (!Number.isFinite(state.renderSeq)) state.renderSeq = 0;
  if (!Array.isArray(state.options)) state.options = [];
  return state;
}

function resolveRerollCount(world: any, family: ProgressionRewardFamily, source: ProgressionRewardSource): number {
  if (family !== "RING" || source !== "FLOOR_COMPLETION") return 0;
  return collectWorldRewardRules(world).ringRewardRerollCount;
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
  state.baseOptionCount = Number.isFinite(optionCount) ? Math.max(0, Math.floor(optionCount)) : 0;
  state.rerollsRemaining = resolveRerollCount(world, family, source);
  state.renderSeq += 1;
  state.options = generateProgressionRewardOffers(world, family, source, state.baseOptionCount);
  if (import.meta.env.DEV && (world as any)?.debug?.rewardPipelineLogs) {
    console.debug("[progressionReward]", {
      family,
      source,
      optionCount,
      options: state.options.map((o) => o.id),
    });
  }
}

export function applyProgressionRewardOption(world: any, option: ProgressionRewardOption): void {
  const progression = ensureRingProgressionState(world);
  const slotId = resolveRingEquipTargetSlotId(progression);
  if (!slotId) {
    throw new Error("No finger slots available for ring reward");
  }
  equipRing(world, option.ringDefId, slotId);
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
  state.baseOptionCount = 0;
  state.rerollsRemaining = 0;
  state.renderSeq += 1;
}

export function cancelProgressionReward(world: any): void {
  const state = ensureProgressionRewardState(world);
  state.active = false;
  state.options = [];
  state.baseOptionCount = 0;
  state.rerollsRemaining = 0;
  state.renderSeq += 1;
}

export function rerollProgressionReward(world: any): boolean {
  const state = ensureProgressionRewardState(world);
  if (!state.active || state.family !== "RING" || state.source !== "FLOOR_COMPLETION") return false;
  if (state.rerollsRemaining <= 0) return false;

  const nextOptions = generateProgressionRewardOffers(world, state.family, state.source, state.baseOptionCount);
  if (nextOptions.length <= 0) return false;

  state.rerollsRemaining -= 1;
  state.options = nextOptions;
  state.renderSeq += 1;
  return true;
}
