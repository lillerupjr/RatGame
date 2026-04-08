import type { PlayableCharacterId } from "../content/playableCharacters";

export const CLUSTER_JEWEL_CATEGORIES = [
  "PROJECTILE",
  "POISON",
  "PHYSICAL",
  "CRITICAL_HITS",
  "DAMAGE_OVER_TIME",
  "IGNITE",
] as const;

export type ClusterJewelCategory = (typeof CLUSTER_JEWEL_CATEGORIES)[number];

export const CLUSTER_JEWEL_NODE_SIZES = ["SMALL", "NOTABLE"] as const;

export type ClusterJewelNodeSize = (typeof CLUSTER_JEWEL_NODE_SIZES)[number];

export type ClusterJewelSource =
  | "starter"
  | "generated"
  | "drop"
  | "vendor"
  | "reward"
  | "debug";

export type ClusterJewelScalarOp = "add" | "increased" | "more" | "less" | "reduced";

export type ClusterJewelConditionDescriptor =
  | {
      kind: "TARGET_LIFE_BELOW";
      threshold: number;
    }
  | {
      kind: "TARGET_AILMENTED";
      ailment: "POISON" | "IGNITE" | "BLEED";
    }
  | {
      kind: "TARGET_AFFECTED_BY_DOT";
    }
  | {
      kind: "ON_CRIT";
    }
  | {
      kind: "ON_PHYSICAL_HIT";
    }
  | {
      kind: "CONSECUTIVE_HITS";
    };

export type ClusterJewelEffectDescriptor =
  | {
      kind: "SCALAR";
      stat: string;
      op: ClusterJewelScalarOp;
      value: number;
      target?: "PLAYER" | "HIT" | "DOT" | "ENEMY";
    }
  | {
      kind: "CONDITIONAL_SCALAR";
      condition: ClusterJewelConditionDescriptor;
      stat: string;
      op: ClusterJewelScalarOp;
      value: number;
      target?: "PLAYER" | "HIT" | "DOT" | "ENEMY";
      durationSec?: number;
      maxStacks?: number;
    }
  | {
      kind: "SPECIAL_CHANCE";
      effect: "ADDITIONAL_POISON_STACK" | "DOUBLE_DAMAGE";
      chance: number;
      condition?: ClusterJewelConditionDescriptor;
    };

export type ClusterJewelNodeDef = {
  id: string;
  category: ClusterJewelCategory;
  size: ClusterJewelNodeSize;
  label: string;
  summary: string;
  effects: readonly ClusterJewelEffectDescriptor[];
};

export type ClusterJewelSmallNodeIds = [string, string, string, string];

export type ClusterJewelInstance = {
  id: string;
  category: ClusterJewelCategory;
  smallNodeIds: ClusterJewelSmallNodeIds;
  notableNodeId: string;
  source: ClusterJewelSource;
  allocatedNodeIds: string[];
};

export type ClusterJewelCategoryDef = {
  id: ClusterJewelCategory;
  displayName: string;
  smallNodeIds: readonly string[];
  notableNodeIds: readonly string[];
};

export type StarterClusterJewelDef = {
  jewelId: string;
  characterId: PlayableCharacterId;
  category: ClusterJewelCategory;
  notableNodeId: string;
};
