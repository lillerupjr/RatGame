import type { World } from "../../../engine/world/world";
import type { PlayableCharacterId } from "../../content/playableCharacters";
import { getStarterClusterJewelForCharacter } from "../../cluster_jewels/starterJewels";
import { getWorldClusterJewels, setWorldClusterJewels } from "../../cluster_jewels/state";

export function ensureStarterClusterJewelForCharacter(world: World, characterId: PlayableCharacterId): string | null {
  const starter = getStarterClusterJewelForCharacter(characterId);
  if (!starter) return null;

  const nextJewels = getWorldClusterJewels(world).filter((instance) => {
    return !(instance.source === "starter" && instance.id !== starter.id);
  });
  const existingIndex = nextJewels.findIndex((instance) => instance.id === starter.id);

  if (existingIndex >= 0) {
    const existing = nextJewels[existingIndex];
    const validNodeIds = new Set<string>([...starter.smallNodeIds, starter.notableNodeId]);
    const allocatedNodeIds = existing.allocatedNodeIds.filter((nodeId) => validNodeIds.has(nodeId));
    nextJewels[existingIndex] = {
      ...starter,
      allocatedNodeIds,
    };
  } else {
    nextJewels.push(starter);
  }

  setWorldClusterJewels(world, nextJewels);
  return starter.id;
}
