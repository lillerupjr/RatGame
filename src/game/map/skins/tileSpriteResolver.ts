import { DEFAULT_MAP_SKIN, resolveSemanticSprite, type MapSkinBundle, type MapSkinId, type ResolvedMapSkin } from "../../content/mapSkins";

export type TileSpriteSlot = "floor" | "apron" | "wall" | "stair" | "stairApron";
export type TileSpriteDir = "N" | "E" | "S" | "W";

export type TileSpriteRequest = {
    slot: TileSpriteSlot;
    dir?: TileSpriteDir;
    mapSkin: ResolvedMapSkin;
    mapSkinId?: MapSkinId;
    tileOverride?: MapSkinBundle;
    mapDefaults?: MapSkinBundle;
};

function normalizeId(id?: string): string | undefined {
    if (!id) return undefined;
    const trimmed = id.trim();
    if (trimmed.length === 0) return undefined;
    const lowered = trimmed.toLowerCase();
    if (lowered === "none" || lowered === "void" || lowered === "null" || lowered === "off") {
        return undefined;
    }
    return trimmed;
}

function stripPng(id: string): string {
    return id.toLowerCase().endsWith(".png") ? id.slice(0, -4) : id;
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

function remapLegacyTileId(base: string): string {
    const directMap: Record<string, string> = {
        "tiles/floor/top/sidewalk": "tiles/floor/sidewalk/1",
        "tiles/floor/top/road": "tiles/floor/asphalt/1",
        "tiles/floor/top/asphalt": "tiles/floor/asphalt/1",
        "tiles/floor/top/park": "tiles/floor/park/1",
        "tiles/floor/top/stone": "tiles/floor/asphalt/1",
        "tiles/floor/top/green": "tiles/floor/park/1",

        "tiles/floor/curtain/sidewalk": "tiles/walls/sidewalk",
        "tiles/floor/curtain/asphalt": "tiles/walls/asphalt",
        "tiles/floor/curtain/park": "tiles/walls/green",
        "tiles/floor/curtain/stone": "tiles/walls/stone",
        "tiles/floor/curtain/green": "tiles/walls/green",
        "tiles/floor/curtain/docks": "tiles/walls/docks",

        "tiles/stairs/top/stone": "tiles/stairs/stone/stone",
    };
    return directMap[base] ?? base;
}

export function resolveTileSpriteId(request: TileSpriteRequest): string {
    const slot = request.slot;
    const semanticKey = (() => {
        switch (slot) {
            case "floor": return "FLOOR";
            case "apron": return "APRON";
            case "wall": return "WALL";
            case "stair": return "STAIR";
            case "stairApron": return "STAIR_APRON";
            default: return "";
        }
    })();
    const semanticId = semanticKey && request.mapSkinId ? resolveSemanticSprite(request.mapSkinId, semanticKey) : "";
    const overrideId = normalizeId(request.tileOverride?.[slot]);
    const skinId = normalizeId(request.mapSkin[slot]);
    const mapDefaultId = normalizeId(request.mapDefaults?.[slot]);
    const fallbackId = normalizeId(DEFAULT_MAP_SKIN[slot]);

    const base = normalizeId(semanticId) ?? overrideId ?? skinId ?? mapDefaultId ?? fallbackId;
    if (!base) return "";

    const stripped = remapLegacyTileId(stripPng(base));

    if (slot === "floor") return stripped;

    if (slot === "apron" || slot === "wall") {
        const suffix = apronSuffix(request.dir);
        return suffix ? appendSuffix(stripped, suffix) : stripped;
    }

    const stairDir = stairSuffix(request.dir);
    return stairDir ? appendSuffix(stripped, stairDir) : stripped;
}
