import type { World } from "../../../engine/world/world";

function finiteOrZero(v: number | undefined): number {
  return Number.isFinite(v) ? (v as number) : 0;
}

export function clampPlayerArmor(world: World): void {
  world.maxArmor = Math.max(0, finiteOrZero(world.maxArmor));
  world.currentArmor = Math.max(0, Math.min(world.maxArmor, finiteOrZero(world.currentArmor)));
}

export function restoreArmor(world: World, amount: number): void {
  clampPlayerArmor(world);
  if (!(amount > 0)) return;
  world.currentArmor = Math.min(world.maxArmor, world.currentArmor + amount);
}

export function applyPlayerIncomingDamage(world: World, damageAmount: number): number {
  clampPlayerArmor(world);
  let remaining = Math.max(0, finiteOrZero(damageAmount));
  if (remaining <= 0) return 0;
  if (world.currentArmor > 0) {
    const absorbed = Math.min(world.currentArmor, remaining);
    world.currentArmor -= absorbed;
    remaining -= absorbed;
  }
  return remaining;
}
