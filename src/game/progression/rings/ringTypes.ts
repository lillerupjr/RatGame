import type { EffectDef } from "../effects/effectTypes";

export type RingFamilyId =
  | "physical"
  | "fire"
  | "poison"
  | "projectile"
  | "crit"
  | "defense";

export type HandId = "LEFT" | "RIGHT";
export type FingerSlotId = `${HandId}:${number}`;

export type ModifierTokenType = "LEVEL_UP" | "INCREASED_EFFECT_20";
export type HandEffectType = "ADD_FINGER" | "EMPOWER_FINGER";

export type RingDef = {
  id: string;
  name: string;
  familyId: RingFamilyId;
  tags: string[];
  effectType: EffectDef["kind"];
  effectParams: EffectDef;
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
