export type MapSkinId = string;

export type MapSkinBundle = {
    floor?: string;
    apron?: string;
    wall?: string;
    stair?: string;
    stairApron?: string;

    background?: string;
    semantic?: Record<string, string | string[]>;
};

export type ResolvedMapSkin = {
    floor: string;
    apron: string;
    wall: string;
    stair: string;
    stairApron: string;


    background: string;
};
export const DEFAULT_MAP_SKIN_ID: MapSkinId = "default";

export const DEFAULT_MAP_SKIN: ResolvedMapSkin = {
    floor: "tiles/floor/top/stone",
    apron: "tiles/floor/curtain/stone",
    wall: "tiles/walls/stone",
    stair: "tiles/stairs/top/stone",
    stairApron: "tiles/floor/curtain/stone",

    background: "tiles/backgrounds/water3",
};



export const MAP_SKINS: Record<MapSkinId, MapSkinBundle> = {
    [DEFAULT_MAP_SKIN_ID]: {
        semantic: {
            SIDEWALK_FLOOR: "tiles/floor/top/sidewalk",
            ROAD_FLOOR: "tiles/floor/top/road",
            PARK_FLOOR: "tiles/floor/top/park",
            SEA_FLOOR: "tiles/floor/top/stone",
            VOID_TOP: "tiles/backgrounds/water3",
        },
    },

    docks: {
        floor: "tiles/floor/top/asphalt",
        apron: "tiles/floor/curtain/asphalt",
        wall: "tiles/walls/asphalt",
        background: "tiles/backgrounds/water1",
        semantic: {
            ROAD_FLOOR: "tiles/floor/top/road",
            SIDEWALK_FLOOR: "tiles/floor/top/sidewalk",
            PARK_FLOOR: "tiles/floor/top/park",
            SEA_FLOOR: "",
            VOID_TOP: "tiles/backgrounds/water1",
        },
    },
    green: {
        floor: "tiles/floor/top/green",
        apron: "tiles/floor/curtain/green",
        wall: "tiles/walls/green",
        background: "tiles/backgrounds/green_water",
    },
    building1: {
        semantic: {
            BUILDING_WALL_SOUTH: [
                "structures/buildings/avenue/1/s_1",
                "structures/buildings/avenue/1/s_2",
                "structures/buildings/avenue/1/s_3",
            ],
            BUILDING_WALL_EAST: [
                "structures/buildings/avenue/1/e_1",
                "structures/buildings/avenue/1/e_2",
            ],
            BUILDING_ROOF_3x2: "structures/buildings/avenue/1/top",
        },
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
