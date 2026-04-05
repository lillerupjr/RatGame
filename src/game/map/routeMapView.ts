import type { StageId } from "../content/stages";
import { getReachableNodes, type DelveMap, type DelveNode, type DelveNodeType } from "./delveMap";
import type { FloorArchetype } from "./floorArchetype";
import type { ObjectiveId } from "./objectivePlan";

export type RouteMapMode = "DELVE" | "DETERMINISTIC";

export type RouteNodeStatus = "CURRENT" | "REACHABLE" | "LOCKED" | "COMPLETED";

export type RouteNodeVisualType = "combat" | "rest" | "shop" | "boss" | "elite" | "question-mark";

export type RouteNodeVM = {
  id: string;
  mode: RouteMapMode;
  visualType: RouteNodeVisualType;
  zoneId: StageId | "DETERMINISTIC";
  depth: number;
  rowIndex: number;
  laneIndex: number;
  laneCount: number;
  status: RouteNodeStatus;
  reachable: boolean;
  current: boolean;
  completed: boolean;
  title: string;
  subtitle: string;
  iconText: string;
  combatTagText?: string;
  kindLabel: string;
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
  rowCount: number;
};

export type BuildDelveRouteMapOptions = {
  showCombatSubtypes?: boolean;
};

function statusForNode(node: DelveNode, isCurrent: boolean, reachableIds: Set<string>, map: DelveMap): RouteNodeStatus {
  if (isCurrent) return "CURRENT";
  if (map.completedNodeIds.has(node.id)) return "COMPLETED";
  if (reachableIds.has(node.id)) return "REACHABLE";
  return "LOCKED";
}

function visualTypeForNodeType(nodeType: DelveNodeType): RouteNodeVisualType {
  switch (nodeType) {
    case "REST":
      return "rest";
    case "SHOP":
      return "shop";
    case "BOSS":
      return "boss";
    case "ELITE":
      return "elite";
    case "QUESTION_MARK":
      return "question-mark";
    case "COMBAT":
    default:
      return "combat";
  }
}

function iconForVisualType(visualType: RouteNodeVisualType): string {
  switch (visualType) {
    case "rest":
      return "R";
    case "shop":
      return "$";
    case "boss":
      return "B";
    case "elite":
      return "E";
    case "question-mark":
      return "?";
    case "combat":
    default:
      return "C";
  }
}

function combatSubtypeLabel(objectiveId: ObjectiveId | undefined): string {
  switch (objectiveId) {
    case "POE_MAP_CLEAR":
      return "PoE Map";
    case "ZONE_TRIAL":
      return "Zone Trial";
    case "SURVIVE_TIMER":
    default:
      return "Survive";
  }
}

function displayZoneName(zoneId: StageId | "DETERMINISTIC"): string {
  switch (zoneId) {
    case "DOCKS":
      return "Docks";
    case "SEWERS":
      return "Sewers";
    case "CHINATOWN":
      return "Chinatown";
    case "DETERMINISTIC":
    default:
      return "Deterministic";
  }
}

function titleForDelveNode(node: DelveNode, showCombatSubtypes: boolean): string {
  switch (node.nodeType) {
    case "REST":
      return "Rest";
    case "SHOP":
      return "Shop";
    case "BOSS":
      return "Boss";
    case "ELITE":
      return "Elite";
    case "QUESTION_MARK":
      return "Unknown";
    case "COMBAT":
    default:
      return showCombatSubtypes ? combatSubtypeLabel(node.combatSubtype) : "Combat";
  }
}

function subtitleForDelveNode(node: DelveNode): string {
  return `${displayZoneName(node.runtime.zoneId)} · Row ${node.rowIndex + 1}`;
}

function kindLabelForDelveNode(node: DelveNode): string {
  switch (node.nodeType) {
    case "REST":
      return "Rest";
    case "SHOP":
      return "Shop";
    case "BOSS":
      return "Boss";
    case "ELITE":
      return "Elite";
    case "QUESTION_MARK":
      return "Question Mark";
    case "COMBAT":
    default:
      return "Combat";
  }
}

