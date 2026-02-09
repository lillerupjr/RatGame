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

export const DEFAULT_MAP_SKIN: ResolvedMapSkin = {
    floor: "tiles/floor/top/tile1",
    apron: "tiles/floor/curtain/test_apron",
    wall: "tiles/walls/test_wall",
    stair: "",
    stairApron: "",

    background: "tiles/backgrounds/water3",
};

export const DEFAULT_MAP_SKIN_ID: MapSkinId = "default";

export const MAP_SKINS: Record<MapSkinId, MapSkinBundle> = {
    [DEFAULT_MAP_SKIN_ID]: {},

    docks_rust: {
        floor: "tiles/floor/top/tile1",
        background: "tiles/backgrounds/water1",
    },
    sewer_green: {
        floor: "tiles/floor/top/tile2",
        background: "tiles/backgrounds/green_water",
    },
    ice: {
        floor: "tiles/floor/top/ice",
        background: "tiles/backgrounds/water2",
    },
    beach: {
        floor: "tiles/floor/top/sand",
        background: "tiles/backgrounds/water3",
    },
    test: {
        floor: "tiles/floor/top/sandstone_top",
        wall: "tiles/walls/sandstone_wall_4",
    },
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
