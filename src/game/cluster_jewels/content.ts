import {
  CLUSTER_JEWEL_CATEGORIES,
  type ClusterJewelCategory,
  type ClusterJewelCategoryDef,
  type ClusterJewelConditionDescriptor,
  type ClusterJewelEffectDescriptor,
  type ClusterJewelNodeDef,
  type ClusterJewelScalarOp,
} from "./types";

function scalar(
  stat: string,
  op: ClusterJewelScalarOp,
  value: number,
  target?: "PLAYER" | "HIT" | "DOT" | "ENEMY",
): ClusterJewelEffectDescriptor {
  return { kind: "SCALAR", stat, op, value, target };
}

function conditionalScalar(
  condition: ClusterJewelConditionDescriptor,
  stat: string,
  op: ClusterJewelScalarOp,
  value: number,
  extra: {
    target?: "PLAYER" | "HIT" | "DOT" | "ENEMY";
    durationSec?: number;
    maxStacks?: number;
  } = {},
): ClusterJewelEffectDescriptor {
  return {
    kind: "CONDITIONAL_SCALAR",
    condition,
    stat,
    op,
    value,
    target: extra.target,
    durationSec: extra.durationSec,
    maxStacks: extra.maxStacks,
  };
}

function specialChance(
  effect: "ADDITIONAL_POISON_STACK" | "DOUBLE_DAMAGE",
  chance: number,
  condition?: ClusterJewelConditionDescriptor,
): ClusterJewelEffectDescriptor {
  return { kind: "SPECIAL_CHANCE", effect, chance, condition };
}

function small(
  id: string,
  category: ClusterJewelCategory,
  summary: string,
  effects: readonly ClusterJewelEffectDescriptor[],
): ClusterJewelNodeDef {
  return {
    id,
    category,
    size: "SMALL",
    label: summary,
    summary,
    effects,
  };
}

function notable(
  id: string,
  category: ClusterJewelCategory,
  summary: string,
  effects: readonly ClusterJewelEffectDescriptor[],
): ClusterJewelNodeDef {
  return {
    id,
    category,
    size: "NOTABLE",
    label: summary,
    summary,
    effects,
  };
}

