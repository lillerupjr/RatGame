import { BUILDING_SKINS } from "../../../game/content/buildings";
import { CONTAINER_SKINS } from "../../../game/content/containers";
import { MAP_SKINS, DEFAULT_MAP_SKIN } from "../../../game/content/mapSkins";
import { PROPS } from "../../../game/content/props";
import { RUNTIME_DECAL_SPRITE_IDS } from "../../../game/content/runtimeDecalConfig";
import { RUNTIME_FLOOR_VARIANT_COUNTS } from "../../../game/content/runtimeFloorConfig";

import { DIR8_ORDER } from "./dir8";

/* ── Entity sprite manifest ──────────────────────────────────────────────
 * Declares every entity skin that lives under public/assets-runtime/entities/.
 * This replaces the old import.meta.glob on src/assets/ so the runtime
 * asset directory is the single source of truth.
 *
 * nested = true  → files live under animations/{key}/{dir}/frame_NNN.png
 * nested = false → files live under {key}/{dir}/frame_NNN.png
 */
type AnimEntry = { key: string; frames: number; nested?: boolean };
type SkinEntry = { path: string; rotations?: boolean; anims?: AnimEntry[] };

const DIR_NAMES = [
  "north", "north-east", "east", "south-east",
  "south", "south-west", "west", "north-west",
] as const;

const ENTITY_MANIFEST: SkinEntry[] = [
  // animals
  { path: "animals/pigeon", rotations: true, anims: [{ key: "flying", frames: 10 }] },
  // enemies
  { path: "enemies/rat1", rotations: true, anims: [{ key: "running-4-frames", frames: 4 }] },
  { path: "enemies/rat2", rotations: true, anims: [{ key: "walk-4-frames", frames: 4 }] },
  { path: "enemies/rat3", rotations: true, anims: [{ key: "walk-4-frames", frames: 4 }] },
  { path: "enemies/rat4", rotations: true, anims: [{ key: "walk-4-frames", frames: 4 }] },
  { path: "enemies/bruiser", rotations: true, anims: [{ key: "walk-6-frames", frames: 6 }] },
  { path: "enemies/infested", rotations: true, anims: [{ key: "walk", frames: 6 }] },
  { path: "enemies/abomination", rotations: true, anims: [{ key: "walk-6-frames", frames: 6 }] },
  { path: "enemies/minotaur", rotations: true, anims: [
    { key: "walk-8-frames", frames: 8 },
    { key: "block", frames: 2 },
    { key: "hit_die", frames: 6 },
    { key: "idle", frames: 4 },
    { key: "swing", frames: 4 },
  ] },
  { path: "enemies/ratchemist", rotations: true, anims: [{ key: "walk", frames: 6 }] },
  // npc
  { path: "npc/vendor", rotations: true, anims: [{ key: "breathing-idle", frames: 4, nested: false }] },
  // player
  { path: "player/hobo", rotations: true, anims: [{ key: "walk", frames: 6 }] },
  { path: "player/jack", rotations: true, anims: [
    { key: "walk", frames: 6 },
    { key: "crouched-walking", frames: 6 },
  ] },
  { path: "player/jamal", rotations: true, anims: [{ key: "walk", frames: 6 }] },
  { path: "player/joey", rotations: true, anims: [
    { key: "walk", frames: 6 },
    { key: "running-4-frames", frames: 4 },
  ] },
  { path: "player/tommy", rotations: true, anims: [{ key: "walk", frames: 6 }] },
];

function addId(set: Set<string>, id: string | undefined): void {
  if (!id) return;
  const trimmed = id.trim();
  if (!trimmed) return;
  const noExt = trimmed.toLowerCase().endsWith(".png") ? trimmed.slice(0, -4) : trimmed;
  set.add(noExt);
}

function addSemanticValue(set: Set<string>, value: string | string[] | undefined): void {
  if (!value) return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) addId(set, value[i]);
    return;
  }
  addId(set, value);
}

/**
 * Register runtime-generated (non-authored) floor + decal sprite IDs so URL resolution
 * and caching work consistently with the rest of the render sprite pipeline.
 */
