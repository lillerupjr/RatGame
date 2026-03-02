import type { CardDef, WeaponTag } from "../stats/modifierTypes";
import { getCardById } from "../content/cards/cardPool";

/**
 * Weapon-tag based visibility rules.
 *
 * Design rules (locked):
 * - fire allows ignite cards
 * - chaos allows poison cards
 * - physical allows bleed cards
 *
 * Also: direct tags allow themselves (ignite weapon allows ignite cards, etc).
 */
function weaponSupports(cardTag: string, weaponTags: readonly WeaponTag[]): boolean {
  const has = (t: WeaponTag) => weaponTags.includes(t);

  switch (cardTag) {
    case "ignite":
      return has("ignite") || has("fire");
    case "poison":
      return has("poison") || has("chaos");
    case "bleed":
      return has("bleed") || has("physical");
    default:
      // Non-gated tags are always visible for now.
      return true;
  }
}

export function isCardVisibleForWeapon(card: CardDef, weaponTags: readonly WeaponTag[]): boolean {
  // If a card has multiple tags, we only gate on the gated ones (bleed/ignite/poison).
  // Example: a "convert to fire + ignite chance" card contains ignite => must pass ignite gate.
  for (let i = 0; i < card.tags.length; i++) {
    const tag = card.tags[i];
    if (!weaponSupports(tag, weaponTags)) return false;
  }
  return true;
}

/**
 * Backwards-compatible entry (existing callers pass cardId + characterId).
 * We will route through cardPool.ts (which knows the weapon tags).
 */
export function isCardVisibleForCharacter(cardId: string, _characterId?: string): boolean {
  // Keep signature but avoid character gating entirely.
  // If someone still calls this directly, default to visible unless card is missing.
  const def = getCardById(cardId);
  return !!def;
}
