// src/game/map/delveMap.ts
// Infinite Delve-style grid map (inspired by Path of Exile's Azurite Mine)

import type { StageId } from "../content/stages";
import { RNG } from "../util/rng";
import { FLOOR_ARCHETYPES, type FloorArchetype } from "./floorArchetype";
import { DEFAULT_MAP_POOL, type MapId } from "./mapIds";
import { objectiveIdFromArchetype, type ObjectiveId } from "./objectivePlan";

export type NodePlan = {
  depth: number;
  mapId: MapId;
  objectiveId: ObjectiveId;
  variantSeed: number;
};

export type DelveNodeState = "UNVISITED" | "ACTIVE" | "CLEARED";

export type SerializedDelveNodeState = {
  nodeId: string;
  state: DelveNodeState;
};

export type DelveNode = {
  id: string;
  x: number;  // grid x coordinate
  y: number;  // grid y coordinate (depth - higher = deeper/harder)
  zoneId: StageId;
  floorArchetype: FloorArchetype;
  plan: NodePlan;
  title: string;
  state: DelveNodeState;
};

export type DelveEdge = { from: string; to: string };

export type DelveMap = {
  nodes: Map<string, DelveNode>;
  edges: DelveEdge[];
  currentNodeId: string | null;
  exploredDepth: number;  // deepest y coordinate reached
};

const ZONE_IDS: StageId[] = ["DOCKS", "SEWERS", "CHINATOWN"];
const ZONE_NAMES: Record<StageId, string> = {
  DOCKS: "Docks",
  SEWERS: "Sewers",
  CHINATOWN: "Chinatown",
};
const POE_MAP_SURVIVE_OBJECTIVE_CHANCE_PCT = 30;

function nodeId(x: number, y: number): string {
  return `${x},${y}`;
}

function hasEdge(map: DelveMap, fromId: string, toId: string): boolean {
  for (let i = 0; i < map.edges.length; i++) {
    const edge = map.edges[i];
    if (
      (edge.from === fromId && edge.to === toId) ||
      (edge.from === toId && edge.to === fromId)
    ) {
      return true;
    }
  }
  return false;
}

function isDelveNodeState(value: unknown): value is DelveNodeState {
  return value === "UNVISITED" || value === "ACTIVE" || value === "CLEARED";
}

function startingReachableNodeIds(map: DelveMap): Set<string> {
  const originId = nodeId(0, 0);
  const out = new Set<string>();
  const origin = map.nodes.get(originId);
  if (origin && origin.y === 0) out.add(originId);
  for (let i = 0; i < map.edges.length; i++) {
    const edge = map.edges[i];
    let neighborId: string | null = null;
    if (edge.from === originId) neighborId = edge.to;
    else if (edge.to === originId) neighborId = edge.from;
    if (!neighborId) continue;
    const neighbor = map.nodes.get(neighborId);
    // First delve map pick is constrained to depth-0 layer only.
    if (neighbor && neighbor.y === 0) out.add(neighbor.id);
  }
  return out;
}

function normalizeCurrentNodeIdFromStates(map: DelveMap): void {
  if (map.currentNodeId) {
    const current = map.nodes.get(map.currentNodeId);
    if (current && current.state === "ACTIVE") return;
  }
  for (const node of map.nodes.values()) {
    if (node.state === "ACTIVE") {
      map.currentNodeId = node.id;
      return;
    }
  }
  map.currentNodeId = null;
}

function pickFloorArchetype(
  rng: RNG,
  depth: number,
  prevArchetype?: FloorArchetype | null
): FloorArchetype {
  const options = FLOOR_ARCHETYPES.filter((archetype) => {
    if (depth <= 3 && (archetype === "VENDOR" || archetype === "HEAL")) return false;
    if (
      (prevArchetype === "VENDOR" || prevArchetype === "HEAL") &&
      (archetype === "VENDOR" || archetype === "HEAL")
    ) {
      return false;
    }
    return true;
  });

  if (options.length === 0) {
    return "SURVIVE";
  }

  return options[rng.int(0, options.length - 1)];
}

