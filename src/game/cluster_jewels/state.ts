import { getClusterJewelCategoryDef, getClusterJewelNodeDef, isClusterJewelCategory } from "./content";
import type {
  ClusterJewelInstance,
  ClusterJewelSmallNodeIds,
  ClusterJewelSource,
} from "./types";

type ClusterJewelRuntimeState = {
  clusterJewels: ClusterJewelInstance[];
  clusterJewelSkillPoints: number;
};

function cloneClusterJewelInstance(instance: ClusterJewelInstance): ClusterJewelInstance {
  return {
    id: instance.id,
    category: instance.category,
    smallNodeIds: [...instance.smallNodeIds] as ClusterJewelSmallNodeIds,
    notableNodeId: instance.notableNodeId,
    source: instance.source,
    allocatedNodeIds: [...instance.allocatedNodeIds],
  };
}

function normalizeClusterJewelSource(raw: unknown, fallbackSource: ClusterJewelSource): ClusterJewelSource {
  switch (raw) {
    case "starter":
    case "generated":
    case "drop":
    case "vendor":
    case "reward":
    case "debug":
      return raw;
    default:
      return fallbackSource;
  }
}

function normalizeClusterJewelInstance(
  raw: unknown,
  fallbackSource: ClusterJewelSource,
): ClusterJewelInstance | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (!id) return null;

  const category = record.category;
  if (!isClusterJewelCategory(category)) return null;
  const categoryDef = getClusterJewelCategoryDef(category);
  if (!categoryDef) return null;

  const smallNodeIdsRaw = Array.isArray(record.smallNodeIds) ? record.smallNodeIds : [];
  if (smallNodeIdsRaw.length !== 4) return null;
  const smallNodeIds = smallNodeIdsRaw.map((nodeId) => (typeof nodeId === "string" ? nodeId.trim() : ""));
  for (let i = 0; i < smallNodeIds.length; i++) {
    const nodeDef = getClusterJewelNodeDef(smallNodeIds[i]);
    if (!nodeDef || nodeDef.category !== category || nodeDef.size !== "SMALL") return null;
  }

  const notableNodeId = typeof record.notableNodeId === "string" ? record.notableNodeId.trim() : "";
  const notableNodeDef = getClusterJewelNodeDef(notableNodeId);
  if (!notableNodeDef || notableNodeDef.category !== category || notableNodeDef.size !== "NOTABLE") {
    return null;
  }

  const validNodeIds = new Set<string>([...smallNodeIds, notableNodeId]);
  const allocatedNodeIdsRaw = Array.isArray(record.allocatedNodeIds) ? record.allocatedNodeIds : [];
  const allocatedNodeIds: string[] = [];
  const seenAllocated = new Set<string>();
  for (let i = 0; i < allocatedNodeIdsRaw.length; i++) {
    const nodeId = typeof allocatedNodeIdsRaw[i] === "string" ? allocatedNodeIdsRaw[i].trim() : "";
    if (!nodeId || seenAllocated.has(nodeId) || !validNodeIds.has(nodeId)) continue;
    seenAllocated.add(nodeId);
    allocatedNodeIds.push(nodeId);
  }

  return {
    id,
    category,
    smallNodeIds: [...smallNodeIds] as ClusterJewelSmallNodeIds,
    notableNodeId,
    source: normalizeClusterJewelSource(record.source, fallbackSource),
    allocatedNodeIds,
  };
}

export function normalizeClusterJewelInstanceList(
  instances: readonly ClusterJewelInstance[] | readonly unknown[] | null | undefined,
  fallbackSource: ClusterJewelSource = "generated",
): ClusterJewelInstance[] {
  if (!Array.isArray(instances) || instances.length <= 0) return [];
  const out: ClusterJewelInstance[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < instances.length; i++) {
    const normalized = normalizeClusterJewelInstance(instances[i], fallbackSource);
    if (!normalized || seenIds.has(normalized.id)) continue;
    seenIds.add(normalized.id);
    out.push(normalized);
  }
  return out;
}

export function ensureClusterJewelState(world: any): ClusterJewelRuntimeState {
  if (!world || typeof world !== "object") {
    throw new Error("[clusterJewels] World-like object is required.");
  }

  const normalizedJewels = normalizeClusterJewelInstanceList(world.clusterJewels ?? [], "generated");
  world.clusterJewels = normalizedJewels;

  if (!Number.isFinite(world.clusterJewelSkillPoints) || (world.clusterJewelSkillPoints ?? 0) < 0) {
    world.clusterJewelSkillPoints = 0;
  } else {
    world.clusterJewelSkillPoints = Math.max(0, Math.floor(world.clusterJewelSkillPoints));
  }

  return {
    clusterJewels: world.clusterJewels as ClusterJewelInstance[],
    clusterJewelSkillPoints: world.clusterJewelSkillPoints as number,
  };
}

export function getWorldClusterJewels(world: any): ClusterJewelInstance[] {
  const state = ensureClusterJewelState(world);
  return state.clusterJewels.map((instance) => cloneClusterJewelInstance(instance));
}

export function setWorldClusterJewels(world: any, instances: readonly ClusterJewelInstance[]): void {
  ensureClusterJewelState(world);
  world.clusterJewels = normalizeClusterJewelInstanceList(instances, "generated");
}

export function addClusterJewelSkillPoints(world: any, amount: number): number {
  const state = ensureClusterJewelState(world);
  const gained = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  if (gained <= 0) return 0;
  world.clusterJewelSkillPoints = state.clusterJewelSkillPoints + gained;
  return gained;
}
