import { describe, expect, test } from "vitest";
import type { DelveMap, DelveNode } from "../../../game/map/delveMap";
import { buildDelveRouteMapVM, buildDeterministicRouteMapVM } from "../../../game/map/routeMapView";

function node(
  id: string,
  rowIndex: number,
  laneIndex: number,
  nodeType: DelveNode["nodeType"] = "COMBAT",
): DelveNode {
  return {
    id,
    rowIndex,
    laneIndex,
    nodeType,
    combatSubtype: nodeType === "COMBAT" ? "SURVIVE_TIMER" : undefined,
    outgoingNodeIds: [],
    runtime: {
      zoneId: "DOCKS",
      mapId: nodeType === "SHOP" ? "SHOP" : nodeType === "REST" ? "REST" : "docks",
      objectiveId:
        nodeType === "SHOP"
          ? "VENDOR_VISIT"
          : nodeType === "REST"
            ? "HEAL_VISIT"
            : nodeType === "BOSS"
              ? "ACT_BOSS"
              : "SURVIVE_TIMER",
      variantSeed: 1,
      bossId: nodeType === "BOSS" ? "chem_guy" : undefined,
    },
    contentEnabled: true,
  };
}

describe("routeMapView", () => {
  test("buildDelveRouteMapVM exposes row/lane layout and current/completed state", () => {
    const start = node("act:0:1", 0, 1);
    const next = node("act:1:2", 1, 2, "SHOP");
    const boss = node("act:2:2", 2, 2, "BOSS");
    start.outgoingNodeIds = [next.id];
    next.outgoingNodeIds = [boss.id];

    const map: DelveMap = {
      seed: 1,
      actLengthRows: 3,
      laneCount: 5,
      nodes: new Map([
        [start.id, start],
        [next.id, next],
        [boss.id, boss],
      ]),
      edges: [
        { from: start.id, to: next.id },
        { from: next.id, to: boss.id },
      ],
      startNodeIds: [start.id],
      bossNodeId: boss.id,
      completedNodeIds: new Set([start.id]),
      currentNodeId: start.id,
      pendingNodeId: null,
      runStatus: "IN_PROGRESS",
    };

    const vm = buildDelveRouteMapVM(map, { showCombatSubtypes: false });
    const byId = new Map(vm.nodes.map((entry) => [entry.id, entry]));

    expect(vm.rowCount).toBe(3);
    expect(vm.depthWindow).toEqual({ start: 1, end: 3 });
    expect(byId.get(start.id)?.status).toBe("CURRENT");
    expect(byId.get(start.id)?.completed).toBe(true);
    expect(byId.get(start.id)?.subtitle).toBe("Docks · Row 1");
    expect(byId.get(next.id)?.status).toBe("REACHABLE");
    expect(byId.get(next.id)?.visualType).toBe("shop");
    expect(byId.get(boss.id)?.status).toBe("LOCKED");
    expect(byId.get(boss.id)?.visualType).toBe("boss");
  });

  test("combat subtype toggle changes title without changing node type", () => {
    const start = node("act:0:1", 0, 1);
    start.combatSubtype = "POE_MAP_CLEAR";
    start.runtime.objectiveId = "POE_MAP_CLEAR";
    const map: DelveMap = {
      seed: 1,
      actLengthRows: 1,
      laneCount: 5,
      nodes: new Map([[start.id, start]]),
      edges: [],
      startNodeIds: [start.id],
      bossNodeId: start.id,
      completedNodeIds: new Set<string>(),
      currentNodeId: null,
      pendingNodeId: null,
      runStatus: "IN_PROGRESS",
    };

    const hidden = buildDelveRouteMapVM(map, { showCombatSubtypes: false });
    const shown = buildDelveRouteMapVM(map, { showCombatSubtypes: true });

    expect(hidden.nodes[0].title).toBe("Combat");
    expect(shown.nodes[0].title).toBe("PoE Map");
    expect(hidden.nodes[0].combatTagText).toBeUndefined();
    expect(shown.nodes[0].combatTagText).toBe("PoE Map");
    expect(hidden.nodes[0].visualType).toBe("combat");
    expect(shown.nodes[0].visualType).toBe("combat");
  });

  test("buildDeterministicRouteMapVM still produces reachable one-row choices", () => {
    const vm = buildDeterministicRouteMapVM(
      [
        { archetype: "SURVIVE" },
        { archetype: "TIME_TRIAL" },
        { archetype: "VENDOR" },
        { archetype: "HEAL" },
        { archetype: "ACT_BOSS" },
        { archetype: "RARE_TRIPLE" },
      ],
      2,
      5,
    );

    expect(vm.mode).toBe("DETERMINISTIC");
    expect(vm.rowCount).toBe(1);
    expect(vm.nodes).toHaveLength(6);
    expect(vm.edges).toHaveLength(0);
    expect(vm.nodes[0].laneIndex).toBe(0);
    expect(vm.nodes[4].visualType).toBe("boss");
    expect(vm.nodes[4].title).toBe("Boss");
    expect(vm.nodes[5].visualType).toBe("elite");
    for (const routeNode of vm.nodes) {
      expect(routeNode.reachable).toBe(true);
      expect(routeNode.status).toBe("REACHABLE");
      expect(routeNode.deterministicData?.floorIndex).toBe(2);
      expect(routeNode.depth).toBe(5);
    }
  });
});
