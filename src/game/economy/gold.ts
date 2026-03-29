import { ensureRunProgressionState } from "./xp";

export function addGold(world: any, amount: number) {
  const run = ensureRunProgressionState(world);
  run.runGold = (run.runGold ?? 0) + amount;
}

export function getGold(world: any) {
  return world.run?.runGold ?? 0;
}
