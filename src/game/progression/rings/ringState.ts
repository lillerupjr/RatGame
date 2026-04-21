import {
  getRingDefById,
  getRingFamilyTalentTreeById,
} from "./ringContent";
import type {
  FingerSlotId,
  FingerSlotState,
  HandEffectType,
  HandId,
  HandState,
  ModifierTokenType,
  RingInstance,
  RingProgressionState,
} from "./ringTypes";

const BASE_FINGERS_PER_HAND = 4;
const FINGER_EMPOWERMENT_SCALAR = 0.2;

function makeSlot(handId: HandId, index: number): FingerSlotState {
  return {
    slotId: `${handId}:${index}`,
    handId,
    index,
    ringInstanceId: null,
    empowermentScalar: 0,
  };
}

function makeHand(handId: HandId, fingerCount = BASE_FINGERS_PER_HAND): HandState {
  return {
    handId,
    slots: Array.from({ length: fingerCount }, (_, index) => makeSlot(handId, index)),
  };
}

export function createInitialRingProgressionState(): RingProgressionState {
  return {
    hands: {
      LEFT: makeHand("LEFT"),
      RIGHT: makeHand("RIGHT"),
    },
    ringsByInstanceId: {},
    storedModifierTokens: {
      LEVEL_UP: 0,
      INCREASED_EFFECT_20: 0,
    },
    nextRingInstanceSeq: 1,
  };
}

function normalizeTokenState(state: RingProgressionState): void {
  if (!state.storedModifierTokens) {
    state.storedModifierTokens = { LEVEL_UP: 0, INCREASED_EFFECT_20: 0 };
  }
  state.storedModifierTokens.LEVEL_UP = Math.max(0, Math.floor(state.storedModifierTokens.LEVEL_UP ?? 0));
  state.storedModifierTokens.INCREASED_EFFECT_20 = Math.max(
    0,
    Math.floor(state.storedModifierTokens.INCREASED_EFFECT_20 ?? 0),
  );
}

export function ensureRingProgressionState(world: any): RingProgressionState {
  if (!world.progression) {
    world.progression = createInitialRingProgressionState();
  }
  const state = world.progression as RingProgressionState;
  if (!state.hands) {
    state.hands = createInitialRingProgressionState().hands;
  }
  if (!state.hands.LEFT) state.hands.LEFT = makeHand("LEFT");
  if (!state.hands.RIGHT) state.hands.RIGHT = makeHand("RIGHT");
  if (!state.ringsByInstanceId) state.ringsByInstanceId = {};
  if (!Number.isFinite(state.nextRingInstanceSeq)) state.nextRingInstanceSeq = 1;
  normalizeTokenState(state);
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

function nextRingInstanceId(state: RingProgressionState): string {
  const seq = Math.max(1, Math.floor(state.nextRingInstanceSeq || 1));
  state.nextRingInstanceSeq = seq + 1;
  return `ring-instance-${seq}`;
}

export function equipRing(world: any, defId: string, preferredSlotId?: FingerSlotId): RingInstance {
  const state = ensureRingProgressionState(world);
  const def = getRingDefById(defId);
  if (!def) throw new Error(`Unknown ring def: ${defId}`);

  const slot = preferredSlotId
    ? getFingerSlot(state, preferredSlotId)
    : firstEmptyFingerSlot(state);
  if (!slot) throw new Error("No available finger slot for ring equip");

  if (slot.ringInstanceId) {
    delete state.ringsByInstanceId[slot.ringInstanceId];
  }

  const instance: RingInstance = {
    instanceId: nextRingInstanceId(state),
    defId,
    slotId: slot.slotId,
    allocatedPassivePoints: 0,
    increasedEffectScalar: 0,
    unlockedTalentNodeIds: [],
  };
  state.ringsByInstanceId[instance.instanceId] = instance;
  slot.ringInstanceId = instance.instanceId;
  return instance;
}

export function grantModifierToken(world: any, tokenType: ModifierTokenType, count = 1): void {
  const state = ensureRingProgressionState(world);
  state.storedModifierTokens[tokenType] = Math.max(
    0,
    Math.floor((state.storedModifierTokens[tokenType] ?? 0) + count),
  );
}

export function applyModifierTokenToRing(
  world: any,
  tokenType: ModifierTokenType,
  ringInstanceId: string,
): RingInstance {
  const state = ensureRingProgressionState(world);
  const instance = state.ringsByInstanceId[ringInstanceId];
  if (!instance) throw new Error(`Unknown ring instance: ${ringInstanceId}`);
  if ((state.storedModifierTokens[tokenType] ?? 0) <= 0) {
    throw new Error(`No stored ring modifier token: ${tokenType}`);
  }

  state.storedModifierTokens[tokenType] -= 1;
  if (tokenType === "LEVEL_UP") {
    instance.allocatedPassivePoints += 1;
  } else {
    instance.increasedEffectScalar += 0.2;
  }
  return instance;
}

function spentPassivePoints(instance: RingInstance): number {
  const def = getRingDefById(instance.defId);
  const tree = def ? getRingFamilyTalentTreeById(def.familyId) : undefined;
  if (!tree) return instance.unlockedTalentNodeIds.length;
  let total = 0;
  for (const nodeId of instance.unlockedTalentNodeIds) {
    total += tree.nodes.find((node) => node.id === nodeId)?.cost ?? 1;
  }
  return total;
}

export function unlockRingTalentNode(world: any, ringInstanceId: string, nodeId: string): RingInstance {
  const state = ensureRingProgressionState(world);
  const instance = state.ringsByInstanceId[ringInstanceId];
  if (!instance) throw new Error(`Unknown ring instance: ${ringInstanceId}`);
  if (instance.unlockedTalentNodeIds.includes(nodeId)) return instance;

  const def = getRingDefById(instance.defId);
  if (!def) throw new Error(`Unknown ring def: ${instance.defId}`);
  const tree = getRingFamilyTalentTreeById(def.familyId);
  if (!tree) throw new Error(`Unknown ring family tree: ${def.familyId}`);
  const node = tree.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`Unknown ring talent node: ${nodeId}`);

  for (const requiredId of node.requiresNodeIds) {
    if (!instance.unlockedTalentNodeIds.includes(requiredId)) {
      throw new Error(`Ring talent node ${nodeId} requires ${requiredId}`);
    }
  }

  const available = instance.allocatedPassivePoints - spentPassivePoints(instance);
  if (available < node.cost) {
    throw new Error(`Ring talent node ${nodeId} requires ${node.cost} passive point(s)`);
  }

  instance.unlockedTalentNodeIds.push(nodeId);
  return instance;
}

export function applyHandEffect(world: any, effectType: HandEffectType, target: { handId?: HandId; slotId?: FingerSlotId }): void {
  const state = ensureRingProgressionState(world);

  if (effectType === "ADD_FINGER") {
    const handId = target.handId ?? "LEFT";
    const hand = state.hands[handId];
    hand.slots.push(makeSlot(handId, hand.slots.length));
    return;
  }

  const slotId = target.slotId;
  if (!slotId) throw new Error("EMPOWER_FINGER requires slotId");
  const slot = getFingerSlot(state, slotId);
  if (!slot) throw new Error(`Unknown finger slot: ${slotId}`);
  slot.empowermentScalar += FINGER_EMPOWERMENT_SCALAR;
}
