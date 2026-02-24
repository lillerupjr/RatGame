import { STAT_KEYS } from "../../stats/statKeys";
import type { CardDef } from "../../stats/modifierTypes";

export const MECHANICS_CARDS_V1: CardDef[] = [
  {
    id: "CARD_PIERCE_1",
    isEnabled: true,
    displayName: "CARD_PIERCE_1",
    rarity: 4,
    powerTier: 3,
    mods: [{ key: STAT_KEYS.PIERCE_ADD, op: "add", value: 1 }],
  },
  {
    id: "CARD_PROJECTILE_1",
    isEnabled: true,
    displayName: "CARD_PROJECTILE_1",
    rarity: 4,
    powerTier: 3,
    mods: [{ key: STAT_KEYS.PROJECTILES_ADD, op: "add", value: 1 }],
  },
];
