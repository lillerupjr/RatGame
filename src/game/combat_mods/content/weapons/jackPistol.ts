import type { WeaponDef } from "../../stats/modifierTypes";

export const JACK_PISTOL_V1: WeaponDef = {
  id: "jack_pistol_v1",
  displayName: "Pistol",
  tags: ["weapon", "gun", "projectile", "hit", "single_shot"],

  // Placeholder baseline (tune later)
  shotsPerSecond: 3.0,

  baseDamage: { physical: 8, fire: 0, chaos: 0 },
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
