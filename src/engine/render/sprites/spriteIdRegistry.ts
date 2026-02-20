import { BUILDING_SKINS } from "../../../game/content/buildings";
import { CONTAINER_SKINS } from "../../../game/content/containers";
import { MAP_SKINS, DEFAULT_MAP_SKIN } from "../../../game/content/mapSkins";
import { PROPS } from "../../../game/content/props";
import { RUNTIME_DECAL_SPRITE_IDS } from "../../../game/content/runtimeDecalConfig";
import { RUNTIME_FLOOR_VARIANT_COUNTS } from "../../../game/content/runtimeFloorConfig";

import { DIR8_ORDER } from "./dir8";

const ENTITY_ASSET_MODULES = import.meta.glob("../../../assets/**/*.{png,PNG}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

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
  for (const fullPath of Object.keys(ENTITY_ASSET_MODULES)) {
    const marker = "/assets/";
    const idx = fullPath.indexOf(marker);
    if (idx === -1) continue;
    const rel = fullPath.slice(idx + marker.length).replace(/\\/g, "/");
    const noExt = rel.toLowerCase().endsWith(".png") ? rel.slice(0, -4) : rel;
    out.add(`entities/${noExt}`);
  }
}

function collectRenderableSpriteIds(): ReadonlySet<string> {
  const ids = new Set<string>();

  addRuntimeFloorAndDecalSpriteIds(ids);
  addEntitySpriteIds(ids);
  for (let i = 1; i <= 6; i++) {
    addId(ids, `tiles/animated/water2/${i}`);
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
