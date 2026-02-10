export type MapSkinId = string;

export type MapSkinBundle = {
    floor?: string;
    apron?: string;
    wall?: string;
    stair?: string;
    stairApron?: string;

    background?: string;
};

export type ResolvedMapSkin = {
    floor: string;
    apron: string;
    wall: string;
    stair: string;
    stairApron: string;


    background: string;
};

export const MAP_SKIN_SEMANTIC: Record<MapSkinId, Record<string, string | string[]>> = {
    building1: {
        BUILDING_WALL_SOUTH: [
            "buildings/3x2x8/building1/building1_s_1",
            "buildings/3x2x8/building1/building1_s_2",
            "buildings/3x2x8/building1/building1_s_3",
        ],
        BUILDING_WALL_EAST: [
            "buildings/3x2x8/building1/building1_e_1",
            "buildings/3x2x8/building1/building1_e_2",
        ],
        BUILDING_ROOF_3x2: "buildings/3x2x8/building1/building1_top",
    },
};

export const DEFAULT_MAP_SKIN: ResolvedMapSkin = {
    floor: "tiles/floor/top/stone",
    apron: "tiles/floor/curtain/stone",
    wall: "tiles/walls/stone",
    stair: "tiles/stairs/top/stone",
    stairApron: "",

    background: "tiles/backgrounds/water3",
};

export const DEFAULT_MAP_SKIN_ID: MapSkinId = "default";

export const MAP_SKINS: Record<MapSkinId, MapSkinBundle> = {
    [DEFAULT_MAP_SKIN_ID]: {},

    docks: {
        floor: "tiles/floor/top/docks",
        apron: "tiles/floor/curtain/docks",
        wall: "tiles/walls/docks",
        background: "tiles/backgrounds/water1",
    },
    green: {
        floor: "tiles/floor/top/green",
        apron: "tiles/floor/curtain/green",
        wall: "tiles/walls/green",
        background: "tiles/backgrounds/green_water",
    },
    building1: {},

};

export function resolveMapSkin(id?: MapSkinId): ResolvedMapSkin {
    const bundle = MAP_SKINS[id ?? ""] ?? {};
    return {
        floor: bundle.floor ?? DEFAULT_MAP_SKIN.floor,
        apron: bundle.apron ?? DEFAULT_MAP_SKIN.apron,
        wall: bundle.wall ?? DEFAULT_MAP_SKIN.wall,
        stair: bundle.stair ?? DEFAULT_MAP_SKIN.stair,
        stairApron: bundle.stairApron ?? DEFAULT_MAP_SKIN.stairApron,

        background: bundle.background ?? DEFAULT_MAP_SKIN.background,
    };
}


function hashString(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return hash >>> 0;
}

export function allMapSkinIds(): MapSkinId[] {
    const raw = Object.keys(MAP_SKINS).map((id) => id.trim()).filter(Boolean);

    // Stable ordering for deterministic picks across environments:
    // - Always put default first (if present)
    // - Sort the rest alphabetically
    const rest = raw.filter((id) => id !== DEFAULT_MAP_SKIN_ID).sort();
    return raw.includes(DEFAULT_MAP_SKIN_ID) ? [DEFAULT_MAP_SKIN_ID, ...rest] : rest;
}

export function normalizeMapSkinPool(pool?: MapSkinId[]): MapSkinId[] {
    const cleaned = (pool ?? []).map((id) => id.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : allMapSkinIds();
}

export function pickMapSkinId(
    pool: MapSkinId[] | undefined,
    runSeed: number,
    nodeId: string
): MapSkinId {
    const list = normalizeMapSkinPool(pool);
    const hash = hashString(`${runSeed}:${nodeId}`);
    const idx = list.length > 0 ? (hash % list.length) : 0;
    return list[idx] ?? DEFAULT_MAP_SKIN_ID;
}

export function resolveSemanticSprite(mapSkinId: MapSkinId | undefined, slot: string, index?: number): string {
    const skinKey = mapSkinId ?? DEFAULT_MAP_SKIN_ID;
    const table = MAP_SKIN_SEMANTIC[skinKey] ?? MAP_SKIN_SEMANTIC[DEFAULT_MAP_SKIN_ID] ?? {};
    const raw = table[slot];
    if (Array.isArray(raw)) {
        if (raw.length === 0) return "";
        const idx = typeof index === "number" && raw.length > 0 ? Math.max(0, Math.min(raw.length - 1, index)) : 0;
        return raw[idx] ?? raw[0] ?? "";
    }
    if (typeof raw === "string") return raw;
    return "";
}
