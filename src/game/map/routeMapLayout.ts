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
  x1: number;
  y1: number;
  x2: number;
  y2: number;
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
  laneCountMin?: number;
  laneCountMax?: number;
  rowHeight?: number;
  topPadding?: number;
  bottomPadding?: number;
  sidePadding?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function laneFromX(x: number, minX: number, maxX: number, laneCount: number): number {
  if (laneCount <= 1) return 0;
  const range = maxX - minX;
  if (range <= 0.0001) return Math.floor((laneCount - 1) * 0.5);
  const t = (x - minX) / range;
  return clamp(Math.round(t * (laneCount - 1)), 0, laneCount - 1);
}

export function buildRouteMapLayout(
  vm: RouteMapVM,
  viewportWidth: number,
  options?: BuildRouteLayoutOptions,
): RouteMapLayout {
  const laneCountMin = Math.max(1, Math.floor(options?.laneCountMin ?? 5));
  const laneCountMax = Math.max(laneCountMin, Math.floor(options?.laneCountMax ?? 7));
  const rowHeight = Math.max(80, Math.floor(options?.rowHeight ?? 132));
  const topPadding = Math.max(0, Math.floor(options?.topPadding ?? 84));
  const bottomPadding = Math.max(0, Math.floor(options?.bottomPadding ?? 120));
  const sidePadding = Math.max(0, Math.floor(options?.sidePadding ?? 76));
  const contentWidth = Math.max(320, Math.floor(viewportWidth || 960));

  const nodeLayouts = new Map<string, RouteNodeLayout>();
  const xValues = vm.nodes.map((n) => n.x);
  const minX = xValues.length ? Math.min(...xValues) : 0;
  const maxX = xValues.length ? Math.max(...xValues) : 0;
  const uniqueXCount = new Set(xValues.map((x) => x.toFixed(4))).size;
  const laneCount = clamp(uniqueXCount || 1, laneCountMin, laneCountMax);
  const depthStart = vm.depthWindow.start;
  const depthEnd = Math.max(vm.depthWindow.end, vm.currentDepth, depthStart);
  const depthRows = Math.max(1, depthEnd - depthStart + 1);
  const contentHeight = topPadding + bottomPadding + depthRows * rowHeight;
  const laneSpanPx = Math.max(1, contentWidth - sidePadding * 2);
  const laneStepPx = laneCount <= 1 ? 0 : laneSpanPx / (laneCount - 1);

  for (const node of vm.nodes) {
    const lane = laneFromX(node.x, minX, maxX, laneCount);
    const x = sidePadding + lane * laneStepPx;
    const y = topPadding + (node.depth - depthStart) * rowHeight + rowHeight * 0.5;
    nodeLayouts.set(node.id, { id: node.id, lane, x, y });
  }

  const edgeLayouts: RouteEdgeLayout[] = [];
  for (const edge of vm.edges) {
    const from = nodeLayouts.get(edge.fromId);
    const to = nodeLayouts.get(edge.toId);
    if (!from || !to) continue;
    edgeLayouts.push({
      fromId: edge.fromId,
      toId: edge.toId,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
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

