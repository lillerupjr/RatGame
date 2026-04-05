import { describe, expect, it, test } from "vitest";
import {
  canEnterNode,
  clearPendingNode,
  commitPendingNode,
  countClearedNodes,
  createDelveMap,
  floorArchetypeForNode,
  getDepthScaling,
  getNodeDepth,
  getReachableNodes,
  hydrateNodeStates,
  markCurrentNodeCleared,
  markRunLost,
  moveToNode,
  serializeNodeStates,
  type DelveMap,
  type DelveNode,
} from "../../../game/map/delveMap";

function getNode(map: DelveMap, rowIndex: number, laneIndex: number): DelveNode {
  const node = map.nodes.get(`act:${rowIndex}:${laneIndex}`);
  if (!node) throw new Error(`Missing node act:${rowIndex}:${laneIndex}`);
  return node;
}

describe("delve act map", () => {
  test("creates a finite act map with required wrapper fields", () => {
    const map = createDelveMap(12345);

    expect(map.seed).toBeDefined();
    expect(map.actLengthRows).toBe(8);
    expect(map.laneCount).toBe(5);
    expect(map.startNodeIds).toHaveLength(3);
    expect(map.currentNodeId).toBeNull();
    expect(map.pendingNodeId).toBeNull();
    expect(map.runStatus).toBe("IN_PROGRESS");
    expect(map.bossNodeId).toMatch(/^act:7:/);
  });

  test("supports configurable row count and clamps to minimum act length", () => {
    const short = createDelveMap(123, { rowCount: 2 });
    const longer = createDelveMap(123, { rowCount: 10, laneCount: 6 });

    expect(short.actLengthRows).toBe(4);
    expect(longer.actLengthRows).toBe(10);
    expect(longer.laneCount).toBe(6);
  });

  test("forces combat start row, rest pre-boss row, and single boss row", () => {
    const map = createDelveMap(77);
    const row0 = Array.from(map.nodes.values()).filter((node) => node.rowIndex === 0);
    const preBoss = Array.from(map.nodes.values()).filter((node) => node.rowIndex === map.actLengthRows - 2);
    const bossRow = Array.from(map.nodes.values()).filter((node) => node.rowIndex === map.actLengthRows - 1);

    expect(row0.every((node) => node.nodeType === "COMBAT")).toBe(true);
    expect(preBoss.length).toBeGreaterThanOrEqual(2);
    expect(preBoss.every((node) => node.nodeType === "REST")).toBe(true);
    expect(bossRow).toHaveLength(1);
    expect(bossRow[0].nodeType).toBe("BOSS");
    expect(map.bossNodeId).toBe(bossRow[0].id);
  });

  test("never generates dormant node types in v1", () => {
    const map = createDelveMap(555);
    const dormant = Array.from(map.nodes.values()).filter(
      (node) => node.nodeType === "ELITE" || node.nodeType === "QUESTION_MARK",
    );
    expect(dormant).toHaveLength(0);
  });

  test("graph stays row-based, connected, and boss-reachable", () => {
    const map = createDelveMap(999);
    const ids = new Set(map.nodes.keys());
    const inbound = new Map<string, number>();
    const outbound = new Map<string, number>();

    for (const edge of map.edges) {
      const from = map.nodes.get(edge.from);
      const to = map.nodes.get(edge.to);
      expect(from).toBeTruthy();
      expect(to).toBeTruthy();
      expect(to!.rowIndex).toBe(from!.rowIndex + 1);
      expect(Math.abs(to!.laneIndex - from!.laneIndex)).toBeLessThanOrEqual(1);
      inbound.set(edge.to, (inbound.get(edge.to) ?? 0) + 1);
      outbound.set(edge.from, (outbound.get(edge.from) ?? 0) + 1);
    }

    for (const node of map.nodes.values()) {
      if (node.rowIndex === 0) continue;
      expect((inbound.get(node.id) ?? 0) > 0).toBe(true);
      if (node.id === map.bossNodeId) continue;
      expect((outbound.get(node.id) ?? 0) > 0).toBe(true);
      expect((outbound.get(node.id) ?? 0)).toBeLessThanOrEqual(2);
    }

    const seen = new Set<string>(map.startNodeIds);
    const queue = [...map.startNodeIds];
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      for (const edge of map.edges) {
        if (edge.from !== current || seen.has(edge.to)) continue;
        seen.add(edge.to);
        queue.push(edge.to);
      }
    }
    expect(seen.size).toBe(ids.size);
    expect(seen.has(map.bossNodeId)).toBe(true);
  });

  test("graph keeps only immediate-neighbor row transitions across many seeds", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const map = createDelveMap(seed * 97);
      const outbound = new Map<string, number>();
      for (const edge of map.edges) {
        const from = map.nodes.get(edge.from);
        const to = map.nodes.get(edge.to);
        expect(from).toBeTruthy();
        expect(to).toBeTruthy();
        expect(to!.rowIndex).toBe(from!.rowIndex + 1);
        expect(Math.abs(to!.laneIndex - from!.laneIndex)).toBeLessThanOrEqual(1);
        outbound.set(edge.from, (outbound.get(edge.from) ?? 0) + 1);
      }
      for (const node of map.nodes.values()) {
        if (node.id === map.bossNodeId) continue;
        expect((outbound.get(node.id) ?? 0)).toBeGreaterThan(0);
        expect((outbound.get(node.id) ?? 0)).toBeLessThanOrEqual(2);
      }
    }
  });

  test("selection stays pending until committed and completion unlocks outgoing children only", () => {
    const map = createDelveMap(321);
    const startReachable = getReachableNodes(map);
    expect(startReachable.map((node) => node.rowIndex)).toEqual([0, 0, 0]);

    const selected = moveToNode(map, startReachable[0].id);
    expect(selected?.id).toBe(startReachable[0].id);
    expect(map.pendingNodeId).toBe(startReachable[0].id);
    expect(map.currentNodeId).toBeNull();
    expect(getReachableNodes(map)).toEqual([]);

    const active = commitPendingNode(map, startReachable[0].id);
    expect(active?.id).toBe(startReachable[0].id);
    expect(map.pendingNodeId).toBeNull();
    expect(map.currentNodeId).toBe(startReachable[0].id);
    expect(getReachableNodes(map)).toEqual([]);

    const cleared = markCurrentNodeCleared(map);
    expect(cleared?.id).toBe(startReachable[0].id);
    expect(countClearedNodes(map)).toBe(1);
    const next = getReachableNodes(map);
    expect(next.length).toBeGreaterThan(0);
    expect(next.every((node) => node.rowIndex === 1)).toBe(true);
  });

  test("clearing one parent unlocks a merged child without requiring all parents", () => {
    const map = createDelveMap(1901, { rowCount: 5 });
    const row0 = Array.from(map.nodes.values()).filter((node) => node.rowIndex === 0);
    const row1 = Array.from(map.nodes.values()).filter((node) => node.rowIndex === 1);
    const mergedChild = row1.find((node) => {
      let parents = 0;
      for (const edge of map.edges) {
        if (edge.to === node.id) parents++;
      }
      return parents >= 2;
    });

    if (!mergedChild) {
      expect(row0.length).toBeGreaterThan(0);
      return;
    }

    const parentEdge = map.edges.find((edge) => edge.to === mergedChild.id);
    expect(parentEdge).toBeTruthy();
    moveToNode(map, parentEdge!.from);
    commitPendingNode(map, parentEdge!.from);
    markCurrentNodeCleared(map);

    const reachableIds = new Set(getReachableNodes(map).map((node) => node.id));
    expect(reachableIds.has(mergedChild.id)).toBe(true);
  });

  test("pending node selection can be safely cleared after a failed load", () => {
    const map = createDelveMap(456);
    const startNode = getReachableNodes(map)[0];
    moveToNode(map, startNode.id);
    expect(map.pendingNodeId).toBe(startNode.id);
    clearPendingNode(map, startNode.id);
    expect(map.pendingNodeId).toBeNull();
    expect(canEnterNode(map, startNode.id)).toBe(true);
  });

  test("serialization round-trips cleared and active nodes", () => {
    const map = createDelveMap(678);
    const start = getReachableNodes(map)[0];
    moveToNode(map, start.id);
    commitPendingNode(map, start.id);
    markCurrentNodeCleared(map);

    const rows = serializeNodeStates(map);
    const row = rows.find((entry) => entry.nodeId === start.id);
    expect(row?.state).toBe("CLEARED");

    hydrateNodeStates(map, [{ nodeId: start.id, state: "ACTIVE" }]);
    expect(map.currentNodeId).toBe(start.id);
    expect(map.completedNodeIds.has(start.id)).toBe(false);
  });

  test("floor intent helpers stay compatible with runtime archetypes", () => {
    const map = createDelveMap(42);
    const combat = map.startNodeIds.map((id) => map.nodes.get(id)).find(Boolean);
    expect(combat).toBeTruthy();
    expect(["SURVIVE", "TIME_TRIAL"]).toContain(floorArchetypeForNode(combat!));

    const rest = Array.from(map.nodes.values()).find((node) => node.nodeType === "REST");
    const boss = map.nodes.get(map.bossNodeId);
    expect(floorArchetypeForNode(rest!)).toBe("HEAL");
    expect(floorArchetypeForNode(boss!)).toBe("BOSS_TRIPLE");
  });
});

describe("depth helpers", () => {
  it("returns rowIndex + 1", () => {
    expect(getNodeDepth({ rowIndex: 4 } as DelveNode)).toBe(5);
  });

  it("returns baseline scaling at depth 1", () => {
    const scaling = getDepthScaling(1);
    expect(scaling.hpMult).toBe(1);
    expect(scaling.damageMult).toBe(1);
    expect(scaling.spawnRateMult).toBe(1);
  });

  it("marks run lost explicitly", () => {
    const map = createDelveMap(88);
    markRunLost(map);
    expect(map.runStatus).toBe("LOST");
  });
});
