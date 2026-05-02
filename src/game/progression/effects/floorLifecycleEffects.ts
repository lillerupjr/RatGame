// @system   ring-progression/system
// @owns     apply floor lifecycle runtime effects from equipped rings
// @doc      docs/canonical/ring_progression_system.md
// @agents   no floor completion detection or ring content authoring; see game.ts and ringContent.ts

import type { FloorLifecycleEffectDef, FloorLifecycleTrigger, RuntimeEffect } from "./effectTypes";
import { collectWorldRuntimeEffects } from "./worldEffects";

export type RuntimeFloorLifecycleEffect = {
  effect: FloorLifecycleEffectDef;
  increasedEffectScalar: number;
};

function finiteNonNegative(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : fallback;
}

function scaleAmount(amount: number, increasedEffectScalar: number): number {
  return amount * (1 + increasedEffectScalar);
}

function healPlayer(world: any, amount: number): void {
  const maxLife = finiteNonNegative(world?.playerHpMax);
  if (maxLife <= 0 || amount <= 0) return;
  const currentLife = finiteNonNegative(world?.playerHp);
  world.playerHp = Math.min(maxLife, currentLife + amount);
}

export function collectFloorLifecycleEffectsFromRuntimeEffects(
  runtimeEffects: readonly RuntimeEffect[],
  trigger: FloorLifecycleTrigger,
): RuntimeFloorLifecycleEffect[] {
  const effects: RuntimeFloorLifecycleEffect[] = [];
  for (const runtimeEffect of runtimeEffects) {
    const effect = runtimeEffect.effect;
    if (effect.kind !== "FLOOR_LIFECYCLE" || effect.trigger !== trigger) continue;
    effects.push({
      effect,
      increasedEffectScalar: runtimeEffect.increasedEffectScalar ?? 0,
    });
  }
  return effects;
}

export function applyFloorLifecycleEffects(world: any, trigger: FloorLifecycleTrigger): void {
  const effects = collectFloorLifecycleEffectsFromRuntimeEffects(collectWorldRuntimeEffects(world), trigger);
  for (const runtimeEffect of effects) {
    const action = runtimeEffect.effect.action;
    if (action.kind === "HEAL_PLAYER") {
      healPlayer(world, scaleAmount(action.amount, runtimeEffect.increasedEffectScalar));
    }
  }
}
