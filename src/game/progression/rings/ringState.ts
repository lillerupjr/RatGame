import {
  getRingDefById,
  getRingFamilyTalentTreeById,
} from "./ringContent";
import {
  HAND_IDS,
  MODIFIER_TOKEN_TYPES,
  type FingerSlotId,
  type FingerSlotState,
  type HandEffectType,
  type HandId,
  type HandState,
  type ModifierTokenType,
  type RingInstance,
  type RingProgressionState,
} from "./ringTypes";

const BASE_FINGERS_PER_HAND = 4;
const FINGER_EMPOWERMENT_SCALAR = 0.2;

export type ProgressionActionCheck<T = void> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

function clampNonNegativeInt(value: unknown, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value as number));
}

function clampNonNegativeScalar(value: unknown, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Number(value));
}

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

function normalizeHandState(input: unknown, handId: HandId): HandState {
  const sourceSlots = Array.isArray((input as { slots?: unknown[] } | null)?.slots)
    ? ((input as { slots: unknown[] }).slots)
    : [];
  const targetCount = Math.max(BASE_FINGERS_PER_HAND, sourceSlots.length);
  const hand = makeHand(handId, targetCount);

  for (let i = 0; i < hand.slots.length; i++) {
    const rawSlot = sourceSlots[i] as { empowermentScalar?: unknown } | undefined;
    hand.slots[i].empowermentScalar = clampNonNegativeScalar(rawSlot?.empowermentScalar, 0);
  }

  return hand;
}

function normalizeTokenState(state: RingProgressionState): void {
  const source = state.storedModifierTokens ?? {
    LEVEL_UP: 0,
    INCREASED_EFFECT_20: 0,
  };
  state.storedModifierTokens = {
    LEVEL_UP: clampNonNegativeInt(source.LEVEL_UP, 0),
    INCREASED_EFFECT_20: clampNonNegativeInt(source.INCREASED_EFFECT_20, 0),
  };
}

function parseRingInstanceSeq(instanceId: string): number {
  const match = /^ring-instance-(\d+)$/.exec(instanceId);
  return match ? Math.max(0, Number(match[1])) : 0;
}

function normalizeUnlockedNodeIds(instance: {
  defId: string;
  unlockedTalentNodeIds?: unknown;
}): string[] {
  const def = getRingDefById(instance.defId);
  const tree = def ? getRingFamilyTalentTreeById(def.familyId) : undefined;
  if (!tree || !Array.isArray(instance.unlockedTalentNodeIds)) return [];

  const desiredIds = new Set(
    instance.unlockedTalentNodeIds.filter(
      (nodeId): nodeId is string =>
        typeof nodeId === "string" && tree.nodes.some((node) => node.id === nodeId),
    ),
  );

  const unlocked: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of tree.nodes) {
      if (!desiredIds.has(node.id)) continue;
      if (!node.requiresNodeIds.every((requiredId) => unlocked.includes(requiredId))) continue;
      desiredIds.delete(node.id);
      unlocked.push(node.id);
      changed = true;
    }
  }

  return unlocked;
}

function spentPassivePoints(instance: Pick<RingInstance, "defId" | "unlockedTalentNodeIds">): number {
  const def = getRingDefById(instance.defId);
  const tree = def ? getRingFamilyTalentTreeById(def.familyId) : undefined;
  if (!tree) return instance.unlockedTalentNodeIds.length;
  let total = 0;
  for (const nodeId of instance.unlockedTalentNodeIds) {
    total += tree.nodes.find((node) => node.id === nodeId)?.cost ?? 1;
  }
  return total;
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

    const unlockedTalentNodeIds = normalizeUnlockedNodeIds({
      defId,
      unlockedTalentNodeIds: (rawInstance as { unlockedTalentNodeIds?: unknown }).unlockedTalentNodeIds,
    });
    const allocatedPassivePoints = Math.max(
      clampNonNegativeInt((rawInstance as { allocatedPassivePoints?: unknown }).allocatedPassivePoints, 0),
      spentPassivePoints({ defId, unlockedTalentNodeIds }),
    );

    ringsByInstanceId[instanceId] = {
      instanceId,
      defId,
      slotId,
      allocatedPassivePoints,
      increasedEffectScalar: clampNonNegativeScalar(
        (rawInstance as { increasedEffectScalar?: unknown }).increasedEffectScalar,
        0,
      ),
      unlockedTalentNodeIds,
    };
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
    storedModifierTokens: {
      LEVEL_UP: 0,
      INCREASED_EFFECT_20: 0,
    },
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
    LEFT: normalizeHandState((rawState as { hands?: { LEFT?: unknown } }).hands?.LEFT, "LEFT"),
    RIGHT: normalizeHandState((rawState as { hands?: { RIGHT?: unknown } }).hands?.RIGHT, "RIGHT"),
  };
  state.ringsByInstanceId = normalizeRingInstances((rawState as { ringsByInstanceId?: unknown }).ringsByInstanceId, state);
  normalizeTokenState(state);
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
  if (!MODIFIER_TOKEN_TYPES.includes(tokenType)) {
    throw new Error(`Unknown ring modifier token: ${String(tokenType)}`);
  }
  state.storedModifierTokens[tokenType] = Math.max(
    0,
    Math.floor((state.storedModifierTokens[tokenType] ?? 0) + count),
  );
}

