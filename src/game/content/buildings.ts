import { HEIGHT_UNIT_PX } from "./structureSkins";
import type { RNG } from "../util/rng";

export { HEIGHT_UNIT_PX };

export type BuildingSkinId = string;
export type BuildingPackId = string;

export const DEFAULT_BUILDING_PACK_ID: BuildingPackId = "default_buildings";

export type BuildingSkin = {
  id: BuildingSkinId;

  // Footprint + vertical
  w?: number;
  h?: number;
  heightUnits?: number;

  // Existing tuning
  isFlippable: boolean;
  defaultFacing?: "E" | "S";
  flipMode?: "H";
  anchorLiftUnits?: number;
  wallLiftUnits?: number;
  roofLiftUnits?: number;
  roofLiftPx?: number;
  spriteScale?: number;

  // Per-building pixel tuning
  offsetPx?: { x: number; y: number };
  anchorOffsetPx?: { x: number; y: number };

  // Runtime slicing/sort tuning
  slice?: {
    enabled: boolean;
    stepPx: number;
    originPx?: { x: number; y: number };
    originPxByDir?: Partial<Record<"N" | "E" | "S" | "W", { x: number; y: number }>>;
    offsetPx?: { x: number; y: number };
  };

  // Sprite ids
  roof: string;
  wallSouth: string[];
  wallEast: string[];
};

type BuildingSkinOverrides = Omit<Partial<BuildingSkin>, "id" | "roof" | "wallSouth" | "wallEast">;

const DEFAULT_BUILDING_SKIN: BuildingSkinOverrides = {
  isFlippable: true,
  defaultFacing: "S",
  flipMode: "H",
};

function repeatSprite(spriteId: string): string[] {
  return [spriteId];
}

function throwLegacyGeometryAccess(id: string, field: "w" | "h" | "heightUnits"): never {
  throw new Error(
    `[buildings] Legacy authored geometry access blocked for ${id}.${field}. Use monolithic semantic pre-pass output.`,
  );
}

function makeMonolithicBuilding(
  id: BuildingSkinId,
  spriteId: string,
  overrides: BuildingSkinOverrides = {},
): BuildingSkin {
  const merged: BuildingSkinOverrides = { ...DEFAULT_BUILDING_SKIN, ...overrides };
  const skin = {
    ...merged,
    id,
    roof: spriteId,
    wallSouth: repeatSprite(spriteId),
    wallEast: repeatSprite(spriteId),
  } as BuildingSkin;

  Object.defineProperties(skin, {
    w: {
      configurable: true,
      enumerable: false,
      get() {
        return throwLegacyGeometryAccess(id, "w");
      },
    },
    h: {
      configurable: true,
      enumerable: false,
      get() {
        return throwLegacyGeometryAccess(id, "h");
      },
    },
    heightUnits: {
      configurable: true,
      enumerable: false,
      get() {
        return throwLegacyGeometryAccess(id, "heightUnits");
      },
    },
  });

  return skin;
}

const CANONICAL_BUILDING_SKINS: Record<BuildingSkinId, BuildingSkin> = {
  avenue_1: makeMonolithicBuilding("avenue_1", "structures/buildings/avenue/1", {}),
  avenue_2: makeMonolithicBuilding("avenue_2", "structures/buildings/avenue/2", {}),
  avenue_3: makeMonolithicBuilding("avenue_3", "structures/buildings/avenue/3", {}),
  avenue_4: makeMonolithicBuilding("avenue_4", "structures/buildings/avenue/4", {}),
  avenue_5: makeMonolithicBuilding("avenue_5", "structures/buildings/avenue/5", {}),
  avenue_6: makeMonolithicBuilding("avenue_6", "structures/buildings/avenue/6", {}),
  avenue_7: makeMonolithicBuilding("avenue_7", "structures/buildings/avenue/7", {}),

  downtown_1: makeMonolithicBuilding("downtown_1", "structures/buildings/downtown/1", {}),
  downtown_2: makeMonolithicBuilding("downtown_2", "structures/buildings/downtown/2", {}),
  downtown_3: makeMonolithicBuilding("downtown_3", "structures/buildings/downtown/3", {}),
  downtown_4: makeMonolithicBuilding("downtown_4", "structures/buildings/downtown/4", {}),
  china_town_1: makeMonolithicBuilding("china_town_1", "structures/buildings/china_town/1", {}),
  china_town_2: makeMonolithicBuilding("china_town_2", "structures/buildings/china_town/2", {}),
  china_town_3: makeMonolithicBuilding("china_town_3", "structures/buildings/china_town/3", {}),
  china_town_4: makeMonolithicBuilding("china_town_4", "structures/buildings/china_town/4", {}),
  china_town_5: makeMonolithicBuilding("china_town_5", "structures/buildings/china_town/5", {}),
}

const BUILDING_ID_ALIASES: Record<BuildingSkinId, BuildingSkinId> = {
  building1: "avenue_1",
  building2: "avenue_2",
  building3: "avenue_3",
  building4: "avenue_4",
  building5: "china_town_1",
  building6: "china_town_2",
  building7: "china_town_3",
  building8: "avenue_5",
};

const LEGACY_ALIAS_SKINS = Object.fromEntries(
  Object.entries(BUILDING_ID_ALIASES)
    .map(([legacyId, canonicalId]) => [legacyId, CANONICAL_BUILDING_SKINS[canonicalId]])
    .filter((entry): entry is [BuildingSkinId, BuildingSkin] => !!entry[1]),
);

export const BUILDING_SKINS: Record<BuildingSkinId, BuildingSkin> = {
  ...CANONICAL_BUILDING_SKINS,
  ...LEGACY_ALIAS_SKINS,
};

export const BUILDING_PACKS: Record<BuildingPackId, BuildingSkinId[]> = {
  avenue_buildings: ["avenue_1", "avenue_2", "avenue_3", "avenue_4", "avenue_5", "avenue_6", "avenue_7"],
  downtown_buildings: ["downtown_1", "downtown_2", "downtown_3"],
  china_town_buildings: ["china_town_1", "china_town_2", "china_town_3", "china_town_4", "china_town_5"],
  [DEFAULT_BUILDING_PACK_ID]: [
    "avenue_1",
    "avenue_2",
    "avenue_3",
    "avenue_4",
    "avenue_5",
    "china_town_1",
    "china_town_2",
    "china_town_3",
  ],
};

export function resolveBuildingCandidates(packId: BuildingPackId): BuildingSkinId[] {
  return BUILDING_PACKS[packId] ?? BUILDING_PACKS[DEFAULT_BUILDING_PACK_ID] ?? [];
}

export function pickBuildingSkin(rng: RNG, packId: BuildingPackId): BuildingSkin {
  const candidates = resolveBuildingCandidates(packId);
  if (candidates.length === 0) {
    throw new Error(`[buildings] No candidates for packId=${packId}`);
  }

  const pickId = candidates[rng.int(0, candidates.length - 1)];
  const skin = BUILDING_SKINS[pickId];
  if (!skin) {
    throw new Error(`[buildings] Missing BUILDING_SKINS entry for id=${pickId}`);
  }

  return skin;
}

export function requireBuildingSkin(id: BuildingSkinId, context: string): BuildingSkin {
  const skin = BUILDING_SKINS[id];
  if (!skin) {
    throw new Error(`[buildings] Missing BUILDING_SKINS entry for id=${id} (${context})`);
  }
  return skin;
}