function pickMapId(rng: RNG): MapId {
  return DEFAULT_MAP_POOL[rng.int(0, DEFAULT_MAP_POOL.length - 1)];
}

function pickObjectiveId(rng: RNG, archetype: FloorArchetype): ObjectiveId {
  if (archetype !== "SURVIVE") return objectiveIdFromArchetype(archetype);
  return rng.int(1, 100) <= POE_MAP_SURVIVE_OBJECTIVE_CHANCE_PCT
    ? "POE_MAP_CLEAR"
    : "SURVIVE_TIMER";
}

function buildNodePlan(rng: RNG, depth: number, archetype: FloorArchetype): NodePlan {
  const mapId = (() => {
    if (archetype === "VENDOR") return "SHOP" as MapId;
    if (archetype === "HEAL") return "REST" as MapId;
    return pickMapId(rng);
  })();
  return {
    depth,
    mapId,
    objectiveId: pickObjectiveId(rng, archetype),
    variantSeed: rng.int(0, 0x7fffffff),
  };
}

/**
 * Create a new delve map with a starting node at (0, 0)
 */
export function createDelveMap(seed: number): DelveMap {
  const rng = new RNG(seed);
  const nodes = new Map<string, DelveNode>();
  
  // Create starting node at depth 0
  const startZone = ZONE_IDS[rng.int(0, ZONE_IDS.length - 1)];
  const startDepth = 1;
  const startArchetype = pickFloorArchetype(rng, startDepth, null);
  const startNode: DelveNode = {
    id: nodeId(0, 0),
    x: 0,
    y: 0,
    zoneId: startZone,
    floorArchetype: startArchetype,
    plan: buildNodePlan(rng, startDepth, startArchetype),
    title: `${ZONE_NAMES[startZone]} (Depth ${startDepth})`,
    state: "UNVISITED",
  };
  nodes.set(startNode.id, startNode);

  const map: DelveMap = {
    nodes,
    edges: [],
    currentNodeId: null,
    exploredDepth: 0,
  };

  // Pre-generate adjacency so the start has multiple choices.
  ensureAdjacentNodes(map, startNode.id, seed ^ 0x9e3779b9);

  return map;
}

/**
 * Get the depth (difficulty tier) for a node
 */
export function getNodeDepth(node: DelveNode): number {
  return node.y + 1; // y=0 is depth 1
}

/**
 * Generate adjacent nodes that can be traveled to from the current position.
 * Nodes are generated lazily as the player explores.
 */
