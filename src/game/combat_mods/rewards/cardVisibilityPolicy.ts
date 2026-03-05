import type { CardDef, CardTag, WeaponTag } from "../stats/modifierTypes";
import { getCardById } from "../content/cards/cardPool";
import { resolveCombatStarterWeaponId } from "../content/weapons/characterStarterMap";
import { getCombatStarterWeaponById } from "../content/weapons/starterWeapons";

const GLOBAL_CARD_TAGS: readonly CardTag[] = ["life", "defense"];

export function isCardVisibleForWeapon(card: CardDef, weaponTags: readonly WeaponTag[]): boolean {
  if (!card.isEnabled) return false;

  const cardTags = card.tags;
  if (cardTags.some((tag) => GLOBAL_CARD_TAGS.includes(tag))) return true;
  if (cardTags.length === 0) return false;

  return cardTags.some((tag) => weaponTags.includes(tag as WeaponTag));
}

export function isCardVisibleForCharacter(cardId: string, characterId?: string): boolean {
  const def = getCardById(cardId);
  if (!def) return false;
  const starterWeaponId = resolveCombatStarterWeaponId(characterId);
  const starterWeapon = getCombatStarterWeaponById(starterWeaponId);
  return isCardVisibleForWeapon(def, starterWeapon.tags);
}
