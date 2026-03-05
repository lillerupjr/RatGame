import type { WeaponDef } from "../../stats/modifierTypes";
import { PRJ_KIND } from "../../../factories/projectileFactory";

export const HOBO_SYRINGE_V1: WeaponDef = {
  id: "hobo_syringe_v1",
  displayName: "Syringe",
  tags: ["weapon", "gun", "fires", "projectile", "hit", "crit", "single_shot", "chaos", "poison"],

  // Rifle parity cadence.
  shotsPerSecond: 1.0,

  baseDamage: { physical: 0, fire: 0, chaos: 18 },
  baseCritChance: 0.05,
  baseCritMulti: 1.5,
  baseChanceToPoison: 0.5,

  projectile: {
    kind: PRJ_KIND.SYRINGE,
    // Very slow projectile identity.
    speedPxPerSec: 180,
    // Rifle parity for unspecified fields.
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
