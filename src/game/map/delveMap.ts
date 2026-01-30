// src/game/map/delveMap.ts
// Infinite Delve-style grid map (inspired by Path of Exile's Azurite Mine)

import type { StageId } from "../content/stages";
import { RNG } from "../util/rng";

export type DelveNode = {
  id: string;
  x: number;  // grid x coordinate
  y: number;  // grid y coordinate (depth - higher = deeper/harder)
  zoneId: StageId;
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

/**
 * Create a new delve map with a starting node at (0, 0)
 */
export function createDelveMap(seed: number): DelveMap {
  const rng = new RNG(seed);
  const nodes = new Map<string, DelveNode>();
  
  // Create starting node at depth 0
  const startZone = ZONE_IDS[rng.int(0, ZONE_IDS.length - 1)];
  const startNode: DelveNode = {
    id: nodeId(0, 0),
    x: 0,
    y: 0,
    zoneId: startZone,
    title: `${ZONE_NAMES[startZone]} (Depth 1)`,
    completed: false,
  };
  nodes.set(startNode.id, startNode);

  return {
    nodes,
    edges: [],
    currentNodeId: null,
    exploredDepth: 0,
  };
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
        const zoneRng = new RNG(seed ^ hashString(nid));
        const zoneId = ZONE_IDS[zoneRng.int(0, ZONE_IDS.length - 1)];
        const depth = ny + 1;
        
        const newNode: DelveNode = {
          id: nid,
          x: nx,
          y: ny,
          zoneId,
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
      const zoneRng = new RNG(seed ^ hashString(deeperId));
      const zoneId = ZONE_IDS[zoneRng.int(0, ZONE_IDS.length - 1)];
      const depth = from.y + 2;
      
      map.nodes.set(deeperId, {
        id: deeperId,
        x: from.x,
        y: from.y + 1,
        zoneId,
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
    // Start of run: only the origin node is reachable
    const origin = map.nodes.get(nodeId(0, 0));
    return origin ? [origin] : [];
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
