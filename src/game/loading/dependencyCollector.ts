import { getActiveMapDef } from "../map/proceduralMapBridge";
import { getActiveMap } from "../map/compile/kenneyMap";

export interface DependencySet {
  spriteIds: string[];
  audioIds: string[];
}

export function collectFloorDependencies(): DependencySet {
  const mapDef = getActiveMapDef() as any;
  const compiled = getActiveMap() as any;

  const spriteIds = new Set<string>();
  const audioIds = new Set<string>();

  if (Array.isArray(mapDef?.spritesUsed)) {
    for (const id of mapDef.spritesUsed) {
      if (typeof id === "string" && id.trim()) spriteIds.add(id.trim().replace(/\.png$/i, ""));
    }
  }

  if (Array.isArray(compiled?.overlays)) {
    for (const p of compiled.overlays) {
      if (p && typeof p.spriteId === "string") spriteIds.add(p.spriteId.replace(/\.png$/i, ""));
    }
  }

  if (Array.isArray(compiled?.decals)) {
    for (const p of compiled.decals) {
      if (p && typeof p.spriteId === "string") spriteIds.add(p.spriteId.replace(/\.png$/i, ""));
    }
  }

  audioIds.add("FLOOR_START");

  return {
    spriteIds: Array.from(spriteIds),
    audioIds: Array.from(audioIds),
  };
}
