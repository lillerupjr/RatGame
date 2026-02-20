// src/game/content/mapSkins.ts

export type MapSkinId =
  | "default"
  | "docks"
  | "green"
  | "avenue"
  | "china_town"
  | "building1"

  // Future/non-existing map skins (predeclare now)
  | "downtown"
  | "beach"
  | "park"
  | "industrial"
  | "sewers"
  | "subway"
  | "rooftops"
  | "countryside"
  | "snow"
  | "desert";

export type PaletteId =
  | "db32"
  | "divination"
  | "cyberpunk"
  | "sunset_8"
  | "s_sunset7"
  | "moonlight_15"
  | "st8_moonlight"
  | "noire_truth"
  | "chroma_noir"
  | "sunny_swamp"
  | "swamp_kin"
  | "cobalt_desert_7"
  | "lost_in_the_desert";

export type MapSkinBundle = {
  paletteId?: PaletteId;

  /**
   * Optional palette pool: if present and non-empty, one palette is randomly chosen
   * when the skin becomes active and then stays locked for that map.
   */
  palettePool?: readonly PaletteId[];

  floor?: string;
  apron?: string;
  wall?: string;
  stair?: string;
  stairApron?: string;

  background?: string;

  semantic?: Record<string, string | string[]>;
};

export type ResolvedMapSkin = {
  paletteId: PaletteId;

  floor: string;
  apron: string;
  wall: string;
  stair: string;
  stairApron: string;

  background: string;
};

export const DEFAULT_MAP_SKIN_ID: MapSkinId = "default";

export const DEFAULT_MAP_SKIN: ResolvedMapSkin = {
  paletteId: "db32",
  floor: "tiles/floor/sidewalk/1",
  apron: "tiles/walls/sidewalk",
  wall: "tiles/walls/sidewalk",
  stair: "tiles/stairs/sidewalk",
  stairApron: "tiles/stairs/sidewalk_apron",
  background: "tiles/animated/water2/1",
};

export const MAP_SKINS: Record<string, MapSkinBundle> = {
  default: {
    paletteId: "db32",
    floor: "tiles/floor/sidewalk/1",
    apron: "tiles/walls/sidewalk",
    wall: "tiles/walls/sidewalk",
    stair: "tiles/stairs/sidewalk",
    stairApron: "tiles/stairs/sidewalk_apron",
    background: "tiles/animated/water2/1",
    semantic: {
      ROAD_FLOOR: "tiles/floor/asphalt/1",
      SIDEWALK_FLOOR: "tiles/floor/sidewalk/1",
      PARK_FLOOR: "tiles/floor/park/1",
      SEA_FLOOR: "tiles/floor/asphalt/1",
      VOID_TOP: "tiles/animated/water2/1",
    },
  },

  docks: {
    // Docks: moonlight pool (cool, wet, night-friendly)
    palettePool: ["moonlight_15", "st8_moonlight"],
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
    // “green” is a park-ish feel: swamp pool for now
    palettePool: ["sunny_swamp", "swamp_kin"],
    floor: "tiles/floor/park/1",
    apron: "tiles/walls/green",
    wall: "tiles/walls/green",
    background: "tiles/animated/water2/1",
  },

  avenue: {
    // Avenue: sunset pool (warm city evening)
    palettePool: ["sunset_8", "s_sunset7"],
  },

  china_town: {
    // Chinatown: neon/noir pool (keeps your existing cyberpunk vibe but adds noir alt)
    palettePool: ["cyberpunk", "chroma_noir"],
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

  // ----------------------------
  // Future/non-existing skins
  // (implemented now for later use)
  // ----------------------------

  downtown: {
    palettePool: ["noire_truth", "chroma_noir"],
  },

  beach: {
    // Beach: sunset + desert contrast (lets us reuse existing pool ideas)
    palettePool: ["sunset_8", "lost_in_the_desert"],
  },

  park: {
    palettePool: ["sunny_swamp", "swamp_kin"],
  },

  industrial: {
    palettePool: ["st8_moonlight", "chroma_noir"],
  },

  sewers: {
    palettePool: ["swamp_kin", "moonlight_15"],
  },

  subway: {
    palettePool: ["st8_moonlight", "noire_truth"],
  },

  rooftops: {
    palettePool: ["moonlight_15", "chroma_noir"],
  },

  countryside: {
    palettePool: ["sunset_8", "sunny_swamp"],
  },

  snow: {
    palettePool: ["st8_moonlight", "moonlight_15"],
  },

  desert: {
    palettePool: ["cobalt_desert_7", "lost_in_the_desert"],
  },
};

let activeMapSkinId: MapSkinId | undefined = undefined;

// Locked-in palette for the currently active skin (so we don't change every frame)
let activeMapSkinPaletteId: PaletteId = DEFAULT_MAP_SKIN.paletteId;

function pickFromPool(pool: readonly PaletteId[]): PaletteId {
  if (!pool || pool.length === 0) return DEFAULT_MAP_SKIN.paletteId;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[Math.max(0, Math.min(pool.length - 1, idx))]!;
}

function resolvePaletteForSkin(id?: MapSkinId): PaletteId {
  const bundle = MAP_SKINS[id ?? ""] ?? {};
  if (bundle.palettePool && bundle.palettePool.length > 0) return pickFromPool(bundle.palettePool);
  if (bundle.paletteId) return bundle.paletteId;
  return DEFAULT_MAP_SKIN.paletteId;
}

export function resolveMapSkin(id?: MapSkinId): ResolvedMapSkin {
  const bundle = MAP_SKINS[id ?? ""] ?? {};
  return {
    floor: bundle.floor ?? DEFAULT_MAP_SKIN.floor,
    apron: bundle.apron ?? DEFAULT_MAP_SKIN.apron,
    wall: bundle.wall ?? DEFAULT_MAP_SKIN.wall,
    stair: bundle.stair ?? DEFAULT_MAP_SKIN.stair,
    stairApron: bundle.stairApron ?? DEFAULT_MAP_SKIN.stairApron,
    // NOTE: This is the “static” palette definition on the bundle. The *active* palette is stored separately.
    paletteId: bundle.paletteId ?? DEFAULT_MAP_SKIN.paletteId,
    background: bundle.background ?? DEFAULT_MAP_SKIN.background,
  };
}

export function setActiveMapSkinId(id?: MapSkinId): void {
  activeMapSkinId = id;
  activeMapSkinPaletteId = resolvePaletteForSkin(id);
}

export function getActiveMapSkinId(): MapSkinId | undefined {
  return activeMapSkinId;
}

/** The palette actually in use for the currently active skin (includes pool random-pick). */
export function getActiveMapSkinPaletteId(): PaletteId {
  return activeMapSkinPaletteId;
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
