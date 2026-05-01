import type { RuntimeEffect, StatMod } from "../effects/effectTypes";
import { collectStatModsFromRuntimeEffects } from "../effects/statMods";
import { getRingDefById, getRingFamilyTalentTreeById } from "./ringContent";
import { ensureRingProgressionState, getFingerSlot } from "./ringState";
import type { FingerSlotId, RingProgressionState } from "./ringTypes";

export function collectRingRuntimeEffects(state: RingProgressionState): RuntimeEffect[] {
  const effects: RuntimeEffect[] = [];
  for (const instance of Object.values(state.ringsByInstanceId)) {
    const def = getRingDefById(instance.defId);
    if (!def) continue;
    const slot = getFingerSlot(state, instance.slotId as FingerSlotId);
    const slotScalar = slot?.empowermentScalar ?? 0;

    effects.push({
      source: {
        kind: "RING_MAIN",
        id: def.id,
        ringInstanceId: instance.instanceId,
        ringDefId: def.id,
        slotId: instance.slotId,
      },
      effect: def.mainEffect,
      increasedEffectScalar: instance.increasedEffectScalar + slotScalar,
    });

    const tree = getRingFamilyTalentTreeById(def.familyId);
    if (!tree) continue;
    for (const nodeId of instance.unlockedTalentNodeIds) {
      const node = tree.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) continue;
      effects.push({
        source: {
          kind: "RING_TALENT",
          id: node.id,
          nodeId: node.id,
          ringInstanceId: instance.instanceId,
          ringDefId: def.id,
          slotId: instance.slotId,
        },
        effect: node.effect,
      });
    }
  }
  return effects;
}

export function collectWorldRingRuntimeEffects(world: any): RuntimeEffect[] {
  const state = ensureRingProgressionState(world);
  return collectRingRuntimeEffects(state);
}

export function collectWorldRingStatMods(world: any): StatMod[] {
  return collectStatModsFromRuntimeEffects(collectWorldRingRuntimeEffects(world));
}
