import { STAT_KEYS } from "../../stats/statKeys";
import type { CardDef } from "../../stats/modifierTypes";

/**
 * Starter card set (V1).
 *
 * Rules:
 * - No "more/less" mods in starter cards.
 * - No triggers / conditionals.
 * - Generic names for now.
 * - Rarity is drop-weight only in V1.
 */
export const STARTER_CARDS_V1: CardDef[] = [
  {
    id: "CARD_DAMAGE_FLAT_1",
    displayName: "CARD_DAMAGE_FLAT_1",
    rarity: 1,
    powerTier: 1,
    mods: [{ key: STAT_KEYS.DAMAGE_ADD_PHYSICAL, op: "add", value: 3 }],
  },
  {
    id: "CARD_DAMAGE_INC_1",
    displayName: "CARD_DAMAGE_INC_1",
    rarity: 1,
    powerTier: 1,
    mods: [{ key: STAT_KEYS.DAMAGE_INCREASED, op: "increased", value: 0.20 }],
  },
  {
    id: "CARD_FIRE_RATE_1",
    displayName: "CARD_FIRE_RATE_1",
    rarity: 1,
    powerTier: 1,
    mods: [{ key: STAT_KEYS.SHOTS_PER_SECOND_INCREASED, op: "increased", value: 0.15 }],
  },
  {
    id: "CARD_CRIT_CHANCE_1",
    displayName: "CARD_CRIT_CHANCE_1",
    rarity: 1,
    powerTier: 1,
    mods: [{ key: STAT_KEYS.CRIT_CHANCE_ADD, op: "add", value: 0.04 }],
  },
  {
    id: "CARD_CRIT_MULTI_1",
    displayName: "CARD_CRIT_MULTI_1",
    rarity: 1,
    powerTier: 2,
    mods: [{ key: STAT_KEYS.CRIT_MULTI_ADD, op: "add", value: 0.25 }],
  },
  {
    id: "CARD_ACCURACY_1",
    displayName: "CARD_ACCURACY_1",
    rarity: 1,
    powerTier: 1,
    mods: [{ key: STAT_KEYS.SPREAD_BASE_DEG_ADD, op: "add", value: -0.8 }],
  },
  {
    id: "CARD_CONVERT_FIRE_1",
    displayName: "CARD_CONVERT_FIRE_1",
    rarity: 2,
    powerTier: 3,
    mods: [{ key: STAT_KEYS.CONVERT_PHYS_TO_FIRE, op: "add", value: 0.40 }],
  },
  {
    id: "CARD_CONVERT_CHAOS_1",
    displayName: "CARD_CONVERT_CHAOS_1",
    rarity: 2,
    powerTier: 3,
    mods: [{ key: STAT_KEYS.CONVERT_PHYS_TO_CHAOS, op: "add", value: 0.40 }],
  },
  {
    id: "CARD_DAMAGE_FIRE_FLAT_1",
    displayName: "CARD_DAMAGE_FIRE_FLAT_1",
    rarity: 2,
    powerTier: 2,
    mods: [{ key: STAT_KEYS.DAMAGE_ADD_FIRE, op: "add", value: 4 }],
  },
  {
    id: "CARD_DAMAGE_CHAOS_FLAT_1",
    displayName: "CARD_DAMAGE_CHAOS_FLAT_1",
    rarity: 2,
    powerTier: 2,
    mods: [{ key: STAT_KEYS.DAMAGE_ADD_CHAOS, op: "add", value: 4 }],
  },
  {
    id: "CARD_BLEED_CHANCE_1",
    displayName: "CARD_BLEED_CHANCE_1",
    rarity: 2,
    powerTier: 1,
    mods: [{ key: STAT_KEYS.CHANCE_TO_BLEED_ADD, op: "add", value: 0.25 }],
  },
  {
    id: "CARD_IGNITE_CHANCE_1",
    displayName: "CARD_IGNITE_CHANCE_1",
    rarity: 2,
    powerTier: 1,
    mods: [{ key: STAT_KEYS.CHANCE_TO_IGNITE_ADD, op: "add", value: 0.25 }],
  },
  {
    id: "CARD_POISON_CHANCE_1",
    displayName: "CARD_POISON_CHANCE_1",
    rarity: 2,
    powerTier: 1,
    mods: [{ key: STAT_KEYS.CHANCE_TO_POISON_ADD, op: "add", value: 0.25 }],
  },
  {
    id: "CARD_CRIT_DAMAGE_1",
    displayName: "CARD_CRIT_DAMAGE_1",
    rarity: 3,
    powerTier: 2,
    mods: [
      { key: STAT_KEYS.CRIT_CHANCE_ADD, op: "add", value: 0.03 },
      { key: STAT_KEYS.DAMAGE_INCREASED, op: "increased", value: 0.10 },
    ],
  },
  {
    id: "CARD_FIRE_RATE_ACCURACY_TRADE_1",
    displayName: "CARD_FIRE_RATE_ACCURACY_TRADE_1",
    rarity: 3,
    powerTier: 2,
    mods: [
      { key: STAT_KEYS.SHOTS_PER_SECOND_INCREASED, op: "increased", value: 0.12 },
      { key: STAT_KEYS.SPREAD_BASE_DEG_ADD, op: "add", value: 0.5 },
    ],
  },
  {
    id: "CARD_ACCURACY_CRIT_1",
    displayName: "CARD_ACCURACY_CRIT_1",
    rarity: 3,
    powerTier: 2,
    mods: [
      { key: STAT_KEYS.SPREAD_BASE_DEG_ADD, op: "add", value: -0.7 },
      { key: STAT_KEYS.CRIT_CHANCE_ADD, op: "add", value: 0.02 },
    ],
  },
  {
    id: "CARD_CONVERT_FIRE_2",
    displayName: "CARD_CONVERT_FIRE_2",
    rarity: 4,
    powerTier: 3,
    mods: [
      { key: STAT_KEYS.CONVERT_PHYS_TO_FIRE, op: "add", value: 0.30 },
      { key: STAT_KEYS.CHANCE_TO_IGNITE_ADD, op: "add", value: 0.15 },
    ],
  },
  {
    id: "CARD_CONVERT_CHAOS_2",
    displayName: "CARD_CONVERT_CHAOS_2",
    rarity: 4,
    powerTier: 3,
    mods: [
      { key: STAT_KEYS.CONVERT_PHYS_TO_CHAOS, op: "add", value: 0.30 },
      { key: STAT_KEYS.CHANCE_TO_POISON_ADD, op: "add", value: 0.15 },
    ],
  },
  {
    id: "CARD_LIFE_1",
    displayName: "CARD_LIFE_1",
    rarity: 1,
    powerTier: 1,
    mods: [{ key: STAT_KEYS.LIFE_ADD, op: "add", value: 25 }],
  },
  {
    id: "CARD_DAMAGE_REDUCTION_1",
    displayName: "CARD_DAMAGE_REDUCTION_1",
    rarity: 2,
    powerTier: 2,
    mods: [{ key: STAT_KEYS.DAMAGE_REDUCTION_ADD, op: "add", value: 0.05 }],
  },
];

export function getStarterCardById(id: string): CardDef | undefined {
  return STARTER_CARDS_V1.find((c) => c.id === id);
}
