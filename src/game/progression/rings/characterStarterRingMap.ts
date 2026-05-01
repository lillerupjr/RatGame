import type { PlayableCharacterId } from "../../content/playableCharacters";
import { equipRing, ensureRingProgressionState, getFingerSlot } from "./ringState";
import type { FingerSlotId, RingInstance } from "./ringTypes";

export type StarterRingDefId =
  | "RING_STARTER_STREET_REFLEX"
  | "RING_STARTER_LUCKY_CHAMBER"
  | "RING_STARTER_CONTAMINATED_ROUNDS"
  | "RING_STARTER_POINT_BLANK_CARNAGE"
  | "RING_STARTER_THERMAL_STARTER";

const DEFAULT_STARTER_RING_DEF_ID: StarterRingDefId = "RING_STARTER_LUCKY_CHAMBER";

const CHARACTER_STARTER_RING: Record<PlayableCharacterId, StarterRingDefId> = {
  HOBO: "RING_STARTER_CONTAMINATED_ROUNDS",
  JACK: "RING_STARTER_LUCKY_CHAMBER",
  JAMAL: "RING_STARTER_STREET_REFLEX",
  JOEY: "RING_STARTER_THERMAL_STARTER",
  TOMMY: "RING_STARTER_POINT_BLANK_CARNAGE",
};

export function resolveCharacterStarterRingDefId(characterId?: string): StarterRingDefId {
  if (!characterId) return DEFAULT_STARTER_RING_DEF_ID;
  return CHARACTER_STARTER_RING[characterId as PlayableCharacterId] ?? DEFAULT_STARTER_RING_DEF_ID;
}

export function equipStarterRingForCharacter(
  world: any,
  characterId?: string,
  slotId: FingerSlotId = "LEFT:0",
): RingInstance {
  const state = ensureRingProgressionState(world);
  const targetSlot = getFingerSlot(state, slotId);
  if (!targetSlot) {
    throw new Error(`Unknown starter ring slot: ${slotId}`);
  }

  const starterDefId = resolveCharacterStarterRingDefId(characterId);
  const existingInstance = Object.values(state.ringsByInstanceId)
    .find((instance) => instance.defId === starterDefId);
  if (!existingInstance) {
    return equipRing(world, starterDefId, slotId);
  }

  if (existingInstance.slotId === slotId) return existingInstance;

  const previousSlot = getFingerSlot(state, existingInstance.slotId);
  if (previousSlot) previousSlot.ringInstanceId = null;
  if (targetSlot.ringInstanceId && targetSlot.ringInstanceId !== existingInstance.instanceId) {
    delete state.ringsByInstanceId[targetSlot.ringInstanceId];
  }

  targetSlot.ringInstanceId = existingInstance.instanceId;
  existingInstance.slotId = slotId;
  return existingInstance;
}
