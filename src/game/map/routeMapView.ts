import type { StageId } from "../content/stages";
import type { DelveMap, DelveNode } from "./delveMap";
import { getReachableNodes } from "./delveMap";
import type { FloorArchetype } from "./floorArchetype";
import type { ObjectiveId } from "./objectivePlan";

export type RouteMapMode = "DELVE" | "DETERMINISTIC";

export type RouteNodeStatus = "CURRENT" | "REACHABLE" | "LOCKED" | "COMPLETED";

export type RouteNodeVM = {
  id: string;
  mode: RouteMapMode;
  archetype: FloorArchetype;
  zoneId: StageId | "DETERMINISTIC";
  depth: number;
  x: number;
  status: RouteNodeStatus;
  reachable: boolean;
  current: boolean;
  completed: boolean;
  title: string;
  subtitle: string;
  deterministicData?: {
    floorIndex: number;
    depth: number;
    archetype: FloorArchetype;
    objectiveId?: ObjectiveId;
  };
};

export type DeterministicRouteOption = {
  archetype: FloorArchetype;
  objectiveId?: ObjectiveId;
  title?: string;
  subtitle?: string;
};

export type RouteEdgeVM = {
  fromId: string;
  toId: string;
};

export type RouteMapVM = {
  mode: RouteMapMode;
  nodes: RouteNodeVM[];
  edges: RouteEdgeVM[];
  currentNodeId: string | null;
  currentDepth: number;
  depthWindow: {
    start: number;
    end: number;
  };
};

export type BuildDelveRouteMapOptions = {
  windowBack?: number;
  windowForward?: number;
};

function statusForNode(node: DelveNode, isCurrent: boolean, reachableIds: Set<string>): RouteNodeStatus {
  if (isCurrent) return "CURRENT";
  if (node.state === "CLEARED") return "COMPLETED";
  if (reachableIds.has(node.id) && node.state === "UNVISITED") return "REACHABLE";
  return "LOCKED";
}

function nodeDepth(node: DelveNode): number {
  return node.y + 1;
}

export function buildDelveRouteMapVM(
  delveMap: DelveMap,
  options?: BuildDelveRouteMapOptions,
): RouteMapVM {
  const windowBack = Math.max(0, options?.windowBack ?? 2);
  const windowForward = Math.max(0, options?.windowForward ?? 8);
  const currentNode = delveMap.currentNodeId ? delveMap.nodes.get(delveMap.currentNodeId) ?? null : null;
  const currentDepth = currentNode ? nodeDepth(currentNode) : 1;
  const depthWindow = {
    start: Math.max(1, currentDepth - windowBack),
    end: currentDepth + windowForward,
  };

  const reachableIds = new Set(getReachableNodes(delveMap).map((n) => n.id));
  const visibleNodeIds = new Set<string>();

  for (const node of delveMap.nodes.values()) {
    const depth = nodeDepth(node);
    if (depth >= depthWindow.start && depth <= depthWindow.end) {
      visibleNodeIds.add(node.id);
    }
  }
  if (delveMap.currentNodeId) visibleNodeIds.add(delveMap.currentNodeId);
  reachableIds.forEach((id) => visibleNodeIds.add(id));

  const nodes: RouteNodeVM[] = [];
  for (const node of delveMap.nodes.values()) {
    if (!visibleNodeIds.has(node.id)) continue;
    const isCurrent = node.id === delveMap.currentNodeId;
    nodes.push({
      id: node.id,
      mode: "DELVE",
      archetype: node.floorArchetype,
      zoneId: node.zoneId,
      depth: nodeDepth(node),
      x: node.x,
      status: statusForNode(node, isCurrent, reachableIds),
      reachable: reachableIds.has(node.id) && node.state === "UNVISITED",
      current: isCurrent,
      completed: node.state === "CLEARED",
      title: node.title,
      subtitle: `Depth ${nodeDepth(node)}`,
    });
  }

  const edges: RouteEdgeVM[] = [];
  for (const edge of delveMap.edges) {
    if (!visibleNodeIds.has(edge.from) || !visibleNodeIds.has(edge.to)) continue;
    edges.push({
      fromId: edge.from,
      toId: edge.to,
    });
  }

  nodes.sort((a, b) => (a.depth - b.depth) || (a.x - b.x) || a.id.localeCompare(b.id));

  return {
    mode: "DELVE",
    nodes,
    edges,
    currentNodeId: delveMap.currentNodeId,
    currentDepth,
    depthWindow,
  };
}

export function buildDeterministicRouteMapVM(
  options: DeterministicRouteOption[],
  floorIndex: number,
  depth: number,
): RouteMapVM {
  const centeredOffset = (options.length - 1) * 0.5;
  const nodes: RouteNodeVM[] = options.map((choice, i) => ({
    id: `det-${floorIndex}-${depth}-${choice.archetype}-${choice.objectiveId ?? "AUTO"}-${i}`,
    mode: "DETERMINISTIC",
    archetype: choice.archetype,
    zoneId: "DETERMINISTIC",
    depth,
    x: i - centeredOffset,
    status: "REACHABLE",
    reachable: true,
    current: false,
    completed: false,
    title: choice.title ?? choice.archetype,
    subtitle: choice.subtitle ?? `Depth ${depth}`,
    deterministicData: {
      floorIndex,
      depth,
      archetype: choice.archetype,
      objectiveId: choice.objectiveId,
    },
  }));

  return {
    mode: "DETERMINISTIC",
    nodes,
    edges: [],
    currentNodeId: null,
    currentDepth: depth,
    depthWindow: {
      start: depth,
      end: depth,
    },
  };
}
