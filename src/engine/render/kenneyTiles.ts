import { resolveMapSkin } from "../../game/content/mapSkins";
import { resolveTileSpriteId } from "../../game/map/skins/tileSpriteResolver";
import { getTileSpriteById, type LoadedImg } from "./sprites/renderSprites";

export type Loaded = { img: HTMLImageElement; ready: boolean; src?: string };

// World-size of ONE tile in your physics world units.
// Tune later; for now keep it simple and stable.
export const KENNEY_TILE_WORLD = 64;

// Simple anchor tweak so the tile "sits" nicer (adjust later per tile set).
export const KENNEY_TILE_ANCHOR_Y = 0.55;

function toLoaded(rec: LoadedImg): Loaded {
    return { img: rec.img, ready: rec.ready };
}

export function preloadKenneyTiles() {
    void getKenneyGroundTile();
    void getKenneyStairsTile();
}

export function getKenneyGroundTile(): Loaded {
    const mapSkin = resolveMapSkin();
    const spriteId = resolveTileSpriteId({ slot: "floor", mapSkin });
    return toLoaded(getTileSpriteById(spriteId));
}

// New: load by authored skin (tile.skin), with fallback to ground
export function getKenneyTileBySkin(skin?: string): Loaded {
    const mapSkin = resolveMapSkin();
    const spriteId = resolveTileSpriteId({
        slot: "floor",
        mapSkin,
        tileOverride: skin ? { floor: skin } : undefined,
    });
    return toLoaded(getTileSpriteById(spriteId));
}

// Back-compat: keep old API (defaults to "north" stairs art)
export function getKenneyStairsTile(): Loaded {
    const mapSkin = resolveMapSkin();
    const spriteId = resolveTileSpriteId({ slot: "stair", dir: "N", mapSkin });
    return toLoaded(getTileSpriteById(spriteId));
}
