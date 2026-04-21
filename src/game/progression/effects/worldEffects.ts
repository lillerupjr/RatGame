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
