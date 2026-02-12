// src/game/map/delveMap.test.ts
import { describe, it, expect } from "vitest";
import {
  createDelveMap,
  ensureAdjacentNodes,
  getReachableNodes,
  moveToNode,
  getNodeDepth,
  getDepthScaling,
  getVisibleNodes,
  type DelveMap,
} from "../../../game/map/delveMap";

describe("delveMap", () => {
  describe("createDelveMap", () => {
    it("should create a map with a starting node and initial adjacency", () => {
      const map = createDelveMap(12345);

      expect(map.nodes.size).toBeGreaterThanOrEqual(3);
      expect(map.nodes.has("0,0")).toBe(true);
      expect(map.currentNodeId).toBeNull();
      expect(map.exploredDepth).toBe(0);
    });

    it("should create starting node with valid zone", () => {
      const map = createDelveMap(12345);
      const startNode = map.nodes.get("0,0")!;

      expect(["DOCKS", "SEWERS", "CHINATOWN"]).toContain(startNode.zoneId);
      expect(startNode.completed).toBe(false);
      expect(startNode.x).toBe(0);
      expect(startNode.y).toBe(0);
      expect(startNode.plan.depth).toBe(1);
      expect(["docks", "avenue", "china_town"]).toContain(startNode.plan.mapId);
      expect(startNode.plan.objectiveId).toBeTruthy();
      expect(startNode.plan.variantSeed).toBeGreaterThanOrEqual(0);
    });

    it("should produce deterministic maps for same seed", () => {
      const map1 = createDelveMap(42);
      const map2 = createDelveMap(42);

      const node1 = map1.nodes.get("0,0")!;
      const node2 = map2.nodes.get("0,0")!;

      expect(node1.zoneId).toBe(node2.zoneId);
    });
  });

  describe("getNodeDepth", () => {
    it("should return depth 1 for y=0", () => {
      const node = {
        id: "0,0",
        x: 0,
        y: 0,
        zoneId: "DOCKS" as const,
        floorArchetype: "SURVIVE" as const,
        plan: {
          depth: 1,
          mapId: "docks" as const,
          objectiveId: "SURVIVE_TIMER" as const,
          variantSeed: 123,
        },
        title: "Test",
        completed: false,
      };
      expect(getNodeDepth(node)).toBe(1);
    });

    it("should return depth = y + 1", () => {
      const node = {
        id: "0,5",
        x: 0,
        y: 5,
        zoneId: "DOCKS" as const,
        floorArchetype: "SURVIVE" as const,
        plan: {
          depth: 6,
          mapId: "docks" as const,
          objectiveId: "SURVIVE_TIMER" as const,
          variantSeed: 123,
        },
        title: "Test",
        completed: false,
      };
      expect(getNodeDepth(node)).toBe(6);
    });
  });

  describe("getDepthScaling", () => {
    it("should return 1.0x multipliers at depth 1", () => {
      const scaling = getDepthScaling(1);

      expect(scaling.hpMult).toBe(1);
      expect(scaling.damageMult).toBe(1);
      expect(scaling.spawnRateMult).toBe(1);
      expect(scaling.xpMult).toBe(1);
    });

    it("should increase multipliers with depth", () => {
      const scaling1 = getDepthScaling(1);
      const scaling10 = getDepthScaling(10);

      expect(scaling10.hpMult).toBeGreaterThan(scaling1.hpMult);
      expect(scaling10.damageMult).toBeGreaterThan(scaling1.damageMult);
      expect(scaling10.spawnRateMult).toBeGreaterThan(scaling1.spawnRateMult);
      expect(scaling10.xpMult).toBeGreaterThan(scaling1.xpMult);
    });

    it("should calculate correct HP scaling (+10% per depth)", () => {
      const scaling5 = getDepthScaling(5);
      // 1.1^4 = 1.4641
      expect(scaling5.hpMult).toBeCloseTo(Math.pow(1.1, 4), 5);
    });

    it("should handle depth < 1 by clamping to 1", () => {
      const scalingNeg = getDepthScaling(-5);
      const scaling0 = getDepthScaling(0);
      const scaling1 = getDepthScaling(1);

      expect(scalingNeg.hpMult).toBe(scaling1.hpMult);
      expect(scaling0.hpMult).toBe(scaling1.hpMult);
    });
  });

  describe("ensureAdjacentNodes", () => {
    it("should generate adjacent nodes from current position", () => {
      const map = createDelveMap(12345);
      ensureAdjacentNodes(map, "0,0", 12345);

      // Should have more than just the starting node now
      expect(map.nodes.size).toBeGreaterThan(1);
      expect(map.edges.length).toBeGreaterThan(0);
    });

    it("should always create a path to go deeper", () => {
      const map = createDelveMap(12345);
      ensureAdjacentNodes(map, "0,0", 12345);

      // Should have node at depth 1 (y=1)
      const hasDeeper = map.edges.some(
        e => e.from === "0,0" && e.to === "0,1" || e.from === "0,1" && e.to === "0,0"
      );
      expect(hasDeeper).toBe(true);
    });
  });

  describe("getReachableNodes", () => {
    it("should return multiple starting nodes when no current position", () => {
      const map = createDelveMap(12345);
      const reachable = getReachableNodes(map);

      expect(reachable.length).toBeGreaterThanOrEqual(3);
      expect(reachable.some((n) => n.id === "0,0")).toBe(true);
    });

    it("should return connected nodes from current position", () => {
      const map = createDelveMap(12345);
      moveToNode(map, "0,0");
      ensureAdjacentNodes(map, "0,0", 12345);

      const reachable = getReachableNodes(map);

      // Should have at least one reachable node (the deeper one)
      expect(reachable.length).toBeGreaterThan(0);
    });
  });

  describe("moveToNode", () => {
    it("should update current node ID", () => {
      const map = createDelveMap(12345);
      moveToNode(map, "0,0");

      expect(map.currentNodeId).toBe("0,0");
    });

    it("should mark previous node as completed", () => {
      const map = createDelveMap(12345);
      moveToNode(map, "0,0");
      ensureAdjacentNodes(map, "0,0", 12345);
      
      // Move to adjacent node
      const reachable = getReachableNodes(map);
      if (reachable.length > 0) {
        moveToNode(map, reachable[0].id);
        
        const startNode = map.nodes.get("0,0")!;
        expect(startNode.completed).toBe(true);
      }
    });

    it("should update explored depth", () => {
      const map = createDelveMap(12345);
      moveToNode(map, "0,0");
      ensureAdjacentNodes(map, "0,0", 12345);

      // Create and move to a deeper node
      const deeperNode = map.nodes.get("0,1");
      if (deeperNode) {
        moveToNode(map, "0,1");
        expect(map.exploredDepth).toBe(1);
      }
    });

    it("should return null for non-existent node", () => {
      const map = createDelveMap(12345);
      const result = moveToNode(map, "999,999");

      expect(result).toBeNull();
    });
  });

  describe("getVisibleNodes", () => {
    it("should return all nodes when map is small", () => {
      const map = createDelveMap(12345);
      const visible = getVisibleNodes(map);

      expect(visible.length).toBe(map.nodes.size);
    });

    it("should filter nodes by radius from current position", () => {
      const map = createDelveMap(12345);
      
      // Generate a larger map
      moveToNode(map, "0,0");
      for (let i = 0; i < 10; i++) {
        const nodes = Array.from(map.nodes.values());
        for (const node of nodes) {
          ensureAdjacentNodes(map, node.id, 12345 + i);
        }
      }

      moveToNode(map, "0,5");
      const visible = getVisibleNodes(map, 2);

      // All visible nodes should be within radius 2 of (0,5)
      for (const node of visible) {
        expect(Math.abs(node.x - 0)).toBeLessThanOrEqual(2);
        expect(Math.abs(node.y - 5)).toBeLessThanOrEqual(2);
      }
    });
  });
});
