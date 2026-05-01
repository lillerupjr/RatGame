import type { RuntimeEffect } from "../effects/effectTypes";
import {
  getRingDefById,
  getRingFamilyTalentTreeById,
} from "./ringContent";
import { collectRingRuntimeEffects } from "./ringEffects";
import {
  ensureRingProgressionState,
  getFingerSlot,
} from "./ringState";
import type {
  FingerSlotState,
  RingInstance,
  RingTalentNodeDef,
  RingProgressionState,
} from "./ringTypes";

export type RingProgressionInspectionEntry = {
  instance: RingInstance;
  slot: FingerSlotState | null;
  ringName: string;
  familyId: string;
  mainEffectScalar: number;
  unlockedNodes: RingTalentNodeDef[];
  runtimeEffects: RuntimeEffect[];
};

export type RingProgressionInspection = {
  hands: RingProgressionState["hands"];
  storedModifierTokens: RingProgressionState["storedModifierTokens"];
  rings: RingProgressionInspectionEntry[];
};

export function inspectRingProgressionState(
  state: RingProgressionState,
): RingProgressionInspection {
  const runtimeEffects = collectRingRuntimeEffects(state);

  return {
    hands: state.hands,
    storedModifierTokens: state.storedModifierTokens,
    rings: Object.values(state.ringsByInstanceId).map((instance) => {
      const def = getRingDefById(instance.defId);
      const tree = def ? getRingFamilyTalentTreeById(def.familyId) : undefined;
      const slot = getFingerSlot(state, instance.slotId);
      const unlockedNodes = tree
        ? instance.unlockedTalentNodeIds
            .map((nodeId) => tree.nodes.find((candidate) => candidate.id === nodeId) ?? null)
            .filter((node): node is RingTalentNodeDef => !!node)
        : [];

      return {
        instance,
        slot,
        ringName: def?.name ?? instance.defId,
        familyId: def?.familyId ?? "unknown",
        mainEffectScalar: instance.increasedEffectScalar + (slot?.empowermentScalar ?? 0),
        unlockedNodes,
        runtimeEffects: runtimeEffects.filter((effect) => effect.source.ringInstanceId === instance.instanceId),
      };
    }),
  };
}

export function inspectWorldRingProgression(world: any): RingProgressionInspection {
  return inspectRingProgressionState(ensureRingProgressionState(world));
}
