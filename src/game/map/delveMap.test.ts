import { describe, expect, test } from "vitest";
import { createDelveMap, type DelveNode } from "./delveMap";

describe("assignRewardFamilies", () => {
  const ELIGIBLE_TYPES = new Set(["COMBAT", "ELITE", "QUESTION_MARK"]);

  function eligibleNodes(nodes: Map<string, DelveNode>): DelveNode[] {
    return Array.from(nodes.values()).filter((n) => ELIGIBLE_TYPES.has(n.nodeType));
  }

  function nonEligibleNodes(nodes: Map<string, DelveNode>): DelveNode[] {
    return Array.from(nodes.values()).filter((n) => !ELIGIBLE_TYPES.has(n.nodeType));
  }

  test("all combat/elite/question-mark nodes have rewardFamily defined", () => {
    const map = createDelveMap(42);
    for (const node of eligibleNodes(map.nodes)) {
      expect(node.rewardFamily).toBeDefined();
      expect(["RING", "RING_MODIFIER_TOKEN"]).toContain(node.rewardFamily);
    }
  });

  test("REST, SHOP, BOSS nodes have no rewardFamily", () => {
    const map = createDelveMap(42);
    for (const node of nonEligibleNodes(map.nodes)) {
      expect(node.rewardFamily).toBeUndefined();
    }
  });

  test("same seed produces same assignment (deterministic)", () => {
    const map1 = createDelveMap(12345);
    const map2 = createDelveMap(12345);
    const nodes1 = Array.from(map1.nodes.values()).sort((a, b) => a.id.localeCompare(b.id));
    const nodes2 = Array.from(map2.nodes.values()).sort((a, b) => a.id.localeCompare(b.id));
    expect(nodes1.length).toBe(nodes2.length);
    for (let i = 0; i < nodes1.length; i++) {
      expect(nodes1[i].rewardFamily).toBe(nodes2[i].rewardFamily);
    }
  });

  test("multi-node rows have at least 2 distinct reward families", () => {
    // Test across several seeds to increase confidence
    for (const seed of [1, 7, 42, 100, 999]) {
      const map = createDelveMap(seed);
      const rowMap = new Map<number, Set<string>>();
      for (const node of eligibleNodes(map.nodes)) {
        const families = rowMap.get(node.rowIndex) ?? new Set<string>();
        families.add(node.rewardFamily!);
        rowMap.set(node.rowIndex, families);
      }
      for (const [, families] of rowMap) {
        // Only check rows with 2+ eligible nodes
        if (families.size >= 1) {
          // Rows with multiple eligible nodes must have diversity
          // We check the total eligible count in that row via the map
          const nodesInRow = eligibleNodes(map.nodes).filter(
            (n) => rowMap.get(n.rowIndex) === families,
          );
          if (nodesInRow.length >= 2) {
            expect(families.size).toBeGreaterThanOrEqual(2);
          }
        }
      }
    }
  });

  test("overall distribution stays roughly 55/45 (RING >= 40%, MODIFIER >= 30%)", () => {
    // Aggregate across multiple seeds
    let totalRing = 0;
    let totalModifier = 0;
    for (let seed = 0; seed < 50; seed++) {
      const map = createDelveMap(seed);
      for (const node of eligibleNodes(map.nodes)) {
        if (node.rewardFamily === "RING") totalRing++;
        else if (node.rewardFamily === "RING_MODIFIER_TOKEN") totalModifier++;
      }
    }
    const total = totalRing + totalModifier;
    expect(total).toBeGreaterThan(0);
    expect(totalRing / total).toBeGreaterThanOrEqual(0.4);
    expect(totalModifier / total).toBeGreaterThanOrEqual(0.3);
  });
});
