import type { PlayableCharacterId } from "../../../content/playableCharacters";
import { STAT_KEYS } from "../../stats/statKeys";
import type { CardDef } from "../../stats/modifierTypes";

const JAMAL_STARTER_PROJECTILE_CARD: CardDef = {
  id: "CHAR_STARTER_JAMAL_PROJECTILES_ADD_1",
  isEnabled: true,
  displayName: "Jamal Starter: +1 projectile",
  rarity: 1,
  powerTier: 1,
  mods: [{ key: STAT_KEYS.PROJECTILES_ADD, op: "add", value: 1 }],
};

const CHARACTER_STARTER_CARDS: Partial<Record<PlayableCharacterId, readonly CardDef[]>> = {
  JAMAL: [JAMAL_STARTER_PROJECTILE_CARD],
};

export function resolveCombatStarterStatCards(characterId?: string): readonly CardDef[] {
  if (!characterId) return [];
  return CHARACTER_STARTER_CARDS[characterId as PlayableCharacterId] ?? [];
}
