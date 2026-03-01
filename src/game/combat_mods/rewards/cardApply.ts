import { recomputeDerivedStats } from "../../stats/derivedStats";
import { getCardById } from "../content/cards/cardPool";
import { STAT_KEYS } from "../stats/statKeys";

export function applyCardToWorld(world: any, cardId: string): void {
  if (!world.cards) world.cards = [];

  // Calculate life bonus BEFORE adding the card so we can heal current HP
  const def = getCardById(cardId);
  let lifeAdd = 0;
  if (def) {
    for (const mod of def.mods) {
      if (mod.key === STAT_KEYS.LIFE_ADD && mod.op === "add") lifeAdd += mod.value;
    }
  }

  world.cards.push(cardId);
  recomputeDerivedStats(world);

  // Also heal current HP by the same amount
  if (lifeAdd > 0) {
    world.playerHp = Math.min(world.playerHpMax, world.playerHp + lifeAdd);
  }
}
