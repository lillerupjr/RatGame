// @system   ring-progression/system
// @owns     aggregate world runtime effects and stat mods from ring effects
// @doc      docs/canonical/ring_progression_system.md
// @agents   no ring state normalization or stat resolution math; see ringState.ts and combatStatsResolver.ts

import { STAT_KEYS } from "../../combat_mods/stats/statKeys";
import type { DynamicStatModifierDef, RuntimeEffect, StatMod } from "./effectTypes";
import { collectStatMods } from "./statMods";
import { collectWorldRingRuntimeEffects } from "../rings/ringEffects";

function finiteNonNegative(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : fallback;
}

function scaleDynamicStatValue(value: number, increasedEffectScalar = 0): number {
  return value * (1 + increasedEffectScalar);
}

function resolveDynamicStatValue(world: any, mod: DynamicStatModifierDef): number {
  if (mod.kind === "GLOBAL_HIT_DAMAGE_INCREASED_FROM_MAX_LIFE") {
    return finiteNonNegative(world?.playerHpMax) * mod.increasedPerMaxLife;
  }

  const maxLife = finiteNonNegative(world?.playerHpMax);
  const currentLife = finiteNonNegative(world?.playerHp);
  const missingLife = Math.max(0, maxLife - currentLife);
  const fullSteps = Math.floor(missingLife / mod.missingLifeStep);
  return fullSteps * mod.increasedPerStep;
}

export function collectDynamicStatModsFromRuntimeEffects(
  world: any,
  runtimeEffects: readonly RuntimeEffect[] = [],
): StatMod[] {
  const mods: StatMod[] = [];
  for (const runtimeEffect of runtimeEffects) {
    const effect = runtimeEffect.effect;
    if (effect.kind !== "DYNAMIC_STAT_MODIFIERS") continue;
    const scalar = runtimeEffect.increasedEffectScalar ?? 0;
    for (const mod of effect.mods) {
      mods.push({
        key: STAT_KEYS.GLOBAL_HIT_DAMAGE_INCREASED,
        op: "increased",
        value: scaleDynamicStatValue(resolveDynamicStatValue(world, mod), scalar),
      });
    }
  }
  return mods;
}

export function collectWorldRuntimeEffects(world: any): RuntimeEffect[] {
  return collectWorldRingRuntimeEffects(world);
}

export function collectWorldStatMods(
  world: any,
  args: {
    extraStatMods?: readonly StatMod[];
  } = {},
): StatMod[] {
  const runtimeEffects = collectWorldRuntimeEffects(world);
  return collectStatMods({
    statMods: args.extraStatMods,
    runtimeEffects,
    carriers: [{ mods: collectDynamicStatModsFromRuntimeEffects(world, runtimeEffects) }],
  });
}
