import { BUILDING_SKINS } from "../../../game/content/buildings";
import { CONTAINER_SKINS } from "../../../game/content/containers";
import { MAP_SKINS, DEFAULT_MAP_SKIN } from "../../../game/content/mapSkins";
import { PROPS } from "../../../game/content/props";

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

function collectRenderableSpriteIds(): ReadonlySet<string> {
  const ids = new Set<string>();

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
