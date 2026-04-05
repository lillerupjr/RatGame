import type { BossId } from "../bosses/bossTypes";
import type { StageId } from "../content/stages";
import { RNG } from "../util/rng";
import type { FloorArchetype } from "./floorArchetype";
import { DEFAULT_MAP_POOL, type MapId } from "./mapIds";
import type { ObjectiveId } from "./objectivePlan";

export type DelveNodeType =
  | "COMBAT"
  | "REST"
  | "SHOP"
  | "BOSS"
  | "ELITE"
  | "QUESTION_MARK";

export type DelveRunStatus = "IN_PROGRESS" | "WON" | "LOST";

export type DelveNodeState = "UNVISITED" | "ACTIVE" | "CLEARED";

export type SerializedDelveNodeState = {
  nodeId: string;
  state: DelveNodeState;
};

export type DelveCombatSubtype = Extract<ObjectiveId, "SURVIVE_TIMER" | "POE_MAP_CLEAR" | "ZONE_TRIAL">;

export type DelveNodeRuntimePlan = {
  zoneId: StageId;
  mapId: string;
  objectiveId: ObjectiveId;
  variantSeed: number;
  bossId?: BossId;
  bossCount?: number;
  spawnZoneCount?: number;
};

export type DelveNode = {
  id: string;
  rowIndex: number;
  laneIndex: number;
  nodeType: DelveNodeType;
  combatSubtype?: DelveCombatSubtype;
  outgoingNodeIds: string[];
  runtime: DelveNodeRuntimePlan;
  contentEnabled: boolean;
};

export type DelveEdge = {
  from: string;
  to: string;
};

export type DelveMap = {
  seed: number;
  actLengthRows: number;
  laneCount: number;
  nodes: Map<string, DelveNode>;
  edges: DelveEdge[];
  startNodeIds: string[];
  bossNodeId: string;
  completedNodeIds: Set<string>;
  currentNodeId: string | null;
  pendingNodeId: string | null;
  runStatus: DelveRunStatus;
};

export type DelveMapConfig = {
  rowCount?: number;
  laneCount?: number;
  startRowNodeCount?: number;
  minIntermediateNodes?: number;
  maxIntermediateNodes?: number;
  preBossMinNodes?: number;
  preBossMaxNodes?: number;
  shopCount?: number;
  extraRestCount?: number;
  specialStartRow?: number;
  enableEliteNodes?: boolean;
  enableQuestionMarkNodes?: boolean;
  extraEdgeChance?: number;
  retryLimit?: number;
};

type NormalizedDelveMapConfig = {
  rowCount: number;
  laneCount: number;
  startRowNodeCount: number;
  minIntermediateNodes: number;
  maxIntermediateNodes: number;
  preBossMinNodes: number;
  preBossMaxNodes: number;
  shopCount: number;
  extraRestCount: number;
  specialStartRow: number;
  enableEliteNodes: boolean;
  enableQuestionMarkNodes: boolean;
  extraEdgeChance: number;
  retryLimit: number;
};

type RowLayout = {
  rowIndex: number;
  laneIndices: number[];
};

type MutableNode = {
  id: string;
  rowIndex: number;
  laneIndex: number;
  nodeType: DelveNodeType;
  combatSubtype?: DelveCombatSubtype;
  runtime: DelveNodeRuntimePlan;
  contentEnabled: boolean;
};

const DEFAULT_ROW_COUNT = 8;
const DEFAULT_LANE_COUNT = 5;
const MIN_ROW_COUNT = 4;
const MIN_LANE_COUNT = 3;
const DEFAULT_EXTRA_EDGE_CHANCE = 0.35;
const DEFAULT_RETRY_LIMIT = 12;

const ZONE_IDS: StageId[] = ["DOCKS", "SEWERS", "CHINATOWN"];
const COMBAT_SUBTYPE_POOL: Array<{ subtype: DelveCombatSubtype; weight: number }> = [
  { subtype: "SURVIVE_TIMER", weight: 55 },
  { subtype: "POE_MAP_CLEAR", weight: 25 },
  { subtype: "ZONE_TRIAL", weight: 20 },
];

