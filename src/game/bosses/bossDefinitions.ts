import { BossAbilityId } from "./bossAbilities";
import { BossId, type BossDefinition } from "./bossTypes";

export const BOSSES: Record<BossId, BossDefinition> = {
  [BossId.CHEM_GUY]: {
    id: BossId.CHEM_GUY,
    name: "Chem Guy",
    aiType: "contact",
    engageDistanceTiles: 8,
    stats: {
      baseLife: 2000,
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
      color: "#5aa55d",
      sprite: {
        skin: "bosses/chem_guy",
        packRoot: "entities",
        scale: 2,
        anchorX: 0.5,
        anchorY: 0.65,
        frameW: 92,
        frameH: 92,
        runAnim: "walk",
        castAnim: "fireball",
        frameCount: 6,
      },
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
      { abilityId: BossAbilityId.TOXIC_DROP_MARKER, weight: 1, priority: 1 },
      { abilityId: BossAbilityId.CHECKERBOARD_IGNITION, weight: 1, priority: 1 },
      { abilityId: BossAbilityId.POISON_FLAMETHROWER, weight: 1, priority: 1 },
    ],
    deathEffects: [],
    ui: {
      title: "Chem Guy",
      accent: "#7ae08c",
    },
    metadata: {
      family: "chem",
    },
  },
};
