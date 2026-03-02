import type { World } from "../../../engine/world/world";
import { STARTER_RELIC_BY_CHARACTER } from "../../content/starterRelics";
import type { PlayableCharacterId } from "../../content/playableCharacters";
import {
  getWorldRelicInstances,
  setWorldRelicInstances,
} from "./relics";

export function ensureStarterRelicForCharacter(world: World, characterId: PlayableCharacterId): string | null {
  const starterRelicId = STARTER_RELIC_BY_CHARACTER[characterId];
  if (!starterRelicId) return null;

  const instances = getWorldRelicInstances(world);
  const next = instances.filter((it) => !(it.source === "starter" && it.id !== starterRelicId));
  const existingIndex = next.findIndex((it) => it.id === starterRelicId);

  if (existingIndex >= 0) {
    next[existingIndex] = {
      id: starterRelicId,
      source: "starter",
      isLocked: true,
    };
  } else {
    next.push({
      id: starterRelicId,
      source: "starter",
      isLocked: true,
    });
  }

  setWorldRelicInstances(world, next);
  return starterRelicId;
}