const NODE_TYPE_RUNTIME_ENABLED: Record<DelveNodeType, boolean> = {
  COMBAT: true,
  REST: true,
  SHOP: true,
  BOSS: true,
  ELITE: false,
  QUESTION_MARK: false,
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeConfig(input: DelveMapConfig | undefined): NormalizedDelveMapConfig {
  const rowCount = Math.max(MIN_ROW_COUNT, Math.floor(input?.rowCount ?? DEFAULT_ROW_COUNT));
  const laneCount = Math.max(MIN_LANE_COUNT, Math.floor(input?.laneCount ?? DEFAULT_LANE_COUNT));
  const startRowNodeCount = clamp(Math.floor(input?.startRowNodeCount ?? Math.min(3, laneCount)), 1, laneCount);
  const minIntermediateNodes = clamp(Math.floor(input?.minIntermediateNodes ?? 2), 1, laneCount);
  const maxIntermediateNodes = clamp(
    Math.floor(input?.maxIntermediateNodes ?? 3),
    minIntermediateNodes,
    laneCount,
  );
  const preBossMinNodes = clamp(Math.floor(input?.preBossMinNodes ?? 2), 1, laneCount);
  const preBossMaxNodes = clamp(
    Math.floor(input?.preBossMaxNodes ?? 3),
    preBossMinNodes,
    laneCount,
  );
  return {
    rowCount,
    laneCount,
    startRowNodeCount,
    minIntermediateNodes,
    maxIntermediateNodes,
    preBossMinNodes,
    preBossMaxNodes,
    shopCount: Math.max(0, Math.floor(input?.shopCount ?? 1)),
    extraRestCount: Math.max(0, Math.floor(input?.extraRestCount ?? 1)),
    specialStartRow: clamp(Math.floor(input?.specialStartRow ?? 2), 1, Math.max(1, rowCount - 2)),
    enableEliteNodes: !!input?.enableEliteNodes,
    enableQuestionMarkNodes: !!input?.enableQuestionMarkNodes,
    extraEdgeChance: Math.max(0, Math.min(1, Number(input?.extraEdgeChance ?? DEFAULT_EXTRA_EDGE_CHANCE))),
    retryLimit: Math.max(1, Math.floor(input?.retryLimit ?? DEFAULT_RETRY_LIMIT)),
  };
}

function nodeId(rowIndex: number, laneIndex: number): string {
  return `act:${rowIndex}:${laneIndex}`;
}

function centeredLaneCluster(laneCount: number, targetCount: number): number[] {
  const count = clamp(targetCount, 1, laneCount);
  const center = (laneCount - 1) * 0.5;
  const lanes = Array.from({ length: laneCount }, (_, index) => index);
  lanes.sort((a, b) => {
    const delta = Math.abs(a - center) - Math.abs(b - center);
    if (delta !== 0) return delta;
    return a - b;
  });
  return lanes.slice(0, count).sort((a, b) => a - b);
}

function averageLane(lanes: number[]): number {
  if (lanes.length <= 0) return 0;
  let total = 0;
  for (let i = 0; i < lanes.length; i++) total += lanes[i];
  return total / lanes.length;
}

function contiguousLaneCluster(startLane: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => startLane + index);
}

function enumerateContiguousLaneClusters(laneCount: number, targetCount: number): number[][] {
  const count = clamp(targetCount, 1, laneCount);
  const maxStart = laneCount - count;
  const clusters: number[][] = [];
  for (let startLane = 0; startLane <= maxStart; startLane++) {
    clusters.push(contiguousLaneCluster(startLane, count));
  }
  return clusters;
}

function lanesAreLocallyCompatible(fromLanes: number[], toLanes: number[]): boolean {
  if (fromLanes.length <= 0 || toLanes.length <= 0) return false;
  for (let i = 0; i < fromLanes.length; i++) {
    const fromLane = fromLanes[i];
    let hasTarget = false;
    for (let j = 0; j < toLanes.length; j++) {
      if (Math.abs(toLanes[j] - fromLane) <= 1) {
        hasTarget = true;
        break;
      }
    }
    if (!hasTarget) return false;
  }
  for (let i = 0; i < toLanes.length; i++) {
    const toLane = toLanes[i];
    let hasSource = false;
    for (let j = 0; j < fromLanes.length; j++) {
      if (Math.abs(fromLanes[j] - toLane) <= 1) {
        hasSource = true;
        break;
      }
    }
    if (!hasSource) return false;
  }
  return true;
}