export function ensureAdjacentNodes(map: DelveMap, fromId: string, seed: number): void {
  const from = map.nodes.get(fromId);
  if (!from) return;

  const rng = new RNG(seed ^ hashString(fromId));
  
  // Possible directions: down (deeper), left, right, and sometimes up
  // Bias towards going deeper (down = +y)
  const directions = [
    { dx: 0, dy: 1, weight: 0.5 },   // down (deeper) - most common
    { dx: -1, dy: 0, weight: 0.2 },  // left
    { dx: 1, dy: 0, weight: 0.2 },   // right
    { dx: 0, dy: -1, weight: 0.1 },  // up (backtrack) - rare
  ];

  // Generate 2-4 connections from each node
  const numConnections = rng.int(2, 4);
  const shuffled = [...directions].sort(() => rng.range(-1, 1));
  
  let created = 0;
  for (const dir of shuffled) {
    if (created >= numConnections) break;
    
    // Random chance based on weight
    if (rng.range(0, 1) > dir.weight * 2) continue;
    
    const nx = from.x + dir.dx;
    const ny = from.y + dir.dy;
    
    // Don't go above depth 0
    if (ny < 0) continue;
    
    // Limit horizontal spread (creates a funnel shape like PoE delve)
    const maxSpread = Math.floor(ny / 2) + 2;
    if (Math.abs(nx) > maxSpread) continue;
    
    const nid = nodeId(nx, ny);
    
    // Check if edge already exists
    const edgeExists = map.edges.some(
      e => (e.from === fromId && e.to === nid) || (e.from === nid && e.to === fromId)
    );
    
    if (!edgeExists) {
      // Create node if it doesn't exist
      if (!map.nodes.has(nid)) {
        const nodeRng = new RNG(seed ^ hashString(nid));
        const zoneId = ZONE_IDS[nodeRng.int(0, ZONE_IDS.length - 1)];
        const depth = ny + 1;
        const floorArchetype = pickFloorArchetype(nodeRng, depth, from.floorArchetype);

        const newNode: DelveNode = {
          id: nid,
          x: nx,
          y: ny,
          zoneId,
          floorArchetype,
          plan: buildNodePlan(nodeRng, depth, floorArchetype),
          title: `${ZONE_NAMES[zoneId]} (Depth ${depth})`,
          state: "UNVISITED",
        };
        map.nodes.set(nid, newNode);
      }
      
      // Add bidirectional edge
      map.edges.push({ from: fromId, to: nid });
      created++;
    }
  }
  
  // Always ensure at least one path deeper if we're not too spread out
  const deeperId = nodeId(from.x, from.y + 1);
  const hasDeeper = map.edges.some(
    e => (e.from === fromId && e.to === deeperId) || (e.from === deeperId && e.to === fromId)
  );
  
  if (!hasDeeper && Math.abs(from.x) <= Math.floor((from.y + 1) / 2) + 2) {
    if (!map.nodes.has(deeperId)) {
      const nodeRng = new RNG(seed ^ hashString(deeperId));
      const zoneId = ZONE_IDS[nodeRng.int(0, ZONE_IDS.length - 1)];
      const depth = from.y + 2;
      const floorArchetype = pickFloorArchetype(nodeRng, depth, from.floorArchetype);
      
      map.nodes.set(deeperId, {
        id: deeperId,
        x: from.x,
        y: from.y + 1,
        zoneId,
        floorArchetype,
        plan: buildNodePlan(nodeRng, depth, floorArchetype),
        title: `${ZONE_NAMES[zoneId]} (Depth ${depth})`,
        state: "UNVISITED",
      });
    }
    map.edges.push({ from: fromId, to: deeperId });
  }
}

/**
 * A node can only be entered once:
 * - state must be UNVISITED
 * - destination must be connected from current position
 *   (or in the opening reachable set if no current node exists yet)
 */
export function canEnterNode(map: DelveMap, nodeIdToEnter: string): boolean {
  const node = map.nodes.get(nodeIdToEnter);
  if (!node || node.state !== "UNVISITED") return false;

  const current = map.currentNodeId ? map.nodes.get(map.currentNodeId) ?? null : null;
  if (current?.state === "ACTIVE") return false;

  if (!map.currentNodeId) {
    return startingReachableNodeIds(map).has(nodeIdToEnter);
  }

  return hasEdge(map, map.currentNodeId, nodeIdToEnter);
}

/**
 * Mark a node active when the player enters it.
 * Entry is rejected unless the node is UNVISITED and connected.
 */
export function markNodeActive(map: DelveMap, nodeIdToEnter: string): DelveNode | null {
  if (!canEnterNode(map, nodeIdToEnter)) return null;
  const node = map.nodes.get(nodeIdToEnter);
  if (!node) return null;

  node.state = "ACTIVE";
  map.currentNodeId = nodeIdToEnter;
  map.exploredDepth = Math.max(map.exploredDepth, node.y);
  return node;
}

/**
 * Mark the current active node as cleared after objective completion.
 */
export function markCurrentNodeCleared(map: DelveMap): DelveNode | null {
  const currentId = map.currentNodeId;
  if (!currentId) return null;
  const node = map.nodes.get(currentId);
  if (!node || node.state !== "ACTIVE") return null;
  node.state = "CLEARED";
  return node;
}

/**
 * Get nodes reachable from current position (or starting nodes if no position)
 */
