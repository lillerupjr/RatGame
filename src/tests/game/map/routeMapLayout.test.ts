import { describe, expect, test } from "vitest";
import { buildRouteMapLayout, computeScrollTopForNode } from "../../../game/map/routeMapLayout";
import type { RouteMapVM } from "../../../game/map/routeMapView";

const vm: RouteMapVM = {
  mode: "DELVE",
  currentNodeId: "n2",
  currentDepth: 2,
  depthWindow: { start: 1, end: 4 },
  nodes: [
    {
      id: "n1",
      mode: "DELVE",
      archetype: "SURVIVE",
      zoneId: "DOCKS",
      depth: 1,
      x: -1,
      status: "COMPLETED",
      reachable: false,
      current: false,
      completed: true,
      title: "N1",
      subtitle: "d1",
    },
    {
      id: "n2",
      mode: "DELVE",
      archetype: "SURVIVE",
      zoneId: "DOCKS",
      depth: 2,
      x: 0,
      status: "CURRENT",
      reachable: true,
      current: true,
      completed: false,
      title: "N2",
      subtitle: "d2",
    },
    {
      id: "n3",
      mode: "DELVE",
      archetype: "SURVIVE",
      zoneId: "DOCKS",
      depth: 4,
      x: 1,
      status: "LOCKED",
      reachable: false,
      current: false,
      completed: false,
      title: "N3",
      subtitle: "d4",
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

  test("depth maps downward (higher depth -> larger y)", () => {
    const layout = buildRouteMapLayout(vm, 900);
    const y1 = layout.nodeLayouts.get("n1")?.y ?? 0;
    const y2 = layout.nodeLayouts.get("n2")?.y ?? 0;
    const y3 = layout.nodeLayouts.get("n3")?.y ?? 0;
    expect(y2).toBeGreaterThan(y1);
    expect(y3).toBeGreaterThan(y2);
  });

  test("computeScrollTopForNode centers and clamps", () => {
    expect(computeScrollTopForNode(400, 600, 1000)).toBe(100);
    expect(computeScrollTopForNode(20, 600, 1000)).toBe(0);
    expect(computeScrollTopForNode(980, 600, 1000)).toBe(400);
  });
});