function pickCompatibleLaneCluster(
  rng: RNG,
  prevLanes: number[],
  laneCount: number,
  targetCount: number,
  nextLanes?: number[],
): number[] | null {
  const mapCenter = (laneCount - 1) * 0.5;
  const candidates = enumerateContiguousLaneClusters(laneCount, targetCount)
    .filter((cluster) => lanesAreLocallyCompatible(prevLanes, cluster))
    .filter((cluster) => !nextLanes || lanesAreLocallyCompatible(cluster, nextLanes))
    .map((cluster) => ({
      cluster,
      score:
        Math.abs(averageLane(cluster) - averageLane(prevLanes)) * 1.15
        + Math.abs(averageLane(cluster) - mapCenter) * 0.28
        + rng.range(0, 0.35),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.cluster[0] - b.cluster[0];
    });

  if (candidates.length <= 0) return null;
  const shortlistCount = Math.min(3, candidates.length);
  return [...candidates[rng.int(0, shortlistCount - 1)].cluster];
}

function buildRowLayouts(rng: RNG, config: NormalizedDelveMapConfig): RowLayout[] {
  const rows: RowLayout[] = [];
  rows.push({
    rowIndex: 0,
    laneIndices: centeredLaneCluster(config.laneCount, config.startRowNodeCount),
  });

  for (let rowIndex = 1; rowIndex < config.rowCount - 2; rowIndex++) {
    const prev = rows[rowIndex - 1];
    const nodeCount = rng.int(config.minIntermediateNodes, config.maxIntermediateNodes);
    const laneIndices = pickCompatibleLaneCluster(rng, prev.laneIndices, config.laneCount, nodeCount);
    if (!laneIndices) return [];
    rows.push({
      rowIndex,
      laneIndices,
    });
  }

  const preBossCount = rng.int(config.preBossMinNodes, config.preBossMaxNodes);
  const preBossPrev = rows[rows.length - 1] ?? { rowIndex: config.rowCount - 3, laneIndices: centeredLaneCluster(config.laneCount, preBossCount) };
  const bossLaneIndices = [Math.floor((config.laneCount - 1) * 0.5)];
  const preBossLaneIndices = pickCompatibleLaneCluster(
    rng,
    preBossPrev.laneIndices,
    config.laneCount,
    preBossCount,
    bossLaneIndices,
  );
  if (!preBossLaneIndices) return [];
  rows.push({
    rowIndex: config.rowCount - 2,
    laneIndices: preBossLaneIndices,
  });
  rows.push({
    rowIndex: config.rowCount - 1,
    laneIndices: bossLaneIndices,
  });
  return rows;
}

function buildFallbackRowLayouts(config: NormalizedDelveMapConfig): RowLayout[] {
  const rows: RowLayout[] = [];
  rows.push({
    rowIndex: 0,
    laneIndices: centeredLaneCluster(config.laneCount, config.startRowNodeCount),
  });
  for (let rowIndex = 1; rowIndex < config.rowCount - 2; rowIndex++) {
    const count = rowIndex % 2 === 0 ? Math.min(3, config.laneCount) : Math.min(2, config.laneCount);
    const laneIndices = pickCompatibleLaneCluster(
      new RNG(hashString(`delve-act:fallback-row:${config.rowCount}:${config.laneCount}:${rowIndex}`)),
      rows[rowIndex - 1].laneIndices,
      config.laneCount,
      count,
    ) ?? centeredLaneCluster(config.laneCount, count);
    rows.push({
      rowIndex,
      laneIndices,
    });
  }
  const bossLaneIndices = [Math.floor((config.laneCount - 1) * 0.5)];
  const preBossCount = clamp(Math.min(3, config.laneCount), config.preBossMinNodes, config.preBossMaxNodes);
  const preBossLaneIndices = pickCompatibleLaneCluster(
    new RNG(hashString(`delve-act:fallback-preboss:${config.rowCount}:${config.laneCount}`)),
    rows[rows.length - 1].laneIndices,
    config.laneCount,
    preBossCount,
    bossLaneIndices,
  ) ?? centeredLaneCluster(config.laneCount, preBossCount);
  rows.push({
    rowIndex: config.rowCount - 2,
    laneIndices: preBossLaneIndices,
  });
  rows.push({
    rowIndex: config.rowCount - 1,
    laneIndices: bossLaneIndices,
  });
  return rows;
}

function buildEdgesForRows(rng: RNG, rows: RowLayout[], config: NormalizedDelveMapConfig): DelveEdge[] {
  const edgeSet = new Set<string>();
  const edges: DelveEdge[] = [];
  const addEdge = (fromId: string, toId: string): void => {
    const key = `${fromId}->${toId}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ from: fromId, to: toId });
  };

  for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex++) {
    const fromRow = rows[rowIndex];
    const toRow = rows[rowIndex + 1];
    const targetsByFromLane = new Map<number, number[]>();
    const sourcesByToLane = new Map<number, number[]>();
    const outgoingCount = new Map<number, number>();
    const incomingCount = new Map<number, number>();
    const currentTargetsByFromLane = new Map<number, Set<number>>();
    const addLaneEdge = (fromLane: number, toLane: number): void => {
      const fromId = nodeId(fromRow.rowIndex, fromLane);
      const toId = nodeId(toRow.rowIndex, toLane);
      const targetSet = currentTargetsByFromLane.get(fromLane) ?? new Set<number>();
      if (targetSet.has(toLane)) return;
      addEdge(fromId, toId);
      targetSet.add(toLane);
      currentTargetsByFromLane.set(fromLane, targetSet);
      outgoingCount.set(fromLane, (outgoingCount.get(fromLane) ?? 0) + 1);
      incomingCount.set(toLane, (incomingCount.get(toLane) ?? 0) + 1);
    };

    for (let i = 0; i < fromRow.laneIndices.length; i++) {
      const fromLane = fromRow.laneIndices[i];
      const legalTargets = toRow.laneIndices.filter((toLane) => Math.abs(toLane - fromLane) <= 1);
      if (legalTargets.length <= 0) return [];
      targetsByFromLane.set(fromLane, legalTargets);
    }

    for (let i = 0; i < toRow.laneIndices.length; i++) {
      const toLane = toRow.laneIndices[i];
      const legalSources = fromRow.laneIndices.filter((fromLane) => Math.abs(fromLane - toLane) <= 1);
      if (legalSources.length <= 0) return [];
      sourcesByToLane.set(toLane, legalSources);
    }

    const fromOrder = [...fromRow.laneIndices].sort((a, b) => {
      const delta = (targetsByFromLane.get(a)?.length ?? 0) - (targetsByFromLane.get(b)?.length ?? 0);
      if (delta !== 0) return delta;
      const closeness = Math.abs(a - averageLane(fromRow.laneIndices)) - Math.abs(b - averageLane(fromRow.laneIndices));
      if (closeness !== 0) return closeness;
      return a - b;
    });

    for (let i = 0; i < fromOrder.length; i++) {
      const fromLane = fromOrder[i];
      const legalTargets = [...(targetsByFromLane.get(fromLane) ?? [])].sort((a, b) => {
        const inboundDelta = (incomingCount.get(a) ?? 0) - (incomingCount.get(b) ?? 0);
        if (inboundDelta !== 0) return inboundDelta;
        const laneDelta = Math.abs(a - fromLane) - Math.abs(b - fromLane);
        if (laneDelta !== 0) return laneDelta;
        return a - b;
      });
      addLaneEdge(fromLane, legalTargets[0]);
    }

    for (let i = 0; i < toRow.laneIndices.length; i++) {
      const toLane = toRow.laneIndices[i];
      if ((incomingCount.get(toLane) ?? 0) > 0) continue;
      const legalSources = [...(sourcesByToLane.get(toLane) ?? [])].sort((a, b) => {
        const aAtCap = (outgoingCount.get(a) ?? 0) >= 2 ? 1 : 0;
        const bAtCap = (outgoingCount.get(b) ?? 0) >= 2 ? 1 : 0;
        if (aAtCap !== bAtCap) return aAtCap - bAtCap;
        const outgoingDelta = (outgoingCount.get(a) ?? 0) - (outgoingCount.get(b) ?? 0);
        if (outgoingDelta !== 0) return outgoingDelta;
        const laneDelta = Math.abs(a - toLane) - Math.abs(b - toLane);
        if (laneDelta !== 0) return laneDelta;
        return a - b;
      });
      const inboundSource = legalSources.find((fromLane) => !(currentTargetsByFromLane.get(fromLane)?.has(toLane)))
        ?? legalSources[0];
      if (inboundSource === undefined) return [];
      addLaneEdge(inboundSource, toLane);
    }

    for (let i = 0; i < fromRow.laneIndices.length; i++) {
      const fromLane = fromRow.laneIndices[i];
      if (rng.range(0, 1) > config.extraEdgeChance) continue;
      if ((outgoingCount.get(fromLane) ?? 0) >= 2) continue;
      const existingTargets = currentTargetsByFromLane.get(fromLane) ?? new Set<number>();
      const primaryTarget = existingTargets.values().next().value ?? fromLane;
      const extraCandidates = [...(targetsByFromLane.get(fromLane) ?? [])]
        .filter((toLane) => !existingTargets.has(toLane))
        .sort((a, b) => {
          const inboundDelta = (incomingCount.get(a) ?? 0) - (incomingCount.get(b) ?? 0);
          if (inboundDelta !== 0) return inboundDelta;
          const branchDelta = Math.abs(Math.abs(a - primaryTarget) - 1) - Math.abs(Math.abs(b - primaryTarget) - 1);
          if (branchDelta !== 0) return branchDelta;
          const laneDelta = Math.abs(a - fromLane) - Math.abs(b - fromLane);
          if (laneDelta !== 0) return laneDelta;
          return a - b;
        });
      if (extraCandidates.length <= 0) continue;
      addLaneEdge(fromLane, extraCandidates[0]);
    }
  }

  return edges;
}

function validateRowsAndEdges(rows: RowLayout[], edges: DelveEdge[]): boolean {
  if (rows.length <= 0) return false;
  const rowById = new Map<string, number>();
  const laneById = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    for (let j = 0; j < row.laneIndices.length; j++) {
      const id = nodeId(row.rowIndex, row.laneIndices[j]);
      rowById.set(id, row.rowIndex);
      laneById.set(id, row.laneIndices[j]);
    }
  }

  const inbound = new Map<string, number>();
  const outbound = new Map<string, number>();
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const fromRow = rowById.get(edge.from);
    const toRow = rowById.get(edge.to);
    const fromLane = laneById.get(edge.from);
    const toLane = laneById.get(edge.to);
    if (fromRow === undefined || toRow === undefined) return false;
    if (fromLane === undefined || toLane === undefined) return false;
    if (toRow !== fromRow + 1) return false;
    if (Math.abs(toLane - fromLane) > 1) return false;
    outbound.set(edge.from, (outbound.get(edge.from) ?? 0) + 1);
    inbound.set(edge.to, (inbound.get(edge.to) ?? 0) + 1);
  }

  const startIds = rows[0].laneIndices.map((lane) => nodeId(0, lane));
  const bossRow = rows[rows.length - 1];
  if (bossRow.laneIndices.length !== 1) return false;
  const bossId = nodeId(bossRow.rowIndex, bossRow.laneIndices[0]);

  for (const [id, rowIndex] of rowById.entries()) {
    if (rowIndex === 0) {
      if (startIds.indexOf(id) < 0) return false;
      continue;
    }
    if ((inbound.get(id) ?? 0) <= 0) return false;
    if (id !== bossId && (outbound.get(id) ?? 0) <= 0) return false;
    if ((outbound.get(id) ?? 0) > 2) return false;
  }

  const queue = [...startIds];
  const seen = new Set<string>(queue);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (let j = 0; j < edges.length; j++) {
      const edge = edges[j];
      if (edge.from !== current || seen.has(edge.to)) continue;
      seen.add(edge.to);
      queue.push(edge.to);
    }
  }
  if (seen.size !== rowById.size) return false;

  const reverseQueue = [bossId];
  const canReachBoss = new Set<string>(reverseQueue);
  for (let i = 0; i < reverseQueue.length; i++) {
    const current = reverseQueue[i];
    for (let j = 0; j < edges.length; j++) {
      const edge = edges[j];
      if (edge.to !== current || canReachBoss.has(edge.from)) continue;
      canReachBoss.add(edge.from);
      reverseQueue.push(edge.from);
    }
  }

  return canReachBoss.size === rowById.size;
}

function pickZoneId(rng: RNG): StageId {
  return ZONE_IDS[rng.int(0, ZONE_IDS.length - 1)];
}

function pickMapId(rng: RNG): MapId {
  return DEFAULT_MAP_POOL[rng.int(0, DEFAULT_MAP_POOL.length - 1)];
}

function weightedPickCombatSubtype(rng: RNG): DelveCombatSubtype {
  const totalWeight = COMBAT_SUBTYPE_POOL.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng.int(1, totalWeight);
  for (let i = 0; i < COMBAT_SUBTYPE_POOL.length; i++) {
    roll -= COMBAT_SUBTYPE_POOL[i].weight;
    if (roll <= 0) return COMBAT_SUBTYPE_POOL[i].subtype;
  }
  return "SURVIVE_TIMER";
}

function runtimePlanForNodeType(
  rng: RNG,
  nodeType: DelveNodeType,
): { combatSubtype?: DelveCombatSubtype; runtime: DelveNodeRuntimePlan } {
  const zoneId = pickZoneId(rng);
  const variantSeed = rng.int(0, 0x7fffffff);
  switch (nodeType) {
    case "COMBAT": {
      const combatSubtype = weightedPickCombatSubtype(rng);
      return {
        combatSubtype,
        runtime: {
          zoneId,
          mapId: pickMapId(rng),
          objectiveId: combatSubtype,
          variantSeed,
        },
      };
    }
    case "REST":
      return {
        runtime: {
          zoneId,
          mapId: "REST",
          objectiveId: "HEAL_VISIT",
          variantSeed,
        },
      };
    case "SHOP":
      return {
        runtime: {
          zoneId,
          mapId: "SHOP",
          objectiveId: "VENDOR_VISIT",
          variantSeed,
        },
      };
    case "BOSS":
      return {
        runtime: {
          zoneId,
          mapId: pickMapId(rng),
          objectiveId: "KILL_RARES_IN_ZONES",
          variantSeed,
          bossCount: 1,
          spawnZoneCount: 1,
        },
      };
    case "ELITE":
    case "QUESTION_MARK":
      return {
        runtime: {
          zoneId,
          mapId: pickMapId(rng),
          objectiveId: "SURVIVE_TIMER",
          variantSeed,
        },
      };
  }
}

function buildNodesForRows(seed: number, rows: RowLayout[], edges: DelveEdge[], config: NormalizedDelveMapConfig): DelveMap {
  const nodes = new Map<string, MutableNode>();
  const parentIdsByNode = new Map<string, string[]>();
  const childIdsByNode = new Map<string, string[]>();

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const parents = parentIdsByNode.get(edge.to) ?? [];
    parents.push(edge.from);
    parentIdsByNode.set(edge.to, parents);
    const children = childIdsByNode.get(edge.from) ?? [];
    children.push(edge.to);
    childIdsByNode.set(edge.from, children);
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    for (let j = 0; j < row.laneIndices.length; j++) {
      const laneIndex = row.laneIndices[j];
      const id = nodeId(row.rowIndex, laneIndex);
      nodes.set(id, {
        id,
        rowIndex: row.rowIndex,
        laneIndex,
        nodeType: "COMBAT",
        runtime: {
          zoneId: "DOCKS",
          mapId: DEFAULT_MAP_POOL[0],
          objectiveId: "SURVIVE_TIMER",
          variantSeed: 0,
        },
        contentEnabled: true,
      });
    }
  }

  const lastRowIndex = rows[rows.length - 1].rowIndex;
  const preBossRowIndex = lastRowIndex - 1;

  for (const node of nodes.values()) {
    if (node.rowIndex === lastRowIndex) {
      node.nodeType = "BOSS";
    } else if (node.rowIndex === preBossRowIndex) {
      node.nodeType = "REST";
    } else {
      node.nodeType = "COMBAT";
    }
  }

  const candidateIds: string[] = [];
  for (const node of nodes.values()) {
    if (node.rowIndex < config.specialStartRow || node.rowIndex >= preBossRowIndex) continue;
    if (node.nodeType !== "COMBAT") continue;
    candidateIds.push(node.id);
  }

  const isUtilityPlacementLegal = (nodeIdToPlace: string): boolean => {
    const directParents = parentIdsByNode.get(nodeIdToPlace) ?? [];
    for (let i = 0; i < directParents.length; i++) {
      const parent = nodes.get(directParents[i]);
      if (!parent) continue;
      if (parent.nodeType === "SHOP" || parent.nodeType === "REST") return false;
    }
    const directChildren = childIdsByNode.get(nodeIdToPlace) ?? [];
    for (let i = 0; i < directChildren.length; i++) {
      const child = nodes.get(directChildren[i]);
      if (!child) continue;
      if (child.nodeType === "SHOP" || child.nodeType === "REST") return false;
    }
    return true;
  };

  const utilityRng = new RNG(seed ^ hashString("utility-assignment"));
  const shuffledCandidates = [...candidateIds].sort(() => utilityRng.range(-1, 1));
  const assignUtilityType = (nodeType: DelveNodeType, count: number): void => {
    let remaining = count;
    for (let i = 0; i < shuffledCandidates.length && remaining > 0; i++) {
      const candidate = nodes.get(shuffledCandidates[i]);
      if (!candidate || candidate.nodeType !== "COMBAT") continue;
      if (!isUtilityPlacementLegal(candidate.id)) continue;
      candidate.nodeType = nodeType;
      remaining--;
    }
  };

  assignUtilityType("SHOP", config.shopCount);
  assignUtilityType("REST", config.extraRestCount);

  const finalizedNodes = new Map<string, DelveNode>();
  for (const node of nodes.values()) {
    const nodeRng = new RNG(seed ^ hashString(`${node.id}:${node.nodeType}`));
    const plan = runtimePlanForNodeType(nodeRng, node.nodeType);
    if (node.nodeType === "ELITE" && !config.enableEliteNodes) {
      node.contentEnabled = false;
    } else if (node.nodeType === "QUESTION_MARK" && !config.enableQuestionMarkNodes) {
      node.contentEnabled = false;
    } else {
      node.contentEnabled = NODE_TYPE_RUNTIME_ENABLED[node.nodeType];
    }
    node.combatSubtype = plan.combatSubtype;
    node.runtime = plan.runtime;
    finalizedNodes.set(node.id, {
      id: node.id,
      rowIndex: node.rowIndex,
      laneIndex: node.laneIndex,
      nodeType: node.nodeType,
      combatSubtype: node.combatSubtype,
      outgoingNodeIds: [...(childIdsByNode.get(node.id) ?? [])].sort((a, b) => a.localeCompare(b)),
      runtime: node.runtime,
      contentEnabled: node.contentEnabled,
    });
  }

  const startNodeIds = [...rows[0].laneIndices].map((lane) => nodeId(0, lane));
  const bossLane = rows[rows.length - 1].laneIndices[0];

  return {
    seed,
    actLengthRows: config.rowCount,
    laneCount: config.laneCount,
    nodes: finalizedNodes,
    edges,
    startNodeIds,
    bossNodeId: nodeId(lastRowIndex, bossLane),
    completedNodeIds: new Set<string>(),
    currentNodeId: null,
    pendingNodeId: null,
    runStatus: "IN_PROGRESS",
  };
}

function buildGeneratedMap(seed: number, config: NormalizedDelveMapConfig): DelveMap {
  for (let attempt = 0; attempt < config.retryLimit; attempt++) {
    const rng = new RNG(seed ^ hashString(`delve-act:${attempt}`));
    const rows = buildRowLayouts(rng, config);
    if (rows.length !== config.rowCount) continue;
    const edges = buildEdgesForRows(rng, rows, config);
    if (!validateRowsAndEdges(rows, edges)) continue;
    return buildNodesForRows(seed ^ hashString(`delve-act:nodes:${attempt}`), rows, edges, config);
  }

  const fallbackRows = buildFallbackRowLayouts(config);
  const fallbackEdges = buildEdgesForRows(new RNG(seed ^ hashString("delve-act:fallback")), fallbackRows, config);
  return buildNodesForRows(seed ^ hashString("delve-act:fallback:nodes"), fallbackRows, fallbackEdges, config);
}

function currentNodeIsInProgress(map: DelveMap): boolean {
  return !!map.currentNodeId && !map.completedNodeIds.has(map.currentNodeId);
}

function hasEdge(map: DelveMap, fromId: string, toId: string): boolean {
  for (let i = 0; i < map.edges.length; i++) {
    const edge = map.edges[i];
    if (edge.from === fromId && edge.to === toId) return true;
  }
  return false;
}

function derivedStateForNode(map: DelveMap, nodeIdToRead: string): DelveNodeState {
  if (map.completedNodeIds.has(nodeIdToRead)) return "CLEARED";
  if (map.currentNodeId === nodeIdToRead && !map.completedNodeIds.has(nodeIdToRead)) return "ACTIVE";
  return "UNVISITED";
}

export function createDelveMap(seed: number, config?: DelveMapConfig): DelveMap {
  return buildGeneratedMap(seed, normalizeConfig(config));
}

export function getNodeDepth(node: Pick<DelveNode, "rowIndex">): number {
  return node.rowIndex + 1;
}

export function countClearedNodes(map: DelveMap): number {
  return map.completedNodeIds.size;
}

export function canEnterNode(map: DelveMap, nodeIdToEnter: string): boolean {
  if (map.runStatus !== "IN_PROGRESS") return false;
  const node = map.nodes.get(nodeIdToEnter);
  if (!node) return false;
  if (map.completedNodeIds.has(nodeIdToEnter)) return false;
  if (map.pendingNodeId) return false;
  if (map.currentNodeId === nodeIdToEnter && !map.completedNodeIds.has(nodeIdToEnter)) return false;
  if (currentNodeIsInProgress(map)) return false;

  if (!map.currentNodeId) {
    return map.startNodeIds.includes(nodeIdToEnter);
  }

  return hasEdge(map, map.currentNodeId, nodeIdToEnter);
}

export function moveToNode(map: DelveMap, nodeId: string): DelveNode | null {
  if (!canEnterNode(map, nodeId)) return null;
  const node = map.nodes.get(nodeId) ?? null;
  if (!node) return null;
  map.pendingNodeId = nodeId;
  return node;
}

export function commitPendingNode(map: DelveMap, nodeId?: string): DelveNode | null {
  const expectedId = nodeId ?? map.pendingNodeId;
  if (!expectedId || map.pendingNodeId !== expectedId) return null;
  const node = map.nodes.get(expectedId) ?? null;
  if (!node) {
    map.pendingNodeId = null;
    return null;
  }
  map.currentNodeId = expectedId;
  map.pendingNodeId = null;
  return node;
}

export function clearPendingNode(map: DelveMap, nodeId?: string): void {
  if (!map.pendingNodeId) return;
  if (nodeId && map.pendingNodeId !== nodeId) return;
  map.pendingNodeId = null;
}

export function markCurrentNodeCleared(map: DelveMap): DelveNode | null {
  const currentId = map.currentNodeId;
  if (!currentId) return null;
  const node = map.nodes.get(currentId);
  if (!node) return null;
  if (map.completedNodeIds.has(currentId)) return node;
  map.completedNodeIds.add(currentId);
  return node;
}

export function markRunWon(map: DelveMap): void {
  map.runStatus = "WON";
  map.pendingNodeId = null;
}

export function markRunLost(map: DelveMap): void {
  map.runStatus = "LOST";
  map.pendingNodeId = null;
}

export function getReachableNodes(map: DelveMap): DelveNode[] {
  if (map.runStatus !== "IN_PROGRESS") return [];
  if (map.pendingNodeId) return [];
  if (!map.currentNodeId) {
    return map.startNodeIds
      .map((nodeId) => map.nodes.get(nodeId))
      .filter((node): node is DelveNode => !!node);
  }
  if (currentNodeIsInProgress(map)) return [];
  const currentNode = map.nodes.get(map.currentNodeId);
  if (!currentNode) return [];
  const reachable: DelveNode[] = [];
  for (let i = 0; i < currentNode.outgoingNodeIds.length; i++) {
    const targetId = currentNode.outgoingNodeIds[i];
    if (map.completedNodeIds.has(targetId)) continue;
    const node = map.nodes.get(targetId);
    if (node) reachable.push(node);
  }
  reachable.sort((a, b) => (a.rowIndex - b.rowIndex) || (a.laneIndex - b.laneIndex) || a.id.localeCompare(b.id));
  return reachable;
}

export function getVisibleNodes(map: DelveMap, radius: number = map.actLengthRows): DelveNode[] {
  if (!map.currentNodeId) {
    return Array.from(map.nodes.values()).sort((a, b) => (a.rowIndex - b.rowIndex) || (a.laneIndex - b.laneIndex));
  }
  const current = map.nodes.get(map.currentNodeId);
  if (!current) return Array.from(map.nodes.values());
  return Array.from(map.nodes.values())
    .filter((node) => Math.abs(node.rowIndex - current.rowIndex) <= Math.max(0, radius))
    .sort((a, b) => (a.rowIndex - b.rowIndex) || (a.laneIndex - b.laneIndex));
}

export function serializeNodeStates(map: DelveMap): SerializedDelveNodeState[] {
  return Array.from(map.nodes.values())
    .map((node) => ({
      nodeId: node.id,
      state: derivedStateForNode(map, node.id),
    }))
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
}

export function hydrateNodeStates(
  map: DelveMap,
  rows: Array<{ nodeId: string; state: DelveNodeState }> | null | undefined,
): void {
  map.completedNodeIds.clear();
  map.currentNodeId = null;
  map.pendingNodeId = null;
  if (!Array.isArray(rows)) return;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row.nodeId !== "string") continue;
    if (!map.nodes.has(row.nodeId)) continue;
    if (row.state === "CLEARED") {
      map.completedNodeIds.add(row.nodeId);
    } else if (row.state === "ACTIVE") {
      map.currentNodeId = row.nodeId;
    }
  }
}

export function floorArchetypeForNode(node: DelveNode): FloorArchetype {
  switch (node.nodeType) {
    case "REST":
      return "HEAL";
    case "SHOP":
      return "VENDOR";
    case "BOSS":
      return "BOSS_TRIPLE";
    case "COMBAT":
      return node.combatSubtype === "ZONE_TRIAL" ? "TIME_TRIAL" : "SURVIVE";
    case "ELITE":
    case "QUESTION_MARK":
      return "SURVIVE";
  }
}

export function getDepthScaling(depth: number): {
  hpMult: number;
  damageMult: number;
  spawnRateMult: number;
} {
  const d = Math.max(1, depth);
  return {
    hpMult: Math.pow(1.2, d - 1),
    damageMult: Math.pow(1.05, d - 1),
    spawnRateMult: 1 + (d - 1) * 0.05,
  };
}
