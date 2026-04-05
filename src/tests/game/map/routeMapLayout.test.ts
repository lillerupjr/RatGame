import { describe, expect, test } from "vitest";
import { buildRouteMapLayout, computeScrollTopForNode } from "../../../game/map/routeMapLayout";
import type { RouteMapVM } from "../../../game/map/routeMapView";

const vm: RouteMapVM = {
  mode: "DELVE",
  currentNodeId: "n2",
  currentDepth: 2,
  depthWindow: { start: 1, end: 4 },
  rowCount: 4,
  nodes: [
    {
      id: "n1",
      mode: "DELVE",
      visualType: "combat",
      zoneId: "DOCKS",
      depth: 1,
      rowIndex: 0,
      laneIndex: 1,
      laneCount: 5,
      status: "COMPLETED",
      reachable: false,
      current: false,
      completed: true,
      title: "N1",
      subtitle: "r1",
      iconText: "C",
      kindLabel: "Combat",
    },
    {
      id: "n2",
      mode: "DELVE",
      visualType: "shop",
      zoneId: "DOCKS",
      depth: 2,
      rowIndex: 1,
      laneIndex: 2,
      laneCount: 5,
      status: "CURRENT",
      reachable: true,
      current: true,
      completed: false,
      title: "N2",
      subtitle: "r2",
      iconText: "$",
      kindLabel: "Shop",
    },
    {
      id: "n3",
      mode: "DELVE",
      visualType: "boss",
      zoneId: "DOCKS",
      depth: 4,
      rowIndex: 3,
      laneIndex: 2,
      laneCount: 5,
      status: "LOCKED",
      reachable: false,
      current: false,
      completed: false,
      title: "N3",
      subtitle: "r4",
      iconText: "B",
      kindLabel: "Boss",
    },
  ],
  edges: [
    { fromId: "n1", toId: "n2" },
    { fromId: "n2", toId: "n3" },
  ],
};

describe("routeMapLayout", () => {
  test("lane mapping is deterministic", () => {
    const a = buildRouteMapLayout(vm, 900);
    const b = buildRouteMapLayout(vm, 900);
    const na = a.nodeLayouts.get("n2");
    const nb = b.nodeLayouts.get("n2");
    expect(na?.lane).toBe(nb?.lane);
    expect(na?.x).toBe(nb?.x);
  });

  test("explicit row indexes map downward", () => {
    const layout = buildRouteMapLayout(vm, 900);
    const y1 = layout.nodeLayouts.get("n1")?.y ?? 0;
    const y2 = layout.nodeLayouts.get("n2")?.y ?? 0;
    const y3 = layout.nodeLayouts.get("n3")?.y ?? 0;
    expect(y2).toBeGreaterThan(y1);
    expect(y3).toBeGreaterThan(y2);
  });

  test("edge layout uses bezier paths anchored at node centers", () => {
    const layout = buildRouteMapLayout(vm, 900);
    const from = layout.nodeLayouts.get("n1");
    const to = layout.nodeLayouts.get("n2");
    expect(layout.edgeLayouts[0]?.pathD).toContain("M ");
    expect(layout.edgeLayouts[0]?.pathD).toContain(" C ");
    expect(layout.edgeLayouts[0]?.pathD.startsWith(`M ${from?.x} ${from?.y}`)).toBe(true);
    expect(layout.edgeLayouts[0]?.pathD.endsWith(`${to?.x} ${to?.y}`)).toBe(true);
  });

  test("computeScrollTopForNode centers and clamps", () => {
    expect(computeScrollTopForNode(400, 600, 1000)).toBe(100);
    expect(computeScrollTopForNode(20, 600, 1000)).toBe(0);
    expect(computeScrollTopForNode(980, 600, 1000)).toBe(400);
  });
});
