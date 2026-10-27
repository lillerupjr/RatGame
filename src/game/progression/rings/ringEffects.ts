// @system   ring-progression/system
// @owns     collect runtime effects and stat mods from equipped rings
// @doc      docs/canonical/ring_progression_system.md
// @agents   no state mutation or scalar stat resolution; see ringState.ts and combatStatsResolver.ts

import type { EffectDef, RuntimeEffect, StatMod } from "../effects/effectTypes";
import { collectStatModsFromRuntimeEffects } from "../effects/statMods";
import { getRingDefById } from "./ringContent";
import { ensureRingProgressionState, getFingerSlot } from "./ringState";
import type { FingerSlotId, RingFamilyId, RingProgressionState } from "./ringTypes";

type OrderedSlotEntry = {
  slotId: FingerSlotId;
  instanceId: string;
  defId: string;
};

function getOrderedOccupiedSlots(state: RingProgressionState): OrderedSlotEntry[] {
  const result: OrderedSlotEntry[] = [];
  for (const slot of [...state.hands.LEFT.slots, ...state.hands.RIGHT.slots]) {
    if (!slot.ringInstanceId) continue;
    const instance = state.ringsByInstanceId[slot.ringInstanceId];
    if (!instance) continue;
    result.push({ slotId: slot.slotId, instanceId: instance.instanceId, defId: instance.defId });
  }
  return result;
}

function isStructuralEffectKind(kind: string): boolean {
  return kind === "MIRROR_LEFT_RING" || kind === "AMPLIFY_NEIGHBORS";
}

export function collectRingRuntimeEffects(state: RingProgressionState): RuntimeEffect[] {
  const effects: RuntimeEffect[] = [];
  for (const instance of Object.values(state.ringsByInstanceId)) {
    const def = getRingDefById(instance.defId);
    if (!def) continue;
    effects.push({
      source: {
        kind: "RING_MAIN",
        id: def.id,
        ringInstanceId: instance.instanceId,
        ringDefId: def.id,
        slotId: instance.slotId,
      },
      effect: def.mainEffect,
      increasedEffectScalar: 0,
    });
  }

  // --- Neighbor-ring resolution ---
  const orderedSlots = getOrderedOccupiedSlots(state);
  if (orderedSlots.length === 0) return effects;

  // Build a slotId→position map for fast lookups
  const slotPositionMap = new Map<string, number>();
  for (let i = 0; i < orderedSlots.length; i++) {
    slotPositionMap.set(orderedSlots[i].slotId, i);
  }

  // Amplify pass: boost neighbors' increasedEffectScalar
  for (let i = 0; i < effects.length; i++) {
    const re = effects[i];
    if (re.source.kind !== "RING_MAIN") continue;
    if (re.effect.kind !== "AMPLIFY_NEIGHBORS") continue;

    const slotId = re.source.slotId;
    if (!slotId) continue;
    const pos = slotPositionMap.get(slotId);
    if (pos === undefined) continue;

    const bonus = re.effect.increasedEffectBonus;
    const neighborPositions = [pos - 1, pos + 1];

    for (const nPos of neighborPositions) {
      if (nPos < 0 || nPos >= orderedSlots.length) continue;
      const neighbor = orderedSlots[nPos];
      const neighborDef = getRingDefById(neighbor.defId);
      if (!neighborDef || isStructuralEffectKind(neighborDef.mainEffect.kind)) continue;

      // Find the neighbor's RING_MAIN effect and boost it
      for (let j = 0; j < effects.length; j++) {
        const ne = effects[j];
        if (ne.source.kind !== "RING_MAIN") continue;
        if (ne.source.slotId !== neighbor.slotId) continue;
        effects[j] = {
          ...ne,
          increasedEffectScalar: (ne.increasedEffectScalar ?? 0) + bonus,
        };
        break;
      }
    }
  }

  // Mirror pass: replace MIRROR_LEFT_RING with the left neighbor's mainEffect
  for (let i = 0; i < effects.length; i++) {
    const re = effects[i];
    if (re.source.kind !== "RING_MAIN") continue;
    if (re.effect.kind !== "MIRROR_LEFT_RING") continue;

    const slotId = re.source.slotId;
    if (!slotId) continue;
    const pos = slotPositionMap.get(slotId);
    if (pos === undefined || pos === 0) {
      // No left neighbor, remove this effect
      effects[i] = null as any;
      continue;
    }

    const leftNeighbor = orderedSlots[pos - 1];
    const leftDef = getRingDefById(leftNeighbor.defId);
    if (!leftDef || isStructuralEffectKind(leftDef.mainEffect.kind)) {
      effects[i] = null as any;
      continue;
    }

    // Copy the left neighbor's mainEffect
    effects[i] = {
      ...re,
      effect: leftDef.mainEffect,
    };
  }

  // Remove structural effects (AMPLIFY_NEIGHBORS) and nulled mirror entries
  return effects.filter(
    (re) => re != null && re.effect.kind !== "AMPLIFY_NEIGHBORS",
  );
}

export function collectWorldRingRuntimeEffects(world: any): RuntimeEffect[] {
  const state = ensureRingProgressionState(world);
  return collectRingRuntimeEffects(state);
}

export function collectWorldRingStatMods(world: any): StatMod[] {
  return collectStatModsFromRuntimeEffects(collectWorldRingRuntimeEffects(world));
}

export function collectRingFamilyCounts(state: RingProgressionState): Partial<Record<RingFamilyId, number>> {
  const counts: Partial<Record<RingFamilyId, number>> = {};

  for (const instance of Object.values(state.ringsByInstanceId)) {
    const def = getRingDefById(instance.defId);
    if (!def) continue;
    const slot = getFingerSlot(state, instance.slotId as FingerSlotId);
    if (slot?.ringInstanceId !== instance.instanceId) continue;
    counts[def.familyId] = (counts[def.familyId] ?? 0) + 1;
  }

  return counts;
}

export function collectWorldRingFamilyCounts(world: any): Partial<Record<RingFamilyId, number>> {
  return collectRingFamilyCounts(ensureRingProgressionState(world));
}