export const CLUSTER_JEWEL_SMALL_NODE_DEFS: readonly ClusterJewelNodeDef[] = [
  small("PROJECTILE_SMALL_DAMAGE_10", "PROJECTILE", "+10% projectile damage", [
    scalar("PROJECTILE_DAMAGE", "increased", 0.1, "HIT"),
  ]),
  small("PROJECTILE_SMALL_SPEED_10", "PROJECTILE", "+10% projectile speed", [
    scalar("PROJECTILE_SPEED", "increased", 0.1, "HIT"),
  ]),
  small("PROJECTILE_SMALL_RANGE_10", "PROJECTILE", "+10% projectile range", [
    scalar("PROJECTILE_RANGE", "increased", 0.1, "HIT"),
  ]),
  small("PROJECTILE_SMALL_FIRE_RATE_10", "PROJECTILE", "+10% fire rate", [
    scalar("FIRE_RATE", "increased", 0.1, "HIT"),
  ]),
  small("PROJECTILE_SMALL_PIERCE_CHANCE_10", "PROJECTILE", "+10% chance to pierce", [
    scalar("CHANCE_TO_PIERCE", "add", 0.1, "HIT"),
  ]),

  small("POISON_SMALL_DAMAGE_10", "POISON", "+10% poison damage", [
    scalar("POISON_DAMAGE", "increased", 0.1, "DOT"),
  ]),
  small("POISON_SMALL_DURATION_15", "POISON", "+15% poison duration", [
    scalar("POISON_DURATION", "increased", 0.15, "DOT"),
  ]),
  small("POISON_SMALL_CHANCE_10", "POISON", "+10% chance to poison on hit", [
    scalar("CHANCE_TO_POISON", "add", 0.1, "HIT"),
  ]),
  small("POISON_SMALL_TICK_RATE_5", "POISON", "+5% poison tick rate", [
    scalar("POISON_TICK_RATE", "increased", 0.05, "DOT"),
  ]),

  small("PHYSICAL_SMALL_DAMAGE_10", "PHYSICAL", "+10% physical damage", [
    scalar("PHYSICAL_DAMAGE", "increased", 0.1, "HIT"),
  ]),
  small("PHYSICAL_SMALL_STUN_CHANCE_5", "PHYSICAL", "+5% chance to stun on hit", [
    scalar("CHANCE_TO_STUN", "add", 0.05, "HIT"),
  ]),
  small("PHYSICAL_SMALL_LESS_TAKEN_5", "PHYSICAL", "+5% less physical damage taken", [
    scalar("PHYSICAL_DAMAGE_TAKEN", "less", 0.05, "PLAYER"),
  ]),

  small("CRITICAL_HITS_SMALL_MULTI_10", "CRITICAL_HITS", "+10% critical strike multiplier", [
    scalar("CRIT_MULTI", "add", 0.1, "HIT"),
  ]),
  small("CRITICAL_HITS_SMALL_CHANCE_5", "CRITICAL_HITS", "+5% critical strike chance", [
    scalar("CRIT_CHANCE", "add", 0.05, "HIT"),
  ]),
  small("CRITICAL_HITS_SMALL_MOVE_SPEED_AFTER_CRIT_5", "CRITICAL_HITS", "+5% movement speed after crit (3s)", [
    conditionalScalar({ kind: "ON_CRIT" }, "MOVE_SPEED", "increased", 0.05, {
      target: "PLAYER",
      durationSec: 3,
    }),
  ]),

  small("DAMAGE_OVER_TIME_SMALL_DAMAGE_10", "DAMAGE_OVER_TIME", "+10% damage over time", [
    scalar("DAMAGE_OVER_TIME", "increased", 0.1, "DOT"),
  ]),
  small("DAMAGE_OVER_TIME_SMALL_DURATION_15", "DAMAGE_OVER_TIME", "+15% duration", [
    scalar("DOT_DURATION", "increased", 0.15, "DOT"),
  ]),
  small("DAMAGE_OVER_TIME_SMALL_TICK_RATE_5", "DAMAGE_OVER_TIME", "+5% tick rate", [
    scalar("DOT_TICK_RATE", "increased", 0.05, "DOT"),
  ]),
  small("DAMAGE_OVER_TIME_SMALL_REDUCED_TAKEN_10", "DAMAGE_OVER_TIME", "10% reduced damage over time taken", [
    scalar("DAMAGE_OVER_TIME_TAKEN", "reduced", 0.1, "PLAYER"),
  ]),

  small("IGNITE_SMALL_DAMAGE_10", "IGNITE", "+10% ignite damage", [
    scalar("IGNITE_DAMAGE", "increased", 0.1, "DOT"),
  ]),
  small("IGNITE_SMALL_DURATION_15", "IGNITE", "+15% ignite duration", [
    scalar("IGNITE_DURATION", "increased", 0.15, "DOT"),
  ]),
  small("IGNITE_SMALL_CHANCE_10", "IGNITE", "+10% chance to ignite on hit", [
    scalar("CHANCE_TO_IGNITE", "add", 0.1, "HIT"),
  ]),
  small("IGNITE_SMALL_TICK_RATE_5", "IGNITE", "+5% ignite tick rate", [
    scalar("IGNITE_TICK_RATE", "increased", 0.05, "DOT"),
  ]),
];

