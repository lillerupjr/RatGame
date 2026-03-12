import { describe, expect, it } from "vitest";
import {
  canEnterNode,
  countClearedNodes,
  createDelveMap,
  ensureAdjacentNodes,
  getDepthScaling,
  getNodeDepth,
  getReachableNodes,
  getVisibleNodes,
  hydrateNodeStates,
  markCurrentNodeCleared,
  markNodeActive,
  moveToNode,
  serializeNodeStates,
  type DelveMap,
  type DelveNode,
  type DelveNodeState,
} from "../../../game/map/delveMap";

describe("delveMap", () => {
  describe("createDelveMap", () => {
    it("creates starting node and adjacency", () => {
      const map = createDelveMap(12345);

      expect(map.nodes.size).toBeGreaterThanOrEqual(3);
      expect(map.nodes.has("0,0")).toBe(true);
      expect(map.currentNodeId).toBeNull();
      expect(map.exploredDepth).toBe(0);
    });

    it("starting node is UNVISITED", () => {
      const map = createDelveMap(12345);
      const startNode = map.nodes.get("0,0")!;

      expect(["DOCKS", "SEWERS", "CHINATOWN"]).toContain(startNode.zoneId);
      expect(startNode.state).toBe("UNVISITED");
      expect(startNode.plan.depth).toBe(1);
      expect(["docks", "avenue", "china_town", "downtown", "highway"]).toContain(startNode.plan.mapId);
      expect(startNode.plan.objectiveId).toBeTruthy();
    });

    it("can roll PoE objective on SURVIVE nodes", () => {
      let foundPoe = false;
      for (let seed = 1; seed <= 512; seed++) {
        const map = createDelveMap(seed);
        for (const node of map.nodes.values()) {
          if (node.floorArchetype === "SURVIVE" && node.plan.objectiveId === "POE_MAP_CLEAR") {
            foundPoe = true;
            break;
          }
        }
        if (foundPoe) break;
      }

      expect(foundPoe).toBe(true);
    });
  });

  describe("getNodeDepth", () => {
    it("returns depth = y + 1", () => {
      const node: DelveNode = {
        id: "0,5",
        x: 0,
        y: 5,
        zoneId: "DOCKS",
        floorArchetype: "SURVIVE",
        plan: {
          depth: 6,
          mapId: "docks",
          objectiveId: "SURVIVE_TIMER",
          variantSeed: 123,
        },
        title: "Test",
        state: "UNVISITED",
      };
      expect(getNodeDepth(node)).toBe(6);
    });
  });

  describe("getDepthScaling", () => {
    it("returns 1.0x at depth 1", () => {
      const scaling = getDepthScaling(1);
      expect(scaling.hpMult).toBe(1);
      expect(scaling.damageMult).toBe(1);
      expect(scaling.spawnRateMult).toBe(1);
    });

    it("clamps depth below 1", () => {
      expect(getDepthScaling(-5).hpMult).toBe(getDepthScaling(1).hpMult);
      expect(getDepthScaling(0).hpMult).toBe(getDepthScaling(1).hpMult);
    });
  });

  describe("single-visit traversal", () => {
    it("first delve map only allows depth-0 picks", () => {
      const map = createDelveMap(321);
      const startReachable = getReachableNodes(map);

      expect(startReachable.length).toBeGreaterThan(0);
      expect(startReachable.every((n) => n.y === 0)).toBe(true);
      expect(map.nodes.has("0,1")).toBe(true);
      expect(canEnterNode(map, "0,1")).toBe(false);

      const start = markNodeActive(map, "0,0");
      expect(start?.state).toBe("ACTIVE");
      markCurrentNodeCleared(map);

      const postClearReachable = getReachableNodes(map);
      expect(postClearReachable.some((n) => n.y === 1)).toBe(true);
      expect(canEnterNode(map, "0,1")).toBe(true);
    });

    it("only allows entering UNVISITED connected nodes", () => {
      const map = createDelveMap(99);

      const startReachable = getReachableNodes(map);
      expect(startReachable.length).toBeGreaterThan(0);
      expect(startReachable.every((n) => n.state === "UNVISITED")).toBe(true);

      expect(canEnterNode(map, "0,0")).toBe(true);
      const start = markNodeActive(map, "0,0");
      expect(start?.state).toBe("ACTIVE");
      expect(map.currentNodeId).toBe("0,0");

      // While active, no further node entry is allowed.
      const neighbors = getReachableNodes(map);
      expect(neighbors.length).toBe(0);

      const cleared = markCurrentNodeCleared(map);
      expect(cleared?.state).toBe("CLEARED");
      expect(countClearedNodes(map)).toBe(1);

      const postClearReachable = getReachableNodes(map);
      expect(postClearReachable.length).toBeGreaterThan(0);
      expect(postClearReachable.every((n) => n.state === "UNVISITED")).toBe(true);

      // Cannot re-enter cleared node.
      expect(canEnterNode(map, "0,0")).toBe(false);
      expect(moveToNode(map, "0,0")).toBeNull();
    });

    it("returns null on illegal entry attempts", () => {
      const map = createDelveMap(12345);
      expect(moveToNode(map, "999,999")).toBeNull();
      expect(moveToNode(map, "0,0")?.id).toBe("0,0");
      // Attempt to hop while current node is still ACTIVE.
      const neighborId = map.edges.find((e) => e.from === "0,0")?.to ?? null;
      if (neighborId) {
        expect(moveToNode(map, neighborId)).toBeNull();
      }
    });
  });

  describe("ensureAdjacentNodes", () => {
    it("creates at least one deeper path", () => {
      const map = createDelveMap(12345);
      ensureAdjacentNodes(map, "0,0", 12345);

      const hasDeeper = map.edges.some(
        (e) => (e.from === "0,0" && e.to === "0,1") || (e.from === "0,1" && e.to === "0,0"),
      );
      expect(hasDeeper).toBe(true);
    });
  });

  describe("serialization helpers", () => {
    it("serializes nodeId/state pairs and hydrates known nodes only", () => {
      const map = createDelveMap(777);
      const start = markNodeActive(map, "0,0");
      expect(start?.state).toBe("ACTIVE");
      markCurrentNodeCleared(map);

      const serialized = serializeNodeStates(map);
      const startRow = serialized.find((r) => r.nodeId === "0,0");
      expect(startRow?.state).toBe("CLEARED");

      const patchRows: Array<{ nodeId: string; state: DelveNodeState }> = [
        { nodeId: "0,0", state: "ACTIVE" },
        { nodeId: "NOT_A_NODE", state: "CLEARED" },
      ];
      hydrateNodeStates(map, patchRows);

      expect(map.nodes.get("0,0")?.state).toBe("ACTIVE");
      expect(map.currentNodeId).toBe("0,0");
    });
  });

  describe("getVisibleNodes", () => {
    it("filters by radius from current position", () => {
      const map = createDelveMap(12345);
      moveToNode(map, "0,0");
      markCurrentNodeCleared(map);
      // Generate a larger map
      for (let i = 0; i < 8; i++) {
        const nodes = Array.from(map.nodes.values());
        for (let j = 0; j < nodes.length; j++) {
          ensureAdjacentNodes(map, nodes[j].id, 5000 + i);
        }
      }

      // Force active/current at depth y=5 using hydrate helper
      if (map.nodes.has("0,5")) {
        hydrateNodeStates(map, [{ nodeId: "0,5", state: "ACTIVE" }]);
      }
      const visible = getVisibleNodes(map, 2);
      const current = map.currentNodeId ? map.nodes.get(map.currentNodeId) ?? null : null;
      if (!current) return;

      for (let i = 0; i < visible.length; i++) {
        const node = visible[i];
        expect(Math.abs(node.x - current.x)).toBeLessThanOrEqual(2);
        expect(Math.abs(node.y - current.y)).toBeLessThanOrEqual(2);
      }
    });
  });
});
