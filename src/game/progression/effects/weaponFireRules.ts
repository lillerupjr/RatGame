// @system   ring-progression/system
// @owns     collect weapon-fire rules from equipped ring runtime effects
// @doc      docs/canonical/ring_progression_system.md
// @agents   no weapon firing cadence or projectile spawning; see systems/sim/combat.ts

import type { RuntimeEffect, WeaponFireRuleDef } from "./effectTypes";
import { collectWorldRuntimeEffects } from "./worldEffects";

export type WeaponFireRulesSnapshot = {
  backfireProjectile: boolean;
};

export const EMPTY_WEAPON_FIRE_RULES_SNAPSHOT: WeaponFireRulesSnapshot = {
  backfireProjectile: false,
};

function applyWeaponFireRule(snapshot: WeaponFireRulesSnapshot, rule: WeaponFireRuleDef): void {
  if (rule.kind === "BACKFIRE_PROJECTILE") {
    snapshot.backfireProjectile = true;
  }
}

export function collectWeaponFireRulesFromRuntimeEffects(
  runtimeEffects: readonly RuntimeEffect[],
): WeaponFireRulesSnapshot {
  const snapshot: WeaponFireRulesSnapshot = { ...EMPTY_WEAPON_FIRE_RULES_SNAPSHOT };
  for (const runtimeEffect of runtimeEffects) {
    const effect = runtimeEffect.effect;
    if (effect.kind !== "WEAPON_FIRE_RULES") continue;
    for (const rule of effect.rules) {
      applyWeaponFireRule(snapshot, rule);
    }
  }
  return snapshot;
}

export function collectWorldWeaponFireRules(world: any): WeaponFireRulesSnapshot {
  return collectWeaponFireRulesFromRuntimeEffects(collectWorldRuntimeEffects(world));
}
