import type { World } from "../../../engine/world/world";

export function applyRelic(world: World, relicId: string): void {
  if (world.relics.includes(relicId)) return;

  world.relics = [...world.relics, relicId];

  switch (relicId) {
    case "RELIC_TRAINING":
      world.relicEffects.xpMult *= 1.05;
      break;
    case "RELIC_STURDY":
      world.relicEffects.hpBonus += 5;
      world.playerHpMax += 5;
      world.playerHp += 5;
      break;
  }
}