export const CLUSTER_JEWEL_NOTABLE_NODE_DEFS: readonly ClusterJewelNodeDef[] = [
  notable("PROJECTILE_NOTABLE_PROJECTILES_ADD_1", "PROJECTILE", "+1 projectile", [
    scalar("PROJECTILES", "add", 1, "HIT"),
  ]),
  notable("PROJECTILE_NOTABLE_DAMAGE_25", "PROJECTILE", "Projectiles deal 25% increased damage", [
    scalar("PROJECTILE_DAMAGE", "increased", 0.25, "HIT"),
  ]),
  notable("PROJECTILE_NOTABLE_SPEED_RANGE_20", "PROJECTILE", "Projectiles have +20% speed and +20% range", [
    scalar("PROJECTILE_SPEED", "increased", 0.2, "HIT"),
    scalar("PROJECTILE_RANGE", "increased", 0.2, "HIT"),
  ]),
  notable("PROJECTILE_NOTABLE_PIERCE_ADD_1", "PROJECTILE", "Projectiles have +1 pierce", [
    scalar("PIERCE", "add", 1, "HIT"),
  ]),

  notable("POISON_NOTABLE_DAMAGE_30", "POISON", "30% increased poison damage", [
    scalar("POISON_DAMAGE", "increased", 0.3, "DOT"),
  ]),
  notable("POISON_NOTABLE_DURATION_25", "POISON", "25% increased poison duration", [
    scalar("POISON_DURATION", "increased", 0.25, "DOT"),
  ]),
  notable("POISON_NOTABLE_EXTRA_STACK_CHANCE_15", "POISON", "Poison has +15% chance to apply an additional stack", [
    specialChance("ADDITIONAL_POISON_STACK", 0.15),
  ]),
  notable("POISON_NOTABLE_DAMAGE_TAKEN_15", "POISON", "Poisoned enemies take 15% increased damage", [
    conditionalScalar({ kind: "TARGET_AILMENTED", ailment: "POISON" }, "DAMAGE_TAKEN", "increased", 0.15, {
      target: "ENEMY",
    }),
  ]),

  notable(
    "PHYSICAL_NOTABLE_EXECUTION_30",
    "PHYSICAL",
    "Execution: Physical hits deal 30% increased damage to enemies below 30% life",
    [
      conditionalScalar({ kind: "TARGET_LIFE_BELOW", threshold: 0.3 }, "PHYSICAL_DAMAGE", "increased", 0.3, {
        target: "HIT",
      }),
    ],
  ),
  notable(
    "PHYSICAL_NOTABLE_RELENTLESS_FORCE",
    "PHYSICAL",
    "Relentless Force: Consecutive hits grant 5% increased physical damage (max 25%)",
    [
      conditionalScalar({ kind: "CONSECUTIVE_HITS" }, "PHYSICAL_DAMAGE", "increased", 0.05, {
        target: "HIT",
        maxStacks: 5,
      }),
    ],
  ),
  notable("PHYSICAL_NOTABLE_DAMAGE_30", "PHYSICAL", "30% increased physical damage", [
    scalar("PHYSICAL_DAMAGE", "increased", 0.3, "HIT"),
  ]),
  notable(
    "PHYSICAL_NOTABLE_DAMAGE_TAKEN_10_ON_HIT",
    "PHYSICAL",
    "Physical hits apply 10% increased physical damage taken for 3 seconds",
    [
      conditionalScalar({ kind: "ON_PHYSICAL_HIT" }, "PHYSICAL_DAMAGE_TAKEN", "increased", 0.1, {
        target: "ENEMY",
        durationSec: 3,
      }),
    ],
  ),

  notable("CRITICAL_HITS_NOTABLE_MULTI_40", "CRITICAL_HITS", "+40% critical strike multiplier", [
    scalar("CRIT_MULTI", "add", 0.4, "HIT"),
  ]),
  notable("CRITICAL_HITS_NOTABLE_CHANCE_10", "CRITICAL_HITS", "+10% critical strike chance", [
    scalar("CRIT_CHANCE", "add", 0.1, "HIT"),
  ]),
  notable(
    "CRITICAL_HITS_NOTABLE_DAMAGE_AFTER_CRIT_10",
    "CRITICAL_HITS",
    "Critical strikes grant +10% increased damage for 3 seconds",
    [
      conditionalScalar({ kind: "ON_CRIT" }, "DAMAGE", "increased", 0.1, {
        target: "PLAYER",
        durationSec: 3,
      }),
    ],
  ),
  notable(
    "CRITICAL_HITS_NOTABLE_DOUBLE_DAMAGE_CHANCE_20",
    "CRITICAL_HITS",
    "Critical strikes have 20% chance to deal double damage",
    [
      specialChance("DOUBLE_DAMAGE", 0.2, { kind: "ON_CRIT" }),
    ],
  ),

  notable("DAMAGE_OVER_TIME_NOTABLE_DAMAGE_30", "DAMAGE_OVER_TIME", "30% increased damage over time", [
    scalar("DAMAGE_OVER_TIME", "increased", 0.3, "DOT"),
  ]),
  notable("DAMAGE_OVER_TIME_NOTABLE_DURATION_25", "DAMAGE_OVER_TIME", "25% increased duration", [
    scalar("DOT_DURATION", "increased", 0.25, "DOT"),
  ]),
  notable("DAMAGE_OVER_TIME_NOTABLE_TICK_RATE_20", "DAMAGE_OVER_TIME", "20% increased tick rate", [
    scalar("DOT_TICK_RATE", "increased", 0.2, "DOT"),
  ]),
  notable(
    "DAMAGE_OVER_TIME_NOTABLE_DAMAGE_TAKEN_10",
    "DAMAGE_OVER_TIME",
    "Enemies affected by your DoTs take 10% increased damage",
    [
      conditionalScalar({ kind: "TARGET_AFFECTED_BY_DOT" }, "DAMAGE_TAKEN", "increased", 0.1, {
        target: "ENEMY",
      }),
    ],
  ),

  notable("IGNITE_NOTABLE_DAMAGE_30", "IGNITE", "30% increased ignite damage", [
    scalar("IGNITE_DAMAGE", "increased", 0.3, "DOT"),
  ]),
  notable("IGNITE_NOTABLE_DURATION_25", "IGNITE", "25% increased ignite duration", [
    scalar("IGNITE_DURATION", "increased", 0.25, "DOT"),
  ]),
  notable("IGNITE_NOTABLE_TICK_RATE_20", "IGNITE", "20% increased ignite tick rate", [
    scalar("IGNITE_TICK_RATE", "increased", 0.2, "DOT"),
  ]),
  notable("IGNITE_NOTABLE_DAMAGE_TAKEN_15", "IGNITE", "Ignited enemies take 15% increased damage", [
    conditionalScalar({ kind: "TARGET_AILMENTED", ailment: "IGNITE" }, "DAMAGE_TAKEN", "increased", 0.15, {
      target: "ENEMY",
    }),
  ]),
];

