import type { WeaponDef } from "../../stats/modifierTypes";

export const TOMMY_SHOTGUN_V1: WeaponDef = {
  id: "tommy_shotgun_v1",
  displayName: "Shotgun",
  tags: ["weapon", "gun", "projectile", "hit", "single_shot"],

  // Target shape: 16 damage * 0.666... shots/sec * 4 pellets ~= 42.7 dps.
  shotsPerSecond: 2 / 3,

  baseDamage: { physical: 16, fire: 0, chaos: 0 },
  baseCritChance: 0.05,
  baseCritMulti: 1.5,

  projectile: {
    speedPxPerSec: 460,
    rangePx: 300,
    radiusPx: 6,
    spreadBaseDeg: 3.0,
    // Explicit fan spread for multi-projectile separation.
    multiProjectileSpreadDeg: 24.0,
    pierce: 0,
    baseProjectiles: 4,
  },

  autoAim: {
    maxRangePx: 300,
    mode: "nearest",
  },
};
