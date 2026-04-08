import type { PlayableCharacterId } from "../content/playableCharacters";
import { PLAYABLE_CHARACTERS } from "../content/playableCharacters";
import { getClusterJewelCategoryDef, getClusterJewelNodeDef } from "./content";
import type { ClusterJewelInstance, ClusterJewelSmallNodeIds, StarterClusterJewelDef } from "./types";

export const STARTER_CLUSTER_JEWEL_ID_BY_CHARACTER: Record<PlayableCharacterId, string> = {
  HOBO: "STARTER_CLUSTER_JEWEL_HOBO_POISON",
  JACK: "STARTER_CLUSTER_JEWEL_JACK_CRITICAL_HITS",
  JAMAL: "STARTER_CLUSTER_JEWEL_JAMAL_PROJECTILE",
  JOEY: "STARTER_CLUSTER_JEWEL_JOEY_IGNITE",
  TOMMY: "STARTER_CLUSTER_JEWEL_TOMMY_PHYSICAL",
};

export const STARTER_CLUSTER_JEWELS: Record<PlayableCharacterId, StarterClusterJewelDef> = {
  HOBO: {
    jewelId: STARTER_CLUSTER_JEWEL_ID_BY_CHARACTER.HOBO,
    characterId: "HOBO",
    category: "POISON",
    notableNodeId: "POISON_NOTABLE_DAMAGE_30",
  },
  JACK: {
    jewelId: STARTER_CLUSTER_JEWEL_ID_BY_CHARACTER.JACK,
    characterId: "JACK",
    category: "CRITICAL_HITS",
    notableNodeId: "CRITICAL_HITS_NOTABLE_MULTI_40",
  },
  JAMAL: {
    jewelId: STARTER_CLUSTER_JEWEL_ID_BY_CHARACTER.JAMAL,
    characterId: "JAMAL",
    category: "PROJECTILE",
    notableNodeId: "PROJECTILE_NOTABLE_PROJECTILES_ADD_1",
  },
  JOEY: {
    jewelId: STARTER_CLUSTER_JEWEL_ID_BY_CHARACTER.JOEY,
    characterId: "JOEY",
    category: "IGNITE",
    notableNodeId: "IGNITE_NOTABLE_DAMAGE_30",
  },
  TOMMY: {
    jewelId: STARTER_CLUSTER_JEWEL_ID_BY_CHARACTER.TOMMY,
    characterId: "TOMMY",
    category: "PHYSICAL",
    notableNodeId: "PHYSICAL_NOTABLE_DAMAGE_30",
  },
};

function buildStarterSmallNodeIds(characterId: PlayableCharacterId): ClusterJewelSmallNodeIds {
  const starter = STARTER_CLUSTER_JEWELS[characterId];
  const categoryDef = getClusterJewelCategoryDef(starter.category);
  if (!categoryDef || categoryDef.smallNodeIds.length <= 0) {
    throw new Error(`[clusterJewels] Missing small pool for starter jewel ${characterId}.`);
  }
  return [
    categoryDef.smallNodeIds[0 % categoryDef.smallNodeIds.length],
    categoryDef.smallNodeIds[1 % categoryDef.smallNodeIds.length],
    categoryDef.smallNodeIds[2 % categoryDef.smallNodeIds.length],
    categoryDef.smallNodeIds[3 % categoryDef.smallNodeIds.length],
  ];
}

export function getStarterClusterJewelForCharacter(characterId: PlayableCharacterId): ClusterJewelInstance | null {
  const starter = STARTER_CLUSTER_JEWELS[characterId];
  if (!starter) return null;
  return {
    id: starter.jewelId,
    category: starter.category,
    smallNodeIds: buildStarterSmallNodeIds(characterId),
    notableNodeId: starter.notableNodeId,
    source: "starter",
    allocatedNodeIds: [],
  };
}

export function validateStarterClusterJewels(): void {
  const errors: string[] = [];
  const seenJewelIds = new Set<string>();

  for (let i = 0; i < PLAYABLE_CHARACTERS.length; i++) {
    const characterId = PLAYABLE_CHARACTERS[i].id;
    const starter = STARTER_CLUSTER_JEWELS[characterId];
    if (!starter) {
      errors.push(`Missing starter cluster jewel mapping for character ${characterId}.`);
      continue;
    }
    if (seenJewelIds.has(starter.jewelId)) {
      errors.push(`Starter cluster jewel ${starter.jewelId} is assigned to multiple characters.`);
      continue;
    }
    seenJewelIds.add(starter.jewelId);
    const categoryDef = getClusterJewelCategoryDef(starter.category);
    if (!categoryDef) {
      errors.push(`Starter cluster jewel ${starter.jewelId} references invalid category ${starter.category}.`);
      continue;
    }
    if (!categoryDef.notableNodeIds.includes(starter.notableNodeId)) {
      errors.push(`Starter cluster jewel ${starter.jewelId} notable ${starter.notableNodeId} is not in category ${starter.category}.`);
    }
    const smallNodeIds = buildStarterSmallNodeIds(characterId);
    for (let j = 0; j < smallNodeIds.length; j++) {
      if (!categoryDef.smallNodeIds.includes(smallNodeIds[j])) {
        errors.push(`Starter cluster jewel ${starter.jewelId} small node ${smallNodeIds[j]} is not in category ${starter.category}.`);
      }
    }
    const notableNode = getClusterJewelNodeDef(starter.notableNodeId);
    if (!notableNode || notableNode.size !== "NOTABLE") {
      errors.push(`Starter cluster jewel ${starter.jewelId} notable ${starter.notableNodeId} is invalid.`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`[starterClusterJewels] Validation failed:\n- ${errors.join("\n- ")}`);
  }
}
