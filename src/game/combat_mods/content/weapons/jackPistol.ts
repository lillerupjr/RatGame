import type { WeaponDef } from "../../stats/modifierTypes";

export const JACK_PISTOL_V1: WeaponDef = {
  id: "jack_pistol_v1",
  displayName: "Pistol",
  tags: ["weapon", "gun", "fires", "projectile", "hit", "crit", "single_shot", "physical", "bleed"],

  // Crit burst baseline.
  shotsPerSecond: 2.0,

  baseDamage: { physical: 12, fire: 0, chaos: 0 },
  baseCritChance: 0.05,
  baseCritMulti: 1.5,

  projectile: {
    speedPxPerSec: 520,
    rangePx: 420,
    radiusPx: 6,
    spreadBaseDeg: 3.0,
    pierce: 0,
  },

  autoAim: {
    maxRangePx: 420,
    mode: "nearest",
  },
};
