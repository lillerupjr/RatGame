// @system   ring-progression/system
// @owns     normalize and mutate ring progression state and finger slots
// @doc      docs/canonical/ring_progression_system.md
// @agents   no ring content authoring, inspection snapshots, or UI rendering; see ringContent.ts, ringInspection.ts, and handsScreen.ts

import { getRingDefById } from "./ringContent";
import {
  type FingerSlotId,
  type FingerSlotState,
  type HandId,
  type HandState,
  type RingInstance,
  type RingProgressionState,
} from "./ringTypes";

const BASE_FINGERS_PER_HAND = 4;

export type ProgressionActionCheck<T = void> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

function clampNonNegativeInt(value: unknown, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value as number));
}

function makeSlot(handId: HandId, index: number): FingerSlotState {
  return {
    slotId: `${handId}:${index}`,
    handId,
    index,
    ringInstanceId: null,
  };
}

function makeHand(handId: HandId): HandState {
  return {
    handId,
    slots: Array.from({ length: BASE_FINGERS_PER_HAND }, (_, index) => makeSlot(handId, index)),
  };
}

function parseRingInstanceSeq(instanceId: string): number {
  const match = /^ring-instance-(\d+)$/.exec(instanceId);
  return match ? Math.max(0, Number(match[1])) : 0;
}

function normalizeRingInstances(
  input: unknown,
  state: RingProgressionState,
): Record<string, RingInstance> {
  const source = input && typeof input === "object"
    ? Object.entries(input as Record<string, unknown>)
    : [];

  const validSlotIds = new Set(getAllFingerSlots(state).map((slot) => slot.slotId));
  const ringsByInstanceId: Record<string, RingInstance> = {};
  const occupiedSlots = new Set<FingerSlotId>();

  for (const [instanceId, rawInstance] of source) {
    if (!rawInstance || typeof rawInstance !== "object") continue;
    const defId = typeof (rawInstance as { defId?: unknown }).defId === "string"
      ? ((rawInstance as { defId: string }).defId)
      : "";
    if (!getRingDefById(defId)) continue;

    const slotId = typeof (rawInstance as { slotId?: unknown }).slotId === "string"
      ? ((rawInstance as { slotId: FingerSlotId }).slotId)
      : null;
    if (!slotId || !validSlotIds.has(slotId) || occupiedSlots.has(slotId)) continue;

    ringsByInstanceId[instanceId] = { instanceId, defId, slotId };
    occupiedSlots.add(slotId);
  }

  for (const slot of getAllFingerSlots(state)) {
    slot.ringInstanceId = null;
  }
  for (const instance of Object.values(ringsByInstanceId)) {
    const slot = getFingerSlot(state, instance.slotId);
    if (!slot) continue;
    slot.ringInstanceId = instance.instanceId;
  }

  return ringsByInstanceId;
}

function normalizeNextRingInstanceSeq(state: RingProgressionState, inputSeq: unknown): void {
  const maxExistingSeq = Object.keys(state.ringsByInstanceId)
    .reduce((best, instanceId) => Math.max(best, parseRingInstanceSeq(instanceId)), 0);
  state.nextRingInstanceSeq = Math.max(
    clampNonNegativeInt(inputSeq, 1),
    maxExistingSeq + 1,
    1,
  );
}

export function createInitialRingProgressionState(): RingProgressionState {
  return {
    hands: {
      LEFT: makeHand("LEFT"),
      RIGHT: makeHand("RIGHT"),
    },
    ringsByInstanceId: {},
    nextRingInstanceSeq: 1,
  };
}

export function ensureRingProgressionState(world: any): RingProgressionState {
  const rawState = world?.progression;
  if (!rawState || typeof rawState !== "object") {
    world.progression = createInitialRingProgressionState();
    return world.progression as RingProgressionState;
  }

  const state = rawState as RingProgressionState;
  state.hands = {
    LEFT: makeHand("LEFT"),
    RIGHT: makeHand("RIGHT"),
  };
  state.ringsByInstanceId = normalizeRingInstances((rawState as { ringsByInstanceId?: unknown }).ringsByInstanceId, state);
  normalizeNextRingInstanceSeq(state, (rawState as { nextRingInstanceSeq?: unknown }).nextRingInstanceSeq);
  return state;
}

export function getAllFingerSlots(state: RingProgressionState): FingerSlotState[] {
  return [...state.hands.LEFT.slots, ...state.hands.RIGHT.slots];
}

export function getFingerSlot(state: RingProgressionState, slotId: FingerSlotId): FingerSlotState | null {
  return getAllFingerSlots(state).find((slot) => slot.slotId === slotId) ?? null;
}

export function firstEmptyFingerSlot(state: RingProgressionState): FingerSlotState | null {
  return getAllFingerSlots(state).find((slot) => !slot.ringInstanceId) ?? null;
}

export function resolveRingEquipTargetSlotId(
  state: RingProgressionState,
  preferredSlotId?: FingerSlotId,
): FingerSlotId | null {
  if (preferredSlotId) {
    return getFingerSlot(state, preferredSlotId)?.slotId ?? null;
  }
  return firstEmptyFingerSlot(state)?.slotId
    ?? getAllFingerSlots(state)[0]?.slotId
    ?? null;
}

function nextRingInstanceId(state: RingProgressionState): string {
  const seq = Math.max(1, Math.floor(state.nextRingInstanceSeq || 1));
  state.nextRingInstanceSeq = seq + 1;
  return `ring-instance-${seq}`;
}

function expectCheck<T>(check: ProgressionActionCheck<T>): T {
  if (!check.ok) throw new Error(check.reason);
  return check.value;
}

export function canEquipRing(
  world: any,
  defId: string,
  preferredSlotId?: FingerSlotId,
): ProgressionActionCheck<{ state: RingProgressionState; slotId: FingerSlotId }> {
  const state = ensureRingProgressionState(world);
  if (!getRingDefById(defId)) {
    return { ok: false, reason: `Unknown ring def: ${defId}` };
  }
  if (preferredSlotId && !getFingerSlot(state, preferredSlotId)) {
    return { ok: false, reason: `Unknown finger slot: ${preferredSlotId}` };
  }
  const slotId = resolveRingEquipTargetSlotId(state, preferredSlotId);
  if (!slotId) {
    return { ok: false, reason: "No available finger slot for ring equip" };
  }
  return { ok: true, value: { state, slotId } };
}

export function unequipRing(world: any, slotId: FingerSlotId): void {
  const state = ensureRingProgressionState(world);
  const slot = getFingerSlot(state, slotId);
  if (!slot || !slot.ringInstanceId) return;
  delete state.ringsByInstanceId[slot.ringInstanceId];
  slot.ringInstanceId = null;
}

export function equipRing(world: any, defId: string, preferredSlotId?: FingerSlotId): RingInstance {
  const { state, slotId } = expectCheck(canEquipRing(world, defId, preferredSlotId));
  const slot = expectCheck(
    getFingerSlot(state, slotId)
      ? { ok: true, value: getFingerSlot(state, slotId)! }
      : { ok: false, reason: `Unknown finger slot: ${slotId}` },
  );

  if (slot.ringInstanceId) {
    delete state.ringsByInstanceId[slot.ringInstanceId];
  }

  const instance: RingInstance = {
    instanceId: nextRingInstanceId(state),
    defId,
    slotId: slot.slotId,
  };
  state.ringsByInstanceId[instance.instanceId] = instance;
  slot.ringInstanceId = instance.instanceId;
  return instance;
}
