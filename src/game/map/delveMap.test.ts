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
      expect(node.rewardFamily).toBe("RING");
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
});

describe("combat subtypes", () => {
  test("every combat node uses the survive timer objective", () => {
    for (const seed of [1, 7, 42, 100, 999]) {
      const map = createDelveMap(seed);
      for (const node of map.nodes.values()) {
        if (node.nodeType !== "COMBAT") continue;
        expect(node.combatSubtype).toBe("SURVIVE_TIMER");
        expect(node.runtime.objectiveId).toBe("SURVIVE_TIMER");
      }
    }
  });
});