export function canApplyModifierTokenToRing(
  world: any,
  tokenType: ModifierTokenType,
  ringInstanceId: string,
): ProgressionActionCheck<{ state: RingProgressionState; instance: RingInstance }> {
  const state = ensureRingProgressionState(world);
  const instance = state.ringsByInstanceId[ringInstanceId];
  if (!instance) {
    return { ok: false, reason: `Unknown ring instance: ${ringInstanceId}` };
  }
  if ((state.storedModifierTokens[tokenType] ?? 0) <= 0) {
    return { ok: false, reason: `No stored ring modifier token: ${tokenType}` };
  }
  return { ok: true, value: { state, instance } };
}

export function applyModifierTokenToRing(
  world: any,
  tokenType: ModifierTokenType,
  ringInstanceId: string,
): RingInstance {
  const { state, instance } = expectCheck(canApplyModifierTokenToRing(world, tokenType, ringInstanceId));
  state.storedModifierTokens[tokenType] -= 1;
  if (tokenType === "LEVEL_UP") {
    instance.allocatedPassivePoints += 1;
  } else {
    instance.increasedEffectScalar += 0.2;
  }
  return instance;
}

export function canUnlockRingTalentNode(
  world: any,
  ringInstanceId: string,
  nodeId: string,
): ProgressionActionCheck<RingInstance> {
  const state = ensureRingProgressionState(world);
  const instance = state.ringsByInstanceId[ringInstanceId];
  if (!instance) {
    return { ok: false, reason: `Unknown ring instance: ${ringInstanceId}` };
  }
  if (instance.unlockedTalentNodeIds.includes(nodeId)) {
    return { ok: true, value: instance };
  }

  const def = getRingDefById(instance.defId);
  if (!def) {
    return { ok: false, reason: `Unknown ring def: ${instance.defId}` };
  }
  const tree = getRingFamilyTalentTreeById(def.familyId);
  if (!tree) {
    return { ok: false, reason: `Unknown ring family tree: ${def.familyId}` };
  }
  const node = tree.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    return { ok: false, reason: `Unknown ring talent node: ${nodeId}` };
  }

  for (const requiredId of node.requiresNodeIds) {
    if (!instance.unlockedTalentNodeIds.includes(requiredId)) {
      return { ok: false, reason: `Ring talent node ${nodeId} requires ${requiredId}` };
    }
  }

  const available = instance.allocatedPassivePoints - spentPassivePoints(instance);
  if (available < node.cost) {
    return { ok: false, reason: `Ring talent node ${nodeId} requires ${node.cost} passive point(s)` };
  }

  return { ok: true, value: instance };
}

export function unlockRingTalentNode(world: any, ringInstanceId: string, nodeId: string): RingInstance {
  const instance = expectCheck(canUnlockRingTalentNode(world, ringInstanceId, nodeId));
  if (!instance.unlockedTalentNodeIds.includes(nodeId)) {
    instance.unlockedTalentNodeIds.push(nodeId);
  }
  return instance;
}

export function canApplyHandEffect(
  world: any,
  effectType: HandEffectType,
  target: { handId?: HandId; slotId?: FingerSlotId },
): ProgressionActionCheck<{ state: RingProgressionState; handId?: HandId; slotId?: FingerSlotId }> {
  const state = ensureRingProgressionState(world);

  if (effectType === "ADD_FINGER") {
    if (!target.handId || !HAND_IDS.includes(target.handId)) {
      return { ok: false, reason: "ADD_FINGER requires a valid handId" };
    }
    return { ok: true, value: { state, handId: target.handId } };
  }

  if (!target.slotId) {
    return { ok: false, reason: "EMPOWER_FINGER requires slotId" };
  }
  if (!getFingerSlot(state, target.slotId)) {
    return { ok: false, reason: `Unknown finger slot: ${target.slotId}` };
  }
  return { ok: true, value: { state, slotId: target.slotId } };
}

export function applyHandEffect(
  world: any,
  effectType: HandEffectType,
  target: { handId?: HandId; slotId?: FingerSlotId },
): void {
  const check = expectCheck(canApplyHandEffect(world, effectType, target));

  if (effectType === "ADD_FINGER") {
    const handId = check.handId ?? "LEFT";
    const hand = check.state.hands[handId];
    hand.slots.push(makeSlot(handId, hand.slots.length));
    return;
  }

  const slotId = check.slotId;
  if (!slotId) throw new Error("EMPOWER_FINGER requires slotId");
  const slot = getFingerSlot(check.state, slotId);
  if (!slot) throw new Error(`Unknown finger slot: ${slotId}`);
  slot.empowermentScalar += FINGER_EMPOWERMENT_SCALAR;
}
