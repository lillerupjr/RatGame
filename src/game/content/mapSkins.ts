export type MapSkinId = string;

export type MapSkinBundle = {
    floor?: string;
    apron?: string;
    wall?: string;
    stair?: string;
    stairApron?: string;
    paletteId?: "db32" | "divination" | "cyberpunk";

    background?: string;
    semantic?: Record<string, string | string[]>;
};

export type ResolvedMapSkin = {
    floor: string;
    apron: string;
    wall: string;
    stair: string;
    stairApron: string;
    paletteId?: "db32" | "divination" | "cyberpunk";


    background: string;
};
export const DEFAULT_MAP_SKIN_ID: MapSkinId = "default";

export const DEFAULT_MAP_SKIN: ResolvedMapSkin = {
    floor: "tiles/floor/sidewalk/1",
    apron: "none",
    wall: "none",
    stair: "tiles/stairs/stone/stone",
    stairApron: "none",
    paletteId: "db32",

    background: "tiles/animated/water2/1",
};



export const MAP_SKINS: Record<MapSkinId, MapSkinBundle> = {
    [DEFAULT_MAP_SKIN_ID]: {
        semantic: {
            SIDEWALK_FLOOR: "tiles/floor/sidewalk/1",
            ROAD_FLOOR: "tiles/floor/asphalt/1",
            PARK_FLOOR: "tiles/floor/park/1",
            SEA_FLOOR: "tiles/floor/asphalt/1",
            VOID_TOP: "tiles/animated/water2/1",
        },
    },

    docks: {
        paletteId: "divination",
        floor: "tiles/floor/asphalt/1",
        apron: "tiles/walls/asphalt",
        wall: "tiles/walls/asphalt",
        background: "tiles/animated/water2/1",
        semantic: {
            ROAD_FLOOR: "tiles/floor/asphalt/1",
            SIDEWALK_FLOOR: "tiles/floor/sidewalk/1",
            PARK_FLOOR: "tiles/floor/park/1",
            SEA_FLOOR: "tiles/floor/asphalt/1",
            VOID_TOP: "tiles/animated/water2/1",
        },
    },
    green: {
        floor: "tiles/floor/park/1",
        apron: "tiles/walls/green",
        wall: "tiles/walls/green",
        background: "tiles/animated/water2/1",
    },
    avenue: {
        paletteId: "db32",
    },
    china_town: {
        paletteId: "cyberpunk",
    },
    building1: {
        paletteId: "db32",
        semantic: {
            BUILDING_WALL_SOUTH: [
                "structures/buildings/avenue/1",
                "structures/buildings/avenue/1",
                "structures/buildings/avenue/1",
            ],
            BUILDING_WALL_EAST: [
                "structures/buildings/avenue/1",
                "structures/buildings/avenue/1",
            ],
            BUILDING_ROOF_3x2: "structures/buildings/avenue/1",
        },
    },

};

let activeMapSkinId: MapSkinId | undefined = undefined;

export function resolveMapSkin(id?: MapSkinId): ResolvedMapSkin {
     const bundle = MAP_SKINS[id ?? ""] ?? {};
     return {
         floor: bundle.floor ?? DEFAULT_MAP_SKIN.floor,
         apron: bundle.apron ?? DEFAULT_MAP_SKIN.apron,
         wall: bundle.wall ?? DEFAULT_MAP_SKIN.wall,
         stair: bundle.stair ?? DEFAULT_MAP_SKIN.stair,
         stairApron: bundle.stairApron ?? DEFAULT_MAP_SKIN.stairApron,
         paletteId: bundle.paletteId ?? DEFAULT_MAP_SKIN.paletteId,

         background: bundle.background ?? DEFAULT_MAP_SKIN.background,
     };
 }

export function setActiveMapSkinId(id?: MapSkinId): void {
    activeMapSkinId = id;
}

export function getActiveMapSkinId(): MapSkinId | undefined {
    return activeMapSkinId;
}


export function resolveSemanticSprite(mapSkinId: MapSkinId | undefined, slot: string, index?: number): string {
     const skinKey = mapSkinId ?? DEFAULT_MAP_SKIN_ID;
     const table = MAP_SKINS[skinKey]?.semantic ?? MAP_SKINS[DEFAULT_MAP_SKIN_ID]?.semantic ?? {};
     const raw = table[slot];
     if (Array.isArray(raw)) {
         if (raw.length === 0) return "";
         const idx = typeof index === "number" && raw.length > 0 ? Math.max(0, Math.min(raw.length - 1, index)) : 0;
         return raw[idx] ?? raw[0] ?? "";
     }
     if (typeof raw === "string") return raw;
     return "";
 }
