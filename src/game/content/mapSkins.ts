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
  | "industrial"
  | "slums"
  | "park"
  | "sewers"
  | "subway"
  | "rooftops"
  | "snow"
  | "countryside"
  | "beach"
  | "desert"
  | "boss_arena";

export type PaletteId =
  | "db32"
  | "divination"
  | "cyberpunk"
  | "moonlight_15"
  | "st8_moonlight"
  | "chroma_noir"
  | "swamp_kin"
  | "lost_in_the_desert"
  | "endesga_16"
  | "sweetie_16"
  | "dawnbringer_16"
  | "night_16"
  | "fun_16"
  | "reha_16"
  | "arne_16"
  | "lush_sunset"
  | "vaporhaze_16"
  | "sunset_cave_extended";

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

  // ─────────────────────────────────────────────────────────────
  // Existing authored skins
  // ─────────────────────────────────────────────────────────────

  docks: {
    // Wet/cold night. Keeps divination, but adds fuller night palettes.
    palettePool: ["divination", "moonlight_15", "night_16", "reha_16"],
    floor: "tiles/floor/asphalt/1",
    apron: "tiles/walls/sidewalk_apron",
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
    // Park-ish / nature vibe.
    palettePool: ["swamp_kin", "dawnbringer_16", "arne_16"],
    floor: "tiles/floor/park/1",
    apron: "tiles/walls/green",
    wall: "tiles/walls/green",
    background: "tiles/animated/water2/1",
  },

  avenue: {
    // Baseline gritty city. DB32 + two strong 16-color “general urban” palettes.
    palettePool: ["db32", "sweetie_16", "endesga_16"],
  },

  china_town: {
    // Neon + noir. Cyberpunk stays, chroma adds harsh noir, vaporhaze adds stylized neon dusk.
    palettePool: ["cyberpunk", "chroma_noir", "vaporhaze_16"],
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

  // ─────────────────────────────────────────────────────────────
  // Future skins (implemented now for later use)
  // ─────────────────────────────────────────────────────────────

  downtown: {
    palettePool: ["db32", "sweetie_16", "endesga_16"],
  },

  industrial: {
    palettePool: ["reha_16", "night_16", "endesga_16"],
  },

  slums: {
    palettePool: ["endesga_16", "chroma_noir"],
  },

  park: {
    palettePool: ["arne_16", "dawnbringer_16", "lush_sunset"],
  },

  sewers: {
    palettePool: ["swamp_kin", "reha_16"],
  },

  subway: {
    palettePool: ["st8_moonlight", "night_16"],
  },

  rooftops: {
    palettePool: ["moonlight_15", "st8_moonlight"],
  },

  snow: {
    palettePool: ["st8_moonlight", "moonlight_15", "sweetie_16"],
  },

  countryside: {
    palettePool: ["lush_sunset", "arne_16"],
  },

  beach: {
    palettePool: ["lush_sunset", "lost_in_the_desert"],
  },

  desert: {
    palettePool: ["lost_in_the_desert", "sunset_cave_extended"],
  },

  boss_arena: {
    palettePool: ["night_16", "cyberpunk", "chroma_noir"],
  },
};

// ─────────────────────────────────────────────────────────────
// Active skin + locked palette
// ─────────────────────────────────────────────────────────────

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
    // NOTE: This is the skin's *static* palette config. The active palette is stored separately.
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
