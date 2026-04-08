import {
  CLUSTER_JEWEL_CATEGORIES,
  type ClusterJewelCategory,
  type ClusterJewelInstance,
  type ClusterJewelSmallNodeIds,
  type ClusterJewelSource,
} from "./types";
import { getClusterJewelCategoryDef } from "./content";

function clampRoll01(randomValue: number): number {
  if (!Number.isFinite(randomValue)) return 0;
  return Math.max(0, Math.min(0.999999999, randomValue));
}

function pickIndex(random: () => number, length: number): number {
  return Math.floor(clampRoll01(random()) * Math.max(1, length));
}

function pickOne<T>(items: readonly T[], random: () => number): T {
  return items[pickIndex(random, items.length)];
}

export function generateClusterJewel(args: {
  jewelId: string;
  random: () => number;
  category?: ClusterJewelCategory;
  source?: ClusterJewelSource;
}): ClusterJewelInstance {
  const category = args.category ?? pickOne(CLUSTER_JEWEL_CATEGORIES, args.random);
  const categoryDef = getClusterJewelCategoryDef(category);
  if (!categoryDef) {
    throw new Error(`[clusterJewels] Missing category def for generated jewel ${category}.`);
  }
  const smallNodeIds: ClusterJewelSmallNodeIds = [
    pickOne(categoryDef.smallNodeIds, args.random),
    pickOne(categoryDef.smallNodeIds, args.random),
    pickOne(categoryDef.smallNodeIds, args.random),
    pickOne(categoryDef.smallNodeIds, args.random),
  ];
  const notableNodeId = pickOne(categoryDef.notableNodeIds, args.random);
  return {
    id: args.jewelId,
    category,
    smallNodeIds,
    notableNodeId,
    source: args.source ?? "generated",
    allocatedNodeIds: [],
  };
}
