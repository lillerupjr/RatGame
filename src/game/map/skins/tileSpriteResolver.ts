import { DEFAULT_MAP_SKIN, type MapSkinBundle, type ResolvedMapSkin } from "../../content/mapSkins";

export type TileSpriteSlot = keyof ResolvedMapSkin;
export type TileSpriteDir = "N" | "E" | "S" | "W";

export type TileSpriteRequest = {
    slot: TileSpriteSlot;
    dir?: TileSpriteDir;
    mapSkin: ResolvedMapSkin;
    tileOverride?: MapSkinBundle;
    mapDefaults?: MapSkinBundle;
};

function normalizeId(id?: string): string | undefined {
    if (!id) return undefined;
    const trimmed = id.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function stripPng(id: string): string {
    return id.toLowerCase().endsWith("water1.png") ? id.slice(0, -4) : id;
}

function appendSuffix(base: string, suffix: string): string {
    if (base.endsWith(`_${suffix}`)) return base;
    return `${base}_${suffix}`;
}

function apronSuffix(dir?: TileSpriteDir): string | null {
    if (!dir) return null;
    return dir === "E" || dir === "W" ? "e" : "s";
}

function stairSuffix(dir?: TileSpriteDir): string | null {
    if (!dir) return null;
    return dir.toLowerCase();
}

export function resolveTileSpriteId(request: TileSpriteRequest): string {
    const slot = request.slot;
    const overrideId = normalizeId(request.tileOverride?.[slot]);
    const skinId = normalizeId(request.mapSkin[slot]);
    const mapDefaultId = normalizeId(request.mapDefaults?.[slot]);
    const fallbackId = normalizeId(DEFAULT_MAP_SKIN[slot]);

    const base = overrideId ?? skinId ?? mapDefaultId ?? fallbackId;
    if (!base) return "";

    const stripped = stripPng(base);

    if (slot === "floor") return stripped;

    if (slot === "apron" || slot === "wall") {
        const suffix = apronSuffix(request.dir);
        return suffix ? appendSuffix(stripped, suffix) : stripped;
    }

    const stairDir = stairSuffix(request.dir);
    return stairDir ? appendSuffix(stripped, stairDir) : stripped;
}
