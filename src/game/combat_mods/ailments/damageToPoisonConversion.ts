import type { World } from "../../../engine/world/world";
import { ensureEnemyAilmentsAt } from "./applyAilmentsFromHit";
import { addPoison } from "./enemyAilments";

const DAMAGE_TO_POISON_RELIC = "PASS_DAMAGE_TO_POISON_ALL";
const DAMAGE_TO_POISON_FACTOR = 0.2;

export function getPoisonFromDamageConversion(relics: readonly string[], damage: number): number {
  const safeDamage = Number.isFinite(damage) ? Math.max(0, damage) : 0;
  if (!(safeDamage > 0)) return 0;
  if (!relics.includes(DAMAGE_TO_POISON_RELIC)) return 0;
  return safeDamage * DAMAGE_TO_POISON_FACTOR;
}

export function applyPoisonFromDamageConversion(world: World, enemyIndex: number, damage: number): number {
  const poisonFromDamage = getPoisonFromDamageConversion(world.relics, damage);
  if (!(poisonFromDamage > 0)) return 0;
  if (!world.eAilments) world.eAilments = [];
  const state = ensureEnemyAilmentsAt(world.eAilments, enemyIndex);
  addPoison(state, poisonFromDamage);
  return poisonFromDamage;
}
