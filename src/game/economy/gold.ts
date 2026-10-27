// @system   progression/objectives/rewards
// @owns     run gold state: normalization, grants and reads
// @doc      docs/canonical/progression_objectives_rewards.md
// @agents   no pickup spawning or vendor pricing; see systems/progression/drops.ts and vendor/pricing.ts

export type RunProgressionState = {
  runGold: number;
};

export function ensureRunProgressionState(world: any): RunProgressionState {
  if (!world.run || typeof world.run !== "object") world.run = {};
  const run = world.run as Partial<RunProgressionState>;
  if (!Number.isFinite(run.runGold)) run.runGold = 0;
  return world.run as RunProgressionState;
}

export function addGold(world: any, amount: number) {
  const run = ensureRunProgressionState(world);
  run.runGold = (run.runGold ?? 0) + amount;
}

export function getGold(world: any) {
  return world.run?.runGold ?? 0;
}
