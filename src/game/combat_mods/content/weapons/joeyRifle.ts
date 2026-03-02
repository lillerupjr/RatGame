import type { WeaponDef } from "../../stats/modifierTypes";

export const JOEY_RIFLE_V1: WeaponDef = {
  id: "joey_rifle_v1",
  displayName: "Laser",
  tags: ["weapon", "gun", "projectile", "hit", "single_shot", "fire", "ignite"],

  // Milestone 1 target shape: 1 shot/sec * 24 damage = 24 dps.
  shotsPerSecond: 1.0,

  baseDamage: { physical: 0, fire: 24, chaos: 0 },
  baseCritChance: 0.10,
  baseCritMulti: 1.75,
  baseChanceToIgnite: 0.25,
  fireMode: "beam",
  beam: {
    maxRangePx: 520,
    dps: 24,
    tickIntervalSec: 0.1,
    widthPx: 8,
    glowIntensity: 0.95,
    uvScrollSpeed: 1.75,
  },

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
