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

export type DelveNode = {
  id: string;
  x: number;  // grid x coordinate
  y: number;  // grid y coordinate (depth - higher = deeper/harder)
  zoneId: StageId;
  floorArchetype: FloorArchetype;
  plan: NodePlan;
  title: string;
  completed: boolean;
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

function nodeId(x: number, y: number): string {
  return `${x},${y}`;
}

function parseNodeId(id: string): { x: number; y: number } {
  const [xs, ys] = id.split(",");
  return { x: parseInt(xs, 10), y: parseInt(ys, 10) };
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

function buildNodePlan(rng: RNG, depth: number, archetype: FloorArchetype): NodePlan {
  const mapId = (() => {
    if (archetype === "VENDOR") return "SHOP" as MapId;
    if (archetype === "HEAL") return "REST" as MapId;
    return pickMapId(rng);
  })();
  return {
    depth,
    mapId,
    objectiveId: objectiveIdFromArchetype(archetype),
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
    completed: false,
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
          completed: false,
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
        completed: false,
      });
    }
    map.edges.push({ from: fromId, to: deeperId });
  }
}

/**
 * Get nodes reachable from current position (or starting nodes if no position)
 */
export function getReachableNodes(map: DelveMap): DelveNode[] {
  if (!map.currentNodeId) {
    // Start of run: origin + its connected neighbors are reachable
    const originId = nodeId(0, 0);
    const reachable = new Map<string, DelveNode>();
    const origin = map.nodes.get(originId);
    if (origin) reachable.set(origin.id, origin);

    for (const edge of map.edges) {
      let targetId: string | null = null;
      if (edge.from === originId) targetId = edge.to;
      else if (edge.to === originId) targetId = edge.from;
      if (!targetId) continue;
      const node = map.nodes.get(targetId);
      if (node) reachable.set(node.id, node);
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
      if (node) reachable.push(node);
    }
  }

  return reachable;
}

/**
 * Move to a node (marks current as completed, updates position)
 */
export function moveToNode(map: DelveMap, nodeId: string): DelveNode | null {
  const node = map.nodes.get(nodeId);
  if (!node) return null;

  // Mark previous node as completed
  if (map.currentNodeId) {
    const prev = map.nodes.get(map.currentNodeId);
    if (prev) prev.completed = true;
  }

  map.currentNodeId = nodeId;
  map.exploredDepth = Math.max(map.exploredDepth, node.y);

  return node;
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
  xpMult: number;
} {
  // Exponential scaling that feels fair early but gets scary deep
  // Depth 1 = baseline (1.0x)
  // Depth 5 = ~1.5x HP, ~1.3x damage
  // Depth 10 = ~2.6x HP, ~1.7x damage
  // Depth 20 = ~7x HP, ~3x damage

  const d = Math.max(1, depth);

  return {
    hpMult: Math.pow(1.1, d - 1),           // +10% per depth
    damageMult: Math.pow(1.05, d - 1),      // +5% per depth
    spawnRateMult: 1 + (d - 1) * 0.05,      // +5% spawn rate per depth (linear)
    xpMult: 1 + (d - 1) * 0.1,              // +10% XP per depth
  };
}
