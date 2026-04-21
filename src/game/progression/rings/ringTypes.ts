import type { EffectDef } from "../effects/effectTypes";

export const RING_FAMILY_IDS = [
  "starter",
  "generic",
  "physical",
  "dot",
  "chaos",
  "poison",
  "projectile",
  "ignite",
  "crit",
  "trigger",
  "defense",
  "utility",
] as const;

export type RingFamilyId = (typeof RING_FAMILY_IDS)[number];

export const HAND_IDS = ["LEFT", "RIGHT"] as const;
export type HandId = (typeof HAND_IDS)[number];
export type FingerSlotId = `${HandId}:${number}`;

export const MODIFIER_TOKEN_TYPES = ["LEVEL_UP", "INCREASED_EFFECT_20"] as const;
export type ModifierTokenType = (typeof MODIFIER_TOKEN_TYPES)[number];

export const HAND_EFFECT_TYPES = ["ADD_FINGER", "EMPOWER_FINGER"] as const;
export type HandEffectType = (typeof HAND_EFFECT_TYPES)[number];

export type RingDef = {
  id: string;
  name: string;
  description: string;
  tier: 1;
  familyId: RingFamilyId;
  tags: string[];
  mainEffect: EffectDef;
};

export type RingInstance = {
  instanceId: string;
  defId: string;
  slotId: FingerSlotId;
  allocatedPassivePoints: number;
  increasedEffectScalar: number;
  unlockedTalentNodeIds: string[];
};

export type RingTalentNodeDef = {
  id: string;
  name: string;
  description: string;
  requiresNodeIds: string[];
  cost: number;
  effect: EffectDef;
};

export type RingFamilyTalentTreeDef = {
  familyId: RingFamilyId;
  nodes: RingTalentNodeDef[];
};

export type FingerSlotState = {
  slotId: FingerSlotId;
  handId: HandId;
  index: number;
  ringInstanceId: string | null;
  empowermentScalar: number;
};

export type HandState = {
  handId: HandId;
  slots: FingerSlotState[];
};

export type StoredModifierTokens = Record<ModifierTokenType, number>;

export type RingProgressionState = {
  hands: Record<HandId, HandState>;
  ringsByInstanceId: Record<string, RingInstance>;
  storedModifierTokens: StoredModifierTokens;
  nextRingInstanceSeq: number;
};
