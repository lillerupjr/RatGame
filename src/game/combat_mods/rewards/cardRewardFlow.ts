import { applyCardToWorld } from "./cardApply";
import { generateCardRewardOptions } from "./cardRewardGenerator";

export type CardRewardSource = "ZONE_TRIAL" | "BOSS_CHEST";

export type CardRewardState = {
  active: boolean;
  source: CardRewardSource;
  options: string[];
};

const DEFAULT_SOURCE: CardRewardSource = "ZONE_TRIAL";

export function ensureCardRewardState(world: any): CardRewardState {
  if (!world.cardReward) {
    world.cardReward = {
      active: false,
      source: DEFAULT_SOURCE,
      options: [],
    } satisfies CardRewardState;
  }
  return world.cardReward as CardRewardState;
}

function rngNext(world: any): number {
  if (typeof world?.rng?.float === "function") return world.rng.float();
  if (typeof world?.rng?.next === "function") return world.rng.next();
  throw new Error("cardRewardFlow requires world.rng.float() or world.rng.next()");
}

export function beginCardReward(world: any, source: CardRewardSource, optionCount: number): void {
  const state = ensureCardRewardState(world);
  if (state.active) return;

  state.active = true;
  state.source = source;
  state.options = generateCardRewardOptions(() => rngNext(world), optionCount);
}

export function chooseCardReward(world: any, cardId: string): void {
  const state = ensureCardRewardState(world);
  if (!state.active) return;
  if (!state.options.includes(cardId)) {
    throw new Error(`Invalid card reward choice: ${cardId}`);
  }

  applyCardToWorld(world, cardId);
  state.active = false;
  state.options = [];
}

export function cancelCardReward(world: any): void {
  const state = ensureCardRewardState(world);
  state.active = false;
  state.options = [];
}
