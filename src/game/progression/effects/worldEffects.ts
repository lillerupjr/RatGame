// @system   ring-progression/system
// @owns     aggregate world runtime effects and stat mods from ring effects
// @doc      docs/canonical/ring_progression_system.md
// @agents   no ring state normalization or stat resolution math; see ringState.ts and combatStatsResolver.ts

import type { RuntimeEffect, StatMod } from "./effectTypes";
import { collectStatMods } from "./statMods";
import { collectWorldRingRuntimeEffects } from "../rings/ringEffects";

export function collectWorldRuntimeEffects(world: any): RuntimeEffect[] {
  return collectWorldRingRuntimeEffects(world);
}

export function collectWorldStatMods(
  world: any,
  args: {
    extraStatMods?: readonly StatMod[];
  } = {},
): StatMod[] {
  return collectStatMods({
    statMods: args.extraStatMods,
    runtimeEffects: collectWorldRuntimeEffects(world),
  });
}