export const CLUSTER_JEWEL_NODE_DEFS: readonly ClusterJewelNodeDef[] = [
  ...CLUSTER_JEWEL_SMALL_NODE_DEFS,
  ...CLUSTER_JEWEL_NOTABLE_NODE_DEFS,
];

export const CLUSTER_JEWEL_CATEGORY_DEFS: readonly ClusterJewelCategoryDef[] = [
  {
    id: "PROJECTILE",
    displayName: "Projectile",
    smallNodeIds: [
      "PROJECTILE_SMALL_DAMAGE_10",
      "PROJECTILE_SMALL_SPEED_10",
      "PROJECTILE_SMALL_RANGE_10",
      "PROJECTILE_SMALL_FIRE_RATE_10",
      "PROJECTILE_SMALL_PIERCE_CHANCE_10",
    ],
    notableNodeIds: [
      "PROJECTILE_NOTABLE_PROJECTILES_ADD_1",
      "PROJECTILE_NOTABLE_DAMAGE_25",
      "PROJECTILE_NOTABLE_SPEED_RANGE_20",
      "PROJECTILE_NOTABLE_PIERCE_ADD_1",
    ],
  },
  {
    id: "POISON",
    displayName: "Poison",
    smallNodeIds: [
      "POISON_SMALL_DAMAGE_10",
      "POISON_SMALL_DURATION_15",
      "POISON_SMALL_CHANCE_10",
      "POISON_SMALL_TICK_RATE_5",
    ],
    notableNodeIds: [
      "POISON_NOTABLE_DAMAGE_30",
      "POISON_NOTABLE_DURATION_25",
      "POISON_NOTABLE_EXTRA_STACK_CHANCE_15",
      "POISON_NOTABLE_DAMAGE_TAKEN_15",
    ],
  },
  {
    id: "PHYSICAL",
    displayName: "Physical",
    smallNodeIds: [
      "PHYSICAL_SMALL_DAMAGE_10",
      "PHYSICAL_SMALL_STUN_CHANCE_5",
      "PHYSICAL_SMALL_LESS_TAKEN_5",
    ],
    notableNodeIds: [
      "PHYSICAL_NOTABLE_EXECUTION_30",
      "PHYSICAL_NOTABLE_RELENTLESS_FORCE",
      "PHYSICAL_NOTABLE_DAMAGE_30",
      "PHYSICAL_NOTABLE_DAMAGE_TAKEN_10_ON_HIT",
    ],
  },
  {
    id: "CRITICAL_HITS",
    displayName: "Critical Hits",
    smallNodeIds: [
      "CRITICAL_HITS_SMALL_MULTI_10",
      "CRITICAL_HITS_SMALL_CHANCE_5",
      "CRITICAL_HITS_SMALL_MOVE_SPEED_AFTER_CRIT_5",
    ],
    notableNodeIds: [
      "CRITICAL_HITS_NOTABLE_MULTI_40",
      "CRITICAL_HITS_NOTABLE_CHANCE_10",
      "CRITICAL_HITS_NOTABLE_DAMAGE_AFTER_CRIT_10",
      "CRITICAL_HITS_NOTABLE_DOUBLE_DAMAGE_CHANCE_20",
    ],
  },
  {
    id: "DAMAGE_OVER_TIME",
    displayName: "Damage Over Time",
    smallNodeIds: [
      "DAMAGE_OVER_TIME_SMALL_DAMAGE_10",
      "DAMAGE_OVER_TIME_SMALL_DURATION_15",
      "DAMAGE_OVER_TIME_SMALL_TICK_RATE_5",
      "DAMAGE_OVER_TIME_SMALL_REDUCED_TAKEN_10",
    ],
    notableNodeIds: [
      "DAMAGE_OVER_TIME_NOTABLE_DAMAGE_30",
      "DAMAGE_OVER_TIME_NOTABLE_DURATION_25",
      "DAMAGE_OVER_TIME_NOTABLE_TICK_RATE_20",
      "DAMAGE_OVER_TIME_NOTABLE_DAMAGE_TAKEN_10",
    ],
  },
  {
    id: "IGNITE",
    displayName: "Ignite",
    smallNodeIds: [
      "IGNITE_SMALL_DAMAGE_10",
      "IGNITE_SMALL_DURATION_15",
      "IGNITE_SMALL_CHANCE_10",
      "IGNITE_SMALL_TICK_RATE_5",
    ],
    notableNodeIds: [
      "IGNITE_NOTABLE_DAMAGE_30",
      "IGNITE_NOTABLE_DURATION_25",
      "IGNITE_NOTABLE_TICK_RATE_20",
      "IGNITE_NOTABLE_DAMAGE_TAKEN_15",
    ],
  },
];