export function getReachableNodes(map: DelveMap): DelveNode[] {
  if (!map.currentNodeId) {
    // Start of run: only depth-0 origin layer nodes are reachable.
    const originId = nodeId(0, 0);
    const reachable = new Map<string, DelveNode>();
    const origin = map.nodes.get(originId);
    if (origin && canEnterNode(map, origin.id)) reachable.set(origin.id, origin);

    for (const edge of map.edges) {
      let targetId: string | null = null;
      if (edge.from === originId) targetId = edge.to;
      else if (edge.to === originId) targetId = edge.from;
      if (!targetId) continue;
      const node = map.nodes.get(targetId);
      if (node && canEnterNode(map, node.id)) reachable.set(node.id, node);
    }

    return Array.from(reachable.values());
  }

  const current = map.nodes.get(map.currentNodeId);
  if (!current) return [];

  // Find all connected nodes
  const reachable: DelveNode[] = [];
  for (const edge of map.edges) {
    let targetId: string | null = null;
    if (edge.from === map.currentNodeId) targetId = edge.to;
    else if (edge.to === map.currentNodeId) targetId = edge.from;

    if (targetId) {
      const node = map.nodes.get(targetId);
      if (node && canEnterNode(map, node.id)) reachable.push(node);
    }
  }

  return reachable;
}

/**
 * Move to a node (entry guard + activate destination)
 */
export function moveToNode(map: DelveMap, nodeId: string): DelveNode | null {
  return markNodeActive(map, nodeId);
}

/**
 * Get all nodes for rendering (visible area around current position)
 */
export function getVisibleNodes(map: DelveMap, radius: number = 5): DelveNode[] {
  if (!map.currentNodeId) {
    return Array.from(map.nodes.values());
  }

  const current = map.nodes.get(map.currentNodeId);
  if (!current) return Array.from(map.nodes.values());

  return Array.from(map.nodes.values()).filter(n => {
    const dx = Math.abs(n.x - current.x);
    const dy = Math.abs(n.y - current.y);
    return dx <= radius && dy <= radius;
  });
}

/**
 * Get edges for rendering (only those connecting visible nodes)
 */
export function getVisibleEdges(map: DelveMap, visibleNodes: DelveNode[]): DelveEdge[] {
  const visibleIds = new Set(visibleNodes.map(n => n.id));
  return map.edges.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to));
}

/**
 * Number of cleared nodes in this delve map.
 */
export function countClearedNodes(map: DelveMap): number {
  let n = 0;
  for (const node of map.nodes.values()) {
    if (node.state === "CLEARED") n++;
  }
  return n;
}

/**
 * Serialize delve node states for save-ready integration.
 */
export function serializeNodeStates(map: DelveMap): SerializedDelveNodeState[] {
  const rows: SerializedDelveNodeState[] = [];
  for (const node of map.nodes.values()) {
    rows.push({ nodeId: node.id, state: node.state });
  }
  rows.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  return rows;
}

/**
 * Hydrate known node states from serialized payload.
 * Unknown node IDs are ignored to remain forward/backward compatible.
 */
export function hydrateNodeStates(
  map: DelveMap,
  rows: Array<{ nodeId: string; state: DelveNodeState }> | null | undefined,
): void {
  if (!Array.isArray(rows)) return;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row.nodeId !== "string" || !isDelveNodeState(row.state)) continue;
    const node = map.nodes.get(row.nodeId);
    if (!node) continue;
    node.state = row.state;
  }
  normalizeCurrentNodeIdFromStates(map);
}

/**
 * Simple string hash for seeding RNG
 */
function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/**
 * Calculate difficulty scaling multiplier based on depth
 * Returns multipliers for various stats
 */
export function getDepthScaling(depth: number): {
  hpMult: number;
  damageMult: number;
  spawnRateMult: number;
} {
  // Exponential scaling that feels fair early but gets scary deep
  // Depth 1 = baseline (1.0x)
  // Depth 5 = ~1.5x HP, ~1.3x damage
  // Depth 10 = ~2.6x HP, ~1.7x damage
  // Depth 20 = ~7x HP, ~3x damage

  const d = Math.max(1, depth);

  return {
    // Doubled HP scaling: +20% per depth (was +10%)
    hpMult: Math.pow(1.2, d - 1),
    damageMult: Math.pow(1.05, d - 1),      // +5% per depth
    spawnRateMult: 1 + (d - 1) * 0.05,      // +5% spawn rate per depth (linear)
  };
}
