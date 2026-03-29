// src/game/content/mapSkins.ts

import {
  AUTHORED_DELVE_PALETTE_ENTRIES,
  type AuthoredDelvePaletteEntry,
} from "./delvePaletteRegistry";

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
  /**
   * Fixed palette selection for skins that should bypass registry-backed
   * random delve palette selection.
   */
  paletteId?: PaletteId;

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
    floor: "tiles/floor/park/1",
    apron: "tiles/walls/green",
    wall: "tiles/walls/green",
    background: "tiles/animated/water2/1",
  },

  avenue: {
  },

  china_town: {
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
  },

  industrial: {
  },

  slums: {
  },

  park: {
  },

  sewers: {
  },

  subway: {
  },

  rooftops: {
  },

  snow: {
  },

  countryside: {
  },

  beach: {
  },

  desert: {
  },

  boss_arena: {
  },
};

// ─────────────────────────────────────────────────────────────
// Active skin + locked palette
// ─────────────────────────────────────────────────────────────

let activeMapSkinId: MapSkinId | undefined = undefined;

const DEFAULT_ACTIVE_MAP_SKIN_SATURATION_WEIGHT = 0.75;
const DEFAULT_ACTIVE_MAP_SKIN_DARKNESS = 0.5;

function createFixedPaletteEntry(paletteId: PaletteId): AuthoredDelvePaletteEntry {
  return {
    paletteId,
    saturationWeight: DEFAULT_ACTIVE_MAP_SKIN_SATURATION_WEIGHT,
    darkness: DEFAULT_ACTIVE_MAP_SKIN_DARKNESS,
    enabledForRandomDelvePicker: false,
  };
}

const DEFAULT_ACTIVE_MAP_SKIN_PALETTE_ENTRY = createFixedPaletteEntry(DEFAULT_MAP_SKIN.paletteId);

// Locked-in palette for the currently active skin (so we don't change every frame)
let activeMapSkinPaletteEntry: AuthoredDelvePaletteEntry = { ...DEFAULT_ACTIVE_MAP_SKIN_PALETTE_ENTRY };

export function pickRandomEnabledDelvePaletteEntry(
  entries: readonly AuthoredDelvePaletteEntry[] = AUTHORED_DELVE_PALETTE_ENTRIES,
  randomValue: number = Math.random(),
): AuthoredDelvePaletteEntry | null {
  const enabledEntries = entries.filter((entry) => entry.enabledForRandomDelvePicker);
  if (enabledEntries.length === 0) return null;

  const normalizedRandom = Number.isFinite(randomValue) ? randomValue : 0;
  const clampedRandom = Math.max(0, Math.min(0.999999999, normalizedRandom));
  const index = Math.min(enabledEntries.length - 1, Math.floor(clampedRandom * enabledEntries.length));
  return { ...enabledEntries[index]! };
}

function resolvePaletteEntryForSkin(id?: MapSkinId): AuthoredDelvePaletteEntry {
  const bundle = id ? MAP_SKINS[id] : undefined;
  if (!bundle) return { ...DEFAULT_ACTIVE_MAP_SKIN_PALETTE_ENTRY };
  if (bundle.paletteId) return createFixedPaletteEntry(bundle.paletteId);
  return pickRandomEnabledDelvePaletteEntry() ?? { ...DEFAULT_ACTIVE_MAP_SKIN_PALETTE_ENTRY };
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
  activeMapSkinPaletteEntry = resolvePaletteEntryForSkin(id);
}

export function getActiveMapSkinId(): MapSkinId | undefined {
  return activeMapSkinId;
}

/** The palette actually in use for the currently active skin. */
export function getActiveMapSkinPaletteId(): PaletteId {
  return activeMapSkinPaletteEntry.paletteId;
}

export function getActiveMapSkinPaletteEntry(): AuthoredDelvePaletteEntry {
  return { ...activeMapSkinPaletteEntry };
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