const NODE_DEF_BY_ID = new Map<string, ClusterJewelNodeDef>(
  CLUSTER_JEWEL_NODE_DEFS.map((node) => [node.id, node]),
);

const CATEGORY_DEF_BY_ID = new Map<ClusterJewelCategory, ClusterJewelCategoryDef>(
  CLUSTER_JEWEL_CATEGORY_DEFS.map((category) => [category.id, category]),
);

export function isClusterJewelCategory(value: unknown): value is ClusterJewelCategory {
  return typeof value === "string" && CLUSTER_JEWEL_CATEGORIES.includes(value as ClusterJewelCategory);
}

export function getClusterJewelNodeDef(id: string): ClusterJewelNodeDef | null {
  return NODE_DEF_BY_ID.get(id) ?? null;
}

export function getClusterJewelCategoryDef(category: ClusterJewelCategory): ClusterJewelCategoryDef | null {
  return CATEGORY_DEF_BY_ID.get(category) ?? null;
}

export function getClusterJewelNodesByCategory(
  category: ClusterJewelCategory,
  size: "SMALL" | "NOTABLE",
): ClusterJewelNodeDef[] {
  const categoryDef = getClusterJewelCategoryDef(category);
  if (!categoryDef) return [];
  const ids = size === "SMALL" ? categoryDef.smallNodeIds : categoryDef.notableNodeIds;
  const out: ClusterJewelNodeDef[] = [];
  for (let i = 0; i < ids.length; i++) {
    const nodeDef = getClusterJewelNodeDef(ids[i]);
    if (!nodeDef) continue;
    out.push(nodeDef);
  }
  return out;
}

