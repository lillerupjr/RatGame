// @system   ring-progression/system
// @owns     build read-only ring progression inspection snapshots
// @doc      docs/canonical/ring_progression_system.md
// @agents   no ring mutation or Pixi hands rendering; see ringState.ts and handsScreen.ts

import type { RuntimeEffect } from "../effects/effectTypes";
import { getRingDefById } from "./ringContent";
import { collectRingRuntimeEffects } from "./ringEffects";
import {
  ensureRingProgressionState,
  getFingerSlot,
} from "./ringState";
import type {
  FingerSlotState,
  RingInstance,
  RingProgressionState,
} from "./ringTypes";

export type RingProgressionInspectionEntry = {
  instance: RingInstance;
  slot: FingerSlotState | null;
  ringName: string;
  familyId: string;
  mainEffectScalar: number;
  runtimeEffects: RuntimeEffect[];
};

export type RingProgressionInspection = {
  hands: RingProgressionState["hands"];
  rings: RingProgressionInspectionEntry[];
};

export function inspectRingProgressionState(
  state: RingProgressionState,
): RingProgressionInspection {
  const runtimeEffects = collectRingRuntimeEffects(state);

  return {
    hands: state.hands,
    rings: Object.values(state.ringsByInstanceId).map((instance) => {
      const def = getRingDefById(instance.defId);
      const slot = getFingerSlot(state, instance.slotId);

      return {
        instance,
        slot,
        ringName: def?.name ?? instance.defId,
        familyId: def?.familyId ?? "unknown",
        mainEffectScalar: runtimeEffects.find((effect) => effect.source.ringInstanceId === instance.instanceId && effect.source.kind === "RING_MAIN")?.increasedEffectScalar ?? 0,
        runtimeEffects: runtimeEffects.filter((effect) => effect.source.ringInstanceId === instance.instanceId),
      };
    }),
  };
}

export function inspectWorldRingProgression(world: any): RingProgressionInspection {
  return inspectRingProgressionState(ensureRingProgressionState(world));
}
