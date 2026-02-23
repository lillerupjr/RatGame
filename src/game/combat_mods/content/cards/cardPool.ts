import { STARTER_CARDS_V1 } from "./starterCards";
import { MECHANICS_CARDS_V1 } from "./mechanicsCards";
import type { CardDef } from "../../stats/modifierTypes";

export const CARD_POOL_V1: CardDef[] = [...STARTER_CARDS_V1, ...MECHANICS_CARDS_V1];

export function getAllCardIds(): string[] {
  return CARD_POOL_V1.map((c) => c.id);
}

export function getAllCards(): CardDef[] {
  return CARD_POOL_V1;
}

export function getCardById(id: string): CardDef | undefined {
  return CARD_POOL_V1.find((c) => c.id === id);
}