export function validateClusterJewelContent(): void {
  const errors: string[] = [];
  const seenNodeIds = new Set<string>();

  for (let i = 0; i < CLUSTER_JEWEL_NODE_DEFS.length; i++) {
    const node = CLUSTER_JEWEL_NODE_DEFS[i];
    if (seenNodeIds.has(node.id)) {
      errors.push(`Duplicate node id ${node.id}.`);
      continue;
    }
    seenNodeIds.add(node.id);
    if (!isClusterJewelCategory(node.category)) {
      errors.push(`Node ${node.id} has invalid category ${String(node.category)}.`);
    }
    if (node.effects.length <= 0) {
      errors.push(`Node ${node.id} must declare at least one effect descriptor.`);
    }
  }

  if (CLUSTER_JEWEL_CATEGORY_DEFS.length !== CLUSTER_JEWEL_CATEGORIES.length) {
    errors.push("Cluster jewel categories must define exactly the locked six category defs.");
  }

  for (let i = 0; i < CLUSTER_JEWEL_CATEGORIES.length; i++) {
    const category = CLUSTER_JEWEL_CATEGORIES[i];
    const def = getClusterJewelCategoryDef(category);
    if (!def) {
      errors.push(`Missing category def for ${category}.`);
      continue;
    }
    if (def.smallNodeIds.length <= 0) {
      errors.push(`Category ${category} must expose at least one small node.`);
    }
    if (def.notableNodeIds.length <= 0) {
      errors.push(`Category ${category} must expose at least one notable node.`);
    }
    for (let j = 0; j < def.smallNodeIds.length; j++) {
      const node = getClusterJewelNodeDef(def.smallNodeIds[j]);
      if (!node) {
        errors.push(`Category ${category} references missing small node ${def.smallNodeIds[j]}.`);
        continue;
      }
      if (node.category !== category || node.size !== "SMALL") {
        errors.push(`Category ${category} small node ${node.id} has mismatched category or size.`);
      }
    }
    for (let j = 0; j < def.notableNodeIds.length; j++) {
      const node = getClusterJewelNodeDef(def.notableNodeIds[j]);
      if (!node) {
        errors.push(`Category ${category} references missing notable node ${def.notableNodeIds[j]}.`);
        continue;
      }
      if (node.category !== category || node.size !== "NOTABLE") {
        errors.push(`Category ${category} notable node ${node.id} has mismatched category or size.`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`[clusterJewels] Validation failed:\n- ${errors.join("\n- ")}`);
  }
}
