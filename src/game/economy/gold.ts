export function addGold(world: any, amount: number) {
  if (!world.run) return;
  world.run.runGold = (world.run.runGold ?? 0) + amount;
}

export function getGold(world: any) {
  return world.run?.runGold ?? 0;
}
