import type { StatKey } from "../../combat_mods/stats/statKeys";

export type ModOp = "add" | "increased" | "decreased" | "more" | "less";

/**
 * A single numeric stat modifier.
 *
 * Conventions:
 * - "add" is raw addition to a base stat.
 * - "increased"/"decreased" are additive scaling, expressed as fractions.
 * - "more"/"less" are multiplicative scaling, expressed as fractions.
 */
export interface StatMod {
  key: StatKey;
  op: ModOp;
  value: number;
}

export type EffectSourceKind =
  | "RING_MAIN"
  | "RING_TALENT"
  | "HAND_FINGER";

export type EffectSourceRef = {
  kind: EffectSourceKind;
  id: string;
  ringInstanceId?: string;
  ringDefId?: string;
  slotId?: string;
  nodeId?: string;
};

export type StatModifierEffectDef = {
  kind: "STAT_MODIFIERS";
  mods: StatMod[];
};

export type TriggeredEffectDef = {
  kind: "TRIGGERED";
  triggerKey: string;
  params: Record<string, unknown>;
};

export type StructuralHandEffectDef = {
  kind: "HAND_STRUCTURE";
  effectType: "ADD_FINGER" | "EMPOWER_FINGER";
  params?: Record<string, unknown>;
};

export type EffectDef = StatModifierEffectDef | TriggeredEffectDef | StructuralHandEffectDef;

export type RuntimeEffect = {
  source: EffectSourceRef;
  effect: EffectDef;
  /**
   * Applies to numerical values in STAT_MODIFIERS. A value of 0.2 means
   * "20% increased effect" and scales authored numbers by 1.2.
   */
  increasedEffectScalar?: number;
};
