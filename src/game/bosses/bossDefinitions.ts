import { BossAbilityId } from "./bossAbilities";
import { BossId, type BossDefinition } from "./bossTypes";

export const BOSSES: Record<BossId, BossDefinition> = {
  [BossId.RAT_KING]: {
    id: BossId.RAT_KING,
    name: "Rat King",
    aiType: "contact",
    stats: {
      baseLife: 520,
      contactDamage: 20,
    },
    body: {
      radius: 38,
      hitHeightProjectile: 4,
      hitHeightContact: 3,
    },
    rewards: {
      isBoss: true,
    },
    presentation: {
      color: "#c08b47",
      shadowFootOffset: { x: 0, y: 0 },
      aimScreenOffset: { x: 0, y: -16 },
    },
    movement: {
      mode: "approach_player",
      speed: 82,
      desiredRange: 0,
      tolerance: 8,
      reengageRange: 18,
    },
    abilityLoadout: [
      { abilityId: BossAbilityId.RAT_KING_FAN, weight: 3, priority: 2 },
      { abilityId: BossAbilityId.RAT_KING_PUDDLE, weight: 2, priority: 1 },
    ],
    deathEffects: [],
    ui: {
      title: "Rat King",
      accent: "#d9a35f",
    },
    metadata: {
      family: "rat",
    },
  },
};
