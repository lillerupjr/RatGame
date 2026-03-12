import { describe, expect, test } from "vitest";
import type { DelveMap, DelveNode, DelveNodeState } from "../../../game/map/delveMap";
import { buildDelveRouteMapVM, buildDeterministicRouteMapVM } from "../../../game/map/routeMapView";

function mkNode(
  id: string,
  x: number,
  y: number,
  state: DelveNodeState = "UNVISITED",
): DelveNode {
  return {
    id,
    x,
    y,
    zoneId: "DOCKS",
    floorArchetype: "SURVIVE",
    plan: {
      depth: y + 1,
      mapId: "docks",
      objectiveId: "SURVIVE_TIMER",
      variantSeed: 1,
    },
    title: `${id}`,
    state,
  };
}

describe("routeMapView", () => {
  test("buildDelveRouteMapVM applies statuses and depth window with forced reachable nodes", () => {
    const nodes = new Map<string, DelveNode>();
    const A = mkNode("0,0", 0, 0, "CLEARED");
    const B = mkNode("0,1", 0, 1, "CLEARED");
    const C = mkNode("0,2", 0, 2, "CLEARED");
    const D = mkNode("1,2", 1, 2, "UNVISITED");
    const E = mkNode("0,3", 0, 3, "UNVISITED");
    const G = mkNode("0,11", 0, 11, "UNVISITED"); // outside normal window, but reachable
    const H = mkNode("-1,9", -1, 9, "CLEARED"); // in window and must stay completed
    const F = mkNode("0,12", 0, 12, "UNVISITED"); // outside window and not reachable
    [A, B, C, D, E, F, G, H].forEach((n) => nodes.set(n.id, n));

    const map: DelveMap = {
      nodes,
      edges: [
        { from: A.id, to: B.id },
        { from: B.id, to: C.id },
        { from: C.id, to: D.id },
        { from: C.id, to: E.id },
        { from: C.id, to: G.id },
        { from: E.id, to: H.id },
        { from: E.id, to: F.id },
      ],
      currentNodeId: C.id,
      exploredDepth: 2,
    };

    const vm = buildDelveRouteMapVM(map, { windowBack: 2, windowForward: 8 });
    const byId = new Map(vm.nodes.map((n) => [n.id, n]));

    expect(vm.currentDepth).toBe(3);
    expect(vm.depthWindow).toEqual({ start: 1, end: 11 });

    expect(byId.get(C.id)?.status).toBe("CURRENT");
    expect(byId.get(G.id)?.status).toBe("REACHABLE");
    expect(byId.get(H.id)?.status).toBe("COMPLETED");
    expect(byId.get(A.id)?.status).toBe("COMPLETED");

    expect(byId.has(G.id)).toBe(true); // forced include reachable, even outside window
    expect(byId.has(F.id)).toBe(false); // outside window and not reachable

    expect(vm.edges.some((e) => e.fromId === C.id && e.toId === G.id)).toBe(true);
    expect(vm.edges.some((e) => e.fromId === E.id && e.toId === F.id)).toBe(false);
  });

  test("buildDelveRouteMapVM labels PoE objective nodes", () => {
    const poe = mkNode("0,0", 0, 0, "UNVISITED");
    poe.plan.objectiveId = "POE_MAP_CLEAR";
    const map: DelveMap = {
      nodes: new Map([[poe.id, poe]]),
      edges: [],
      currentNodeId: null,
      exploredDepth: 0,
    };

    const vm = buildDelveRouteMapVM(map);
    expect(vm.nodes).toHaveLength(1);
    expect(vm.nodes[0].title).toBe("PoE Map");
    expect(vm.nodes[0].subtitle).toContain("Depth 1");
  });

  test("buildDeterministicRouteMapVM builds reachable deterministic nodes", () => {
    const vm = buildDeterministicRouteMapVM(
      [
        { archetype: "SURVIVE" },
        { archetype: "SURVIVE", objectiveId: "POE_MAP_CLEAR", title: "PoE Map" },
        { archetype: "TIME_TRIAL" },
        { archetype: "VENDOR" },
        { archetype: "HEAL" },
        { archetype: "BOSS_TRIPLE" },
      ],
      2,
      5,
    );
    expect(vm.mode).toBe("DETERMINISTIC");
    expect(vm.nodes.length).toBe(6);
    expect(vm.edges.length).toBe(0);
    const poeNode = vm.nodes.find((node) => node.title === "PoE Map");
    expect(poeNode?.deterministicData?.objectiveId).toBe("POE_MAP_CLEAR");
    for (const node of vm.nodes) {
      expect(node.status).toBe("REACHABLE");
      expect(node.reachable).toBe(true);
      expect(node.depth).toBe(5);
      expect(node.deterministicData?.floorIndex).toBe(2);
      expect(node.deterministicData?.depth).toBe(5);
    }
  });
});