export function buildDelveRouteMapVM(
  delveMap: DelveMap,
  options?: BuildDelveRouteMapOptions,
): RouteMapVM {
  const showCombatSubtypes = !!options?.showCombatSubtypes;
  const currentNode = delveMap.currentNodeId ? delveMap.nodes.get(delveMap.currentNodeId) ?? null : null;
  const currentDepth = currentNode ? currentNode.rowIndex + 1 : 1;
  const reachableIds = new Set(getReachableNodes(delveMap).map((node) => node.id));

  const nodes = Array.from(delveMap.nodes.values())
    .sort((a, b) => (a.rowIndex - b.rowIndex) || (a.laneIndex - b.laneIndex) || a.id.localeCompare(b.id))
    .map((node) => {
      const current = node.id === delveMap.currentNodeId;
      const visualType = visualTypeForNodeType(node.nodeType);
      return {
        id: node.id,
        mode: "DELVE" as const,
        visualType,
        zoneId: node.runtime.zoneId,
        depth: node.rowIndex + 1,
        rowIndex: node.rowIndex,
        laneIndex: node.laneIndex,
        laneCount: delveMap.laneCount,
        status: statusForNode(node, current, reachableIds, delveMap),
        reachable: reachableIds.has(node.id),
        current,
        completed: delveMap.completedNodeIds.has(node.id),
        title: titleForDelveNode(node, showCombatSubtypes),
        subtitle: subtitleForDelveNode(node),
        iconText: iconForVisualType(visualType),
        combatTagText: node.nodeType === "COMBAT" && showCombatSubtypes ? combatSubtypeLabel(node.combatSubtype) : undefined,
        kindLabel: kindLabelForDelveNode(node),
      };
    });

  return {
    mode: "DELVE",
    nodes,
    edges: delveMap.edges.map((edge) => ({ fromId: edge.from, toId: edge.to })),
    currentNodeId: delveMap.currentNodeId,
    currentDepth,
    depthWindow: {
      start: 1,
      end: delveMap.actLengthRows,
    },
    rowCount: delveMap.actLengthRows,
  };
}

function visualTypeForArchetype(archetype: FloorArchetype): RouteNodeVisualType {
  switch (archetype) {
    case "HEAL":
      return "rest";
    case "VENDOR":
      return "shop";
    case "ACT_BOSS":
      return "boss";
    case "RARE_TRIPLE":
      return "elite";
    case "TIME_TRIAL":
    case "SURVIVE":
    default:
      return "combat";
  }
}

function labelForArchetype(archetype: FloorArchetype, objectiveId?: ObjectiveId): string {
  switch (archetype) {
    case "HEAL":
      return "Heal";
    case "VENDOR":
      return "Vendor";
    case "ACT_BOSS":
      return "Boss";
    case "RARE_TRIPLE":
      return "3 Rares";
    case "TIME_TRIAL":
      return "Zone Trial";
    case "SURVIVE":
    default:
      return objectiveId === "POE_MAP_CLEAR" ? "PoE Map" : "Survive";
  }
}

export function buildDeterministicRouteMapVM(
  options: DeterministicRouteOption[],
  floorIndex: number,
  depth: number,
): RouteMapVM {
  const laneCount = Math.max(1, options.length);
  const nodes: RouteNodeVM[] = options.map((choice, index) => {
    const visualType = visualTypeForArchetype(choice.archetype);
    return {
      id: `det-${floorIndex}-${depth}-${choice.archetype}-${choice.objectiveId ?? "AUTO"}-${index}`,
      mode: "DETERMINISTIC",
      visualType,
      zoneId: "DETERMINISTIC",
      depth,
      rowIndex: 0,
      laneIndex: index,
      laneCount,
      status: "REACHABLE",
      reachable: true,
      current: false,
      completed: false,
      title: choice.title ?? labelForArchetype(choice.archetype, choice.objectiveId),
      subtitle: choice.subtitle ?? `Deterministic · Depth ${depth}`,
      iconText: iconForVisualType(visualType),
      kindLabel: labelForArchetype(choice.archetype, choice.objectiveId),
      deterministicData: {
        floorIndex,
        depth,
        archetype: choice.archetype,
        objectiveId: choice.objectiveId,
      },
    };
  });

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
    rowCount: 1,
  };
}
