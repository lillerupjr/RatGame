import { getAllCards } from "../content/cards/cardPool";
import type { CardDef } from "../stats/modifierTypes";
import { isCardVisibleForWeapon } from "./cardVisibilityPolicy";
import { resolveCombatStarterWeaponId } from "../content/weapons/characterStarterMap";
import { getCombatStarterWeaponById } from "../content/weapons/starterWeapons";

export function getEligibleCardPool(characterId?: string): CardDef[] {
  const starterWeaponId = resolveCombatStarterWeaponId(characterId);
  const starterWeapon = getCombatStarterWeaponById(starterWeaponId);
  const weaponTags = starterWeapon.tags;

  return getAllCards().filter((c) => c.isEnabled && isCardVisibleForWeapon(c, weaponTags));
}
