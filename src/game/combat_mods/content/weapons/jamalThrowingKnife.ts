import type { WeaponDef } from "../../stats/modifierTypes";
import { PRJ_KIND } from "../../../factories/projectileFactory";

export const JAMAL_THROWING_KNIFE_V1: WeaponDef = {
  id: "jamal_throwing_knife_v1",
  displayName: "Throwing Knife",
  tags: ["weapon", "gun", "fires", "projectile", "hit", "crit", "single_shot", "physical", "bleed"],

  // Baseline cadence is 1 cycle/sec; Jamal's hidden starter +1 projectile yields 2 knives/cycle.
  shotsPerSecond: 1.0,

  baseDamage: { physical: 12, fire: 0, chaos: 0 },
  baseCritChance: 0.05,
  baseCritMulti: 1.5,

  projectile: {
    kind: PRJ_KIND.KNIFE,
    speedPxPerSec: 240,
    rangePx: 380,
    radiusPx: 5,
    spreadBaseDeg: 10,
    multiProjectileSpreadDeg: 0,
    // Fire knives in a short sequential burst instead of the same frame.
    burstShotIntervalSec: 0.2,
    pierce: 0,
    baseProjectiles: 1,
  },

  autoAim: {
    maxRangePx: 380,
    mode: "nearest",
  },
};
