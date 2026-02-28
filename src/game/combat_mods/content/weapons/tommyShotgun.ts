import type { WeaponDef } from "../../stats/modifierTypes";

export const TOMMY_SHOTGUN_V1: WeaponDef = {
  id: "tommy_shotgun_v1",
  displayName: "Shotgun",
  tags: ["weapon", "gun", "projectile", "hit", "single_shot"],

  // Target shape: 16 damage * 0.5 shots/sec * 3 pellets = 24 dps.
  shotsPerSecond: 0.5,

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
    baseProjectiles: 3,
  },

  autoAim: {
    maxRangePx: 300,
    mode: "nearest",
  },
};
