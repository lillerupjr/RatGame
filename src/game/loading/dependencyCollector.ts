import { getActiveMapDef } from "../map/authoredMapActivation";
import { getActiveMap } from "../map/compile/kenneyMap";
import { PLAYABLE_CHARACTERS } from "../content/playableCharacters";
import { listProjectileTravelSpriteIds } from "../content/projectilePresentationRegistry";
import { listEnemyDynamicAtlasSpriteIds } from "../../engine/render/sprites/enemySprites";
import { listBossDynamicAtlasSpriteIds } from "../../engine/render/sprites/bossSprites";

export interface DependencySet {
  spriteIds: string[];
  audioIds: string[];
}

function isPrewarmableSpriteId(spriteId: string): boolean {
  const id = spriteId.trim().replace(/\.png$/i, "");
  if (
    id === "tiles/floor/decals/sidewalk_2"
    || id === "tiles/walls/sidewalk_s"
    || id === "tiles/walls/sidewalk_e"
  ) {
    return false;
  }
  return id.startsWith("tiles/")
    || id.startsWith("structures/")
    || id.startsWith("props/")
    || id.startsWith("entities/")
    || id.startsWith("loot/")
    || id.startsWith("vfx/")
    || id.startsWith("projectiles/");
}

export function collectFloorDependencies(): DependencySet {
  const mapDef = getActiveMapDef() as any;
  const compiled = getActiveMap() as any;

  const spriteIds = new Set<string>();
  const audioIds = new Set<string>();
  const addSpriteId = (id: string): void => {
    const normalized = id.trim().replace(/\.png$/i, "");
    if (!normalized) return;
    if (!isPrewarmableSpriteId(normalized)) return;
    spriteIds.add(normalized);
  };

  if (Array.isArray(mapDef?.spritesUsed)) {
    for (const id of mapDef.spritesUsed) {
      if (typeof id === "string" && id.trim()) addSpriteId(id);
    }
  }

  if (Array.isArray(compiled?.overlays)) {
    for (const p of compiled.overlays) {
      if (p && typeof p.spriteId === "string") addSpriteId(p.spriteId);
    }
  }

  if (Array.isArray(compiled?.decals)) {
    for (const p of compiled.decals) {
      if (p && typeof p.spriteId === "string") addSpriteId(p.spriteId);
    }
  }

  // Player core frames for all selectable characters (rotation + walk dir/frame).
  for (const ch of PLAYABLE_CHARACTERS) {
    const skin = ch.idleSpriteKey;
    for (const dir of ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]) {
      spriteIds.add(`entities/player/${skin}/rotations/${dir}`);
      for (let i = 0; i < 6; i++) {
        const frame = `frame_${String(i).padStart(3, "0")}`;
        spriteIds.add(`entities/player/${skin}/animations/walk/${dir}/${frame}`);
      }
    }
  }

  for (const id of listEnemyDynamicAtlasSpriteIds()) {
    spriteIds.add(id);
  }

  for (const id of listBossDynamicAtlasSpriteIds()) {
    spriteIds.add(id);
  }

  for (const id of listProjectileTravelSpriteIds()) {
    spriteIds.add(id);
  }

  // Vendor idle set.
  for (const dir of ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]) {
    for (let i = 0; i < 4; i++) {
      const frame = `frame_${String(i).padStart(3, "0")}`;
      spriteIds.add(`entities/npc/vendor/breathing-idle/${dir}/${frame}`);
    }
  }

  // Neutral pigeon core set.
  for (const dir of ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]) {
    for (let i = 0; i < 10; i++) {
      const frame = `frame_${String(i).padStart(3, "0")}`;
      spriteIds.add(`entities/animals/pigeon/rotations/${dir}/${frame}`);
      spriteIds.add(`entities/animals/pigeon/animations/flying/${dir}/${frame}`);
    }
  }

  audioIds.add("FLOOR_START");

  return {
    spriteIds: Array.from(spriteIds),
    audioIds: Array.from(audioIds),
  };
}
