import { getAllCards } from "../content/cards/cardPool";
import type { CardDef } from "../stats/modifierTypes";
import { isCardVisibleForCharacter } from "./cardVisibilityPolicy";

export function getEligibleCardPool(characterId?: string): CardDef[] {
  return getAllCards().filter((c) => c.isEnabled && isCardVisibleForCharacter(c.id, characterId));
}
