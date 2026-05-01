import type { RuntimeEffect, StatMod } from "./effectTypes";

export type StatModCarrier = {
  mods?: readonly StatMod[];
};

export function scaleStatMod(mod: StatMod, increasedEffectScalar = 0): StatMod {
  if (increasedEffectScalar === 0) return mod;
  return {
    ...mod,
    value: mod.value * (1 + increasedEffectScalar),
  };
}

export function collectStatModsFromCarriers(carriers: readonly StatModCarrier[] = []): StatMod[] {
  const mods: StatMod[] = [];
  for (const carrier of carriers) {
    if (!carrier?.mods) continue;
    mods.push(...carrier.mods);
  }
  return mods;
}

export function collectStatModsFromRuntimeEffects(effects: readonly RuntimeEffect[] = []): StatMod[] {
  const mods: StatMod[] = [];
  for (const runtimeEffect of effects) {
    const effect = runtimeEffect.effect;
    if (effect.kind !== "STAT_MODIFIERS") continue;
    const scalar = runtimeEffect.increasedEffectScalar ?? 0;
    for (const mod of effect.mods) {
      mods.push(scaleStatMod(mod, scalar));
    }
  }
  return mods;
}

export function collectStatMods(args: {
  carriers?: readonly StatModCarrier[];
  statMods?: readonly StatMod[];
  runtimeEffects?: readonly RuntimeEffect[];
}): StatMod[] {
  return [
    ...collectStatModsFromCarriers(args.carriers),
    ...(args.statMods ?? []),
    ...collectStatModsFromRuntimeEffects(args.runtimeEffects),
  ];
}
