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

  // Damage over time (phase 1)
  DOT_POISON_DAMAGE_INCREASED: "dot.poisonDamage.increased",
  DOT_IGNITE_DAMAGE_INCREASED: "dot.igniteDamage.increased",
  DOT_DURATION_INCREASED: "dot.duration.increased",
  DOT_TICK_RATE_MORE: "dot.tickRate.more",

  // Conversion (priority-fill order is enforced elsewhere)
  CONVERT_PHYS_TO_FIRE: "convert.physicalToFire",
  CONVERT_PHYS_TO_CHAOS: "convert.physicalToChaos",
  CONVERT_FIRE_TO_CHAOS: "convert.fireToChaos",

  // Global player stat pipelines (v1.0 contract)
  GLOBAL_HIT_DAMAGE_ADD: "globalHitDamage.add",
  GLOBAL_HIT_DAMAGE_INCREASED: "globalHitDamage.increased",
  GLOBAL_HIT_DAMAGE_MORE: "globalHitDamage.more",
  GLOBAL_HIT_DAMAGE_LESS: "globalHitDamage.less",

  GLOBAL_ATTACK_SPEED_ADD: "globalAttackSpeed.add",
  GLOBAL_ATTACK_SPEED_INCREASED: "globalAttackSpeed.increased",
  GLOBAL_ATTACK_SPEED_MORE: "globalAttackSpeed.more",
  GLOBAL_ATTACK_SPEED_LESS: "globalAttackSpeed.less",

  MOVE_SPEED_ADD: "moveSpeed.add",
  MOVE_SPEED_INCREASED: "moveSpeed.increased",
  MOVE_SPEED_MORE: "moveSpeed.more",
  MOVE_SPEED_LESS: "moveSpeed.less",

  // Defense
  LIFE_ADD: "life.add",
  LIFE_INCREASED: "life.increased",
  LIFE_DECREASED: "life.decreased",
  LIFE_MORE: "life.more",
  LIFE_LESS: "life.less",
  DAMAGE_REDUCTION_ADD: "damageReduction.add",
} as const;

export type StatKey = (typeof STAT_KEYS)[keyof typeof STAT_KEYS];
