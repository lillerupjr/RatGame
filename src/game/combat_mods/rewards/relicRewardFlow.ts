import { normalizeRelicIdList, toCanonicalRelicId } from "../../content/relics";
import { generateRelicRewardOptions } from "./relicRewardGenerator";

export type RelicRewardSource = "OBJECTIVE_COMPLETION";

export type RelicRewardState = {
  active: boolean;
  source: RelicRewardSource;
  options: string[];
};

const DEFAULT_SOURCE: RelicRewardSource = "OBJECTIVE_COMPLETION";

export function ensureRelicRewardState(world: any): RelicRewardState {
  if (!world.relicReward) {
    world.relicReward = {
      active: false,
      source: DEFAULT_SOURCE,
      options: [],
    } satisfies RelicRewardState;
  }
  return world.relicReward as RelicRewardState;
}

function rngNext(world: any): number {
  if (typeof world?.rng?.float === "function") return world.rng.float();
  if (typeof world?.rng?.next === "function") return world.rng.next();
  throw new Error("relicRewardFlow requires world.rng.float() or world.rng.next()");
}

export function beginRelicReward(world: any, source: RelicRewardSource, optionCount: number): void {
  const state = ensureRelicRewardState(world);
  if (state.active) return;
  state.active = true;
  state.source = source;
  state.options = generateRelicRewardOptions(() => rngNext(world), optionCount);
}

export function chooseRelicReward(world: any, relicId: string): void {
  const state = ensureRelicRewardState(world);
  if (!state.active) return;
  const canonical = toCanonicalRelicId(relicId);
  if (!state.options.includes(canonical)) {
    throw new Error(`Invalid relic reward choice: ${relicId}`);
  }
  world.relics = normalizeRelicIdList([...(world.relics ?? []), canonical]);
  state.active = false;
  state.options = [];
}

export function cancelRelicReward(world: any): void {
  const state = ensureRelicRewardState(world);
  state.active = false;
  state.options = [];
}
