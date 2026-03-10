import { getActiveMapDef } from "../map/authoredMapActivation";
import { getActiveMap } from "../map/compile/kenneyMap";
import { PLAYABLE_CHARACTERS } from "../content/playableCharacters";

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

  // Enemy core packs used by runtime enemy sprites.
  const enemyDefs: Array<{ skin: string; anim?: string; frameCount?: number }> = [
    { skin: "rat1", anim: "running-4-frames", frameCount: 4 },
    { skin: "rat2", anim: "walk-4-frames", frameCount: 4 },
    { skin: "rat4", anim: "walk-4-frames", frameCount: 4 },
    { skin: "lootGoblin", anim: "walk", frameCount: 6 },
    { skin: "infested", anim: "walk", frameCount: 4 },
  ];
  for (const def of enemyDefs) {
    for (const dir of ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]) {
      spriteIds.add(`entities/enemies/${def.skin}/rotations/${dir}`);
      if (def.anim && Number.isFinite(def.frameCount)) {
        const frameCount = Math.max(0, def.frameCount ?? 0);
        for (let i = 0; i < frameCount; i++) {
          const frame = `frame_${String(i).padStart(3, "0")}`;
          spriteIds.add(`entities/enemies/${def.skin}/animations/${def.anim}/${dir}/${frame}`);
        }
      }
    }
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