function addRuntimeFloorAndDecalSpriteIds(out: Set<string>) {
  // Floors: tiles/floor/<family>/<variantIndex>
  for (const [family, count] of Object.entries(RUNTIME_FLOOR_VARIANT_COUNTS)) {
    const n = Math.max(0, count | 0);
    for (let i = 1; i <= n; i++) {
      out.add(`tiles/floor/${family}/${i}`);
    }
  }

  // Decals: explicit IDs from config
  for (const ids of Object.values(RUNTIME_DECAL_SPRITE_IDS)) {
    for (let i = 0; i < ids.length; i++) out.add(ids[i]);
  }
}

function addEntitySpriteIds(out: Set<string>): void {
  for (const skin of ENTITY_MANIFEST) {
    if (skin.rotations) {
      for (const dir of DIR_NAMES) {
        out.add(`entities/${skin.path}/rotations/${dir}`);
      }
    }
    if (skin.anims) {
      for (const anim of skin.anims) {
        const nested = anim.nested !== false;
        const base = nested
          ? `entities/${skin.path}/animations/${anim.key}`
          : `entities/${skin.path}/${anim.key}`;
        for (const dir of DIR_NAMES) {
          for (let i = 0; i < anim.frames; i++) {
            out.add(`${base}/${dir}/frame_${String(i).padStart(3, "0")}`);
          }
        }
      }
    }
  }
}

function collectRenderableSpriteIds(): ReadonlySet<string> {
  const ids = new Set<string>();

  addRuntimeFloorAndDecalSpriteIds(ids);
  addEntitySpriteIds(ids);
  for (let i = 1; i <= 6; i++) {
    addId(ids, `tiles/animated/water2/${i}`);
  }
  for (let i = 1; i <= 4; i++) {
    addId(ids, `tiles/animated/water1/${i}`);
  }

  addId(ids, DEFAULT_MAP_SKIN.floor);
  addId(ids, DEFAULT_MAP_SKIN.apron);
  addId(ids, DEFAULT_MAP_SKIN.wall);
  addId(ids, DEFAULT_MAP_SKIN.stair);
  addId(ids, DEFAULT_MAP_SKIN.stairApron);
  addId(ids, DEFAULT_MAP_SKIN.background);

  for (const skin of Object.values(MAP_SKINS)) {
    addId(ids, skin.floor);
    addId(ids, skin.apron);
    addId(ids, skin.wall);
    addId(ids, skin.stair);
    addId(ids, skin.stairApron);
    addId(ids, skin.background);
    if (skin.semantic) {
      for (const value of Object.values(skin.semantic)) {
        addSemanticValue(ids, value);
      }
    }
  }

  for (const skin of Object.values(BUILDING_SKINS)) {
    addId(ids, skin.roof);
    for (let i = 0; i < skin.wallSouth.length; i++) addId(ids, skin.wallSouth[i]);
    for (let i = 0; i < skin.wallEast.length; i++) addId(ids, skin.wallEast[i]);
  }

  for (const skin of Object.values(CONTAINER_SKINS)) {
    addId(ids, skin.roof);
    for (let i = 0; i < skin.wallSouth.length; i++) addId(ids, skin.wallSouth[i]);
    for (let i = 0; i < skin.wallEast.length; i++) addId(ids, skin.wallEast[i]);
  }

  for (const prop of Object.values(PROPS)) {
    addId(ids, prop.sprite);
    if (prop.spriteDir8) {
      for (const dir of DIR8_ORDER) {
        addId(ids, `${prop.spriteDir8}_${dir}`);
      }
    }
  }

  return ids;
}

const RENDERABLE_SPRITE_IDS = collectRenderableSpriteIds();

export function isKnownRenderableSpriteId(spriteId: string): boolean {
  const trimmed = spriteId.trim();
  const noExt = trimmed.toLowerCase().endsWith(".png") ? trimmed.slice(0, -4) : trimmed;
  return RENDERABLE_SPRITE_IDS.has(noExt);
}

export function getRenderableSpriteIds(): ReadonlySet<string> {
  return RENDERABLE_SPRITE_IDS;
}
