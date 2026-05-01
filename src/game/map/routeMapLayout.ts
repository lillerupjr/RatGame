import type { RouteMapVM } from "./routeMapView";

export type RouteNodeLayout = {
  id: string;
  lane: number;
  x: number;
  y: number;
};

export type RouteEdgeLayout = {
  fromId: string;
  toId: string;
  pathD: string;
};

export type RouteMapLayout = {
  laneCount: number;
  contentWidth: number;
  contentHeight: number;
  rowHeight: number;
  nodeLayouts: Map<string, RouteNodeLayout>;
  edgeLayouts: RouteEdgeLayout[];
};

export type BuildRouteLayoutOptions = {
  rowHeight?: number;
  topPadding?: number;
  bottomPadding?: number;
  sidePadding?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildRouteMapLayout(
  vm: RouteMapVM,
  viewportWidth: number,
  options?: BuildRouteLayoutOptions,
): RouteMapLayout {
  const rowHeight = Math.max(80, Math.floor(options?.rowHeight ?? 148));
  const topPadding = Math.max(0, Math.floor(options?.topPadding ?? 84));
  const bottomPadding = Math.max(0, Math.floor(options?.bottomPadding ?? 120));
  const sidePadding = Math.max(0, Math.floor(options?.sidePadding ?? 76));
  const laneCount = Math.max(
    1,
    vm.nodes.reduce((max, node) => Math.max(max, node.laneCount), 1),
  );
  const contentWidth = Math.max(320, Math.floor(viewportWidth || 960));
  const contentHeight = topPadding + bottomPadding + Math.max(1, vm.rowCount) * rowHeight;
  const laneSpanPx = Math.max(1, contentWidth - sidePadding * 2);
  const laneStepPx = laneCount <= 1 ? 0 : laneSpanPx / (laneCount - 1);

  const nodeLayouts = new Map<string, RouteNodeLayout>();
  for (let i = 0; i < vm.nodes.length; i++) {
    const node = vm.nodes[i];
    const lane = clamp(node.laneIndex, 0, Math.max(0, laneCount - 1));
    const x = laneCount <= 1
      ? sidePadding + laneSpanPx * 0.5
      : sidePadding + lane * laneStepPx;
    const y = topPadding + node.rowIndex * rowHeight + rowHeight * 0.5;
    nodeLayouts.set(node.id, {
      id: node.id,
      lane,
      x,
      y,
    });
  }

  const edgeLayouts: RouteEdgeLayout[] = [];
  for (let i = 0; i < vm.edges.length; i++) {
    const edge = vm.edges[i];
    const from = nodeLayouts.get(edge.fromId);
    const to = nodeLayouts.get(edge.toId);
    if (!from || !to) continue;
    const deltaY = to.y - from.y;
    const cp1x = from.x;
    const cp1y = from.y + deltaY * 0.38;
    const cp2x = to.x;
    const cp2y = to.y - deltaY * 0.38;
    edgeLayouts.push({
      fromId: edge.fromId,
      toId: edge.toId,
      pathD: `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`,
    });
  }

  return {
    laneCount,
    contentWidth,
    contentHeight,
    rowHeight,
    nodeLayouts,
    edgeLayouts,
  };
}

export function computeScrollTopForNode(
  nodeCenterY: number,
  viewportHeight: number,
  contentHeight: number,
): number {
  const vh = Math.max(1, Math.floor(viewportHeight));
  const ch = Math.max(1, Math.floor(contentHeight));
  const maxTop = Math.max(0, ch - vh);
  const raw = nodeCenterY - vh * 0.5;
  return clamp(raw, 0, maxTop);
}
