export const STAT_KEYS = {
  // Damage flat adds
  DAMAGE_ADD_PHYSICAL: "damage.add.physical",
  DAMAGE_ADD_FIRE: "damage.add.fire",
  DAMAGE_ADD_CHAOS: "damage.add.chaos",

  // Damage scalars (generic)
  DAMAGE_INCREASED: "damage.increased",
  DAMAGE_MORE: "damage.more",

  // Fire rate (canonical: shotsPerSecond)
  SHOTS_PER_SECOND_INCREASED: "shotsPerSecond.increased",
  SHOTS_PER_SECOND_MORE: "shotsPerSecond.more",

  // Crit
  CRIT_CHANCE_ADD: "critChance.add",
  CRIT_MULTI_ADD: "critMulti.add",

  // Accuracy/spread (degrees)
  SPREAD_BASE_DEG_ADD: "spreadBaseDeg.add",

  // Projectile
  PROJECTILES_ADD: "projectiles.add",
  PROJECTILE_SPEED_INCREASED: "projectileSpeed.increased",
  PIERCE_ADD: "pierce.add",

  // Ailment chances
  CHANCE_TO_BLEED_ADD: "chanceToBleed.add",
  CHANCE_TO_IGNITE_ADD: "chanceToIgnite.add",
  CHANCE_TO_POISON_ADD: "chanceToPoison.add",

  // Conversion (priority-fill order is enforced elsewhere)
  CONVERT_PHYS_TO_FIRE: "convert.physicalToFire",
  CONVERT_PHYS_TO_CHAOS: "convert.physicalToChaos",
  CONVERT_FIRE_TO_CHAOS: "convert.fireToChaos",

  // Defense
  LIFE_ADD: "life.add",
  DAMAGE_REDUCTION_ADD: "damageReduction.add",
} as const;

export type StatKey = (typeof STAT_KEYS)[keyof typeof STAT_KEYS];
