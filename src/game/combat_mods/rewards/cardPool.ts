import { getAllCards } from "../content/cards/cardPool";
import type { CardDef } from "../stats/modifierTypes";

export function getEligibleCardPool(): CardDef[] {
  return getAllCards().filter((c) => c.isEnabled);
}
