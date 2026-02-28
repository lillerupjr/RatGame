import type { WeaponDef } from "../../stats/modifierTypes";

export const JOEY_RIFLE_V1: WeaponDef = {
  id: "joey_rifle_v1",
  displayName: "Rifle",
  tags: ["weapon", "gun", "projectile", "hit", "single_shot"],

  // Milestone 1 target shape: 1 shot/sec * 24 damage = 24 dps.
  shotsPerSecond: 1.0,

  baseDamage: { physical: 24, fire: 0, chaos: 0 },
  baseCritChance: 0.10,
  baseCritMulti: 1.75,

  projectile: {
    speedPxPerSec: 600,
    rangePx: 520,
    radiusPx: 6,
    spreadBaseDeg: 3.0,
    pierce: 0,
  },

  autoAim: {
    maxRangePx: 520,
    mode: "nearest",
  },
};
