import { describe, expect, test } from "vitest";
import {
  CLUSTER_JEWEL_CATEGORY_DEFS,
  CLUSTER_JEWEL_NODE_DEFS,
  CLUSTER_JEWEL_NOTABLE_NODE_DEFS,
  CLUSTER_JEWEL_SMALL_NODE_DEFS,
  getClusterJewelCategoryDef,
  getClusterJewelNodeDef,
  validateClusterJewelContent,
} from "../../../game/cluster_jewels/content";
import { generateClusterJewel } from "../../../game/cluster_jewels/generation";
import { CLUSTER_JEWEL_CATEGORIES } from "../../../game/cluster_jewels/types";

describe("cluster jewel content", () => {
  test("locked category and node content validates", () => {
    expect(() => validateClusterJewelContent()).not.toThrow();
    expect(CLUSTER_JEWEL_CATEGORY_DEFS).toHaveLength(6);
    expect(CLUSTER_JEWEL_NODE_DEFS).toHaveLength(
      CLUSTER_JEWEL_SMALL_NODE_DEFS.length + CLUSTER_JEWEL_NOTABLE_NODE_DEFS.length,
    );
  });

  test("locked pools expose expected category counts", () => {
    const expected = {
      PROJECTILE: { small: 5, notable: 4 },
      POISON: { small: 4, notable: 4 },
      PHYSICAL: { small: 3, notable: 4 },
      CRITICAL_HITS: { small: 3, notable: 4 },
      DAMAGE_OVER_TIME: { small: 4, notable: 4 },
      IGNITE: { small: 4, notable: 4 },
    } as const;

    for (let i = 0; i < CLUSTER_JEWEL_CATEGORIES.length; i++) {
      const category = CLUSTER_JEWEL_CATEGORIES[i];
      const def = getClusterJewelCategoryDef(category);
      expect(def).toBeTruthy();
      expect(def?.smallNodeIds).toHaveLength(expected[category].small);
      expect(def?.notableNodeIds).toHaveLength(expected[category].notable);
    }
  });

  test("generated jewels always stay inside one category with 4 small nodes and 1 notable", () => {
    const jewel = generateClusterJewel({
      jewelId: "generated-test-1",
      category: "IGNITE",
      random: () => 0.42,
    });

    expect(jewel.category).toBe("IGNITE");
    expect(jewel.smallNodeIds).toHaveLength(4);
    expect(jewel.allocatedNodeIds).toEqual([]);

    const categoryDef = getClusterJewelCategoryDef(jewel.category)!;
    for (let i = 0; i < jewel.smallNodeIds.length; i++) {
      const nodeId = jewel.smallNodeIds[i];
      const node = getClusterJewelNodeDef(nodeId);
      expect(node?.category).toBe(jewel.category);
      expect(node?.size).toBe("SMALL");
      expect(categoryDef.smallNodeIds).toContain(nodeId);
    }

    const notable = getClusterJewelNodeDef(jewel.notableNodeId);
    expect(notable?.category).toBe(jewel.category);
    expect(notable?.size).toBe("NOTABLE");
    expect(categoryDef.notableNodeIds).toContain(jewel.notableNodeId);
  });

  test("small-node duplication is allowed during generation", () => {
    const jewel = generateClusterJewel({
      jewelId: "generated-test-duplicates",
      category: "PHYSICAL",
      random: () => 0,
    });

    expect(jewel.smallNodeIds).toEqual([
      "PHYSICAL_SMALL_DAMAGE_10",
      "PHYSICAL_SMALL_DAMAGE_10",
      "PHYSICAL_SMALL_DAMAGE_10",
      "PHYSICAL_SMALL_DAMAGE_10",
    ]);
    expect(jewel.notableNodeId).toBe("PHYSICAL_NOTABLE_EXECUTION_30");
  });
});
