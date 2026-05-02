// @system   ring-progression/system
// @owns     define ring families, hand slots, tokens, ring instances, and progression state types
// @doc      docs/canonical/ring_progression_system.md
// @agents   no ring content registry or state mutation; see ringContent.ts and ringState.ts

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
  "health",
  "defense",
  "utility",
] as const;

export type RingFamilyId = (typeof RING_FAMILY_IDS)[number];

export const RING_TIER_IDS = ["t0", "t1", "t2", "t3"] as const;
export type RingTier = (typeof RING_TIER_IDS)[number];

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
  tier: RingTier;
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
