import type { DamageBundle } from "../stats/modifierTypes";

export interface ConversionRates {
  physToFire: number; // 0..1
  physToChaos: number; // 0..1
  fireToChaos: number; // 0..1
}

/**
 * Apply conversion using priority-fill pool consumption in fixed order:
 *   1) phys -> fire
 *   2) phys -> chaos
 *   3) fire -> chaos
 *
 * Later conversions consume only what remains in their source pool.
 */
export function applyConversionPriorityFill(base: DamageBundle, r: ConversionRates): DamageBundle {
  let phys = base.physical;
  let fire = base.fire;
  let chaos = base.chaos;

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  const physToFire = clamp01(r.physToFire);
  const physToChaos = clamp01(r.physToChaos);
  const fireToChaos = clamp01(r.fireToChaos);

  // 1) phys -> fire
  if (physToFire > 0 && phys > 0) {
    const amt = phys * physToFire;
    phys -= amt;
    fire += amt;
  }

  // 2) phys -> chaos (consumes remaining phys)
  if (physToChaos > 0 && phys > 0) {
    const amt = phys * physToChaos;
    phys -= amt;
    chaos += amt;
  }

  // 3) fire -> chaos (consumes remaining fire)
  if (fireToChaos > 0 && fire > 0) {
    const amt = fire * fireToChaos;
    fire -= amt;
    chaos += amt;
  }

  return { physical: phys, fire, chaos };
}
