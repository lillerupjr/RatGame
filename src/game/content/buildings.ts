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
  // Monolithic placement geometry is authored for both normal and flipped variants.
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

  container1: makeMonolithicBuilding("container1", "structures/containers/container_base", {}),
  container_babyblue: makeMonolithicBuilding("container_babyblue", "structures/containers/container_babyblue", {}),
  container_black: makeMonolithicBuilding("container_black", "structures/containers/container_black", {}),
  container_blue: makeMonolithicBuilding("container_blue", "structures/containers/container_blue", {}),
  container_green: makeMonolithicBuilding("container_green", "structures/containers/container_green", {}),
  container_red: makeMonolithicBuilding("container_red", "structures/containers/container_red", {}),

  bp_0: makeMonolithicBuilding("bp_0", "structures/buildings/batch_processed/0", {}),
  bp_1: makeMonolithicBuilding("bp_1", "structures/buildings/batch_processed/1", {}),
  bp_2: makeMonolithicBuilding("bp_2", "structures/buildings/batch_processed/2", {}),
  bp_3: makeMonolithicBuilding("bp_3", "structures/buildings/batch_processed/3", {}),
  bp_4: makeMonolithicBuilding("bp_4", "structures/buildings/batch_processed/4", {}),
  bp_5: makeMonolithicBuilding("bp_5", "structures/buildings/batch_processed/5", {}),
  bp_6: makeMonolithicBuilding("bp_6", "structures/buildings/batch_processed/6", {}),
  bp_7: makeMonolithicBuilding("bp_7", "structures/buildings/batch_processed/7", {}),
  bp_8: makeMonolithicBuilding("bp_8", "structures/buildings/batch_processed/8", {}),
  bp_9: makeMonolithicBuilding("bp_9", "structures/buildings/batch_processed/9", {}),
  bp_10: makeMonolithicBuilding("bp_10", "structures/buildings/batch_processed/10", {}),
  bp_11: makeMonolithicBuilding("bp_11", "structures/buildings/batch_processed/11", {}),
  bp_12: makeMonolithicBuilding("bp_12", "structures/buildings/batch_processed/12", {}),
  bp_13: makeMonolithicBuilding("bp_13", "structures/buildings/batch_processed/13", {}),
  bp_14: makeMonolithicBuilding("bp_14", "structures/buildings/batch_processed/14", {}),
  bp_15: makeMonolithicBuilding("bp_15", "structures/buildings/batch_processed/15", {}),
  bp_16: makeMonolithicBuilding("bp_16", "structures/buildings/batch_processed/16", {}),
  bp_17: makeMonolithicBuilding("bp_17", "structures/buildings/batch_processed/17", {}),
  bp_18: makeMonolithicBuilding("bp_18", "structures/buildings/batch_processed/18", {}),
  bp_20: makeMonolithicBuilding("bp_20", "structures/buildings/batch_processed/20", {}),
  bp_21: makeMonolithicBuilding("bp_21", "structures/buildings/batch_processed/21", {}),
  bp_22: makeMonolithicBuilding("bp_22", "structures/buildings/batch_processed/22", {}),
  bp_23: makeMonolithicBuilding("bp_23", "structures/buildings/batch_processed/23", {}),
  bp_24: makeMonolithicBuilding("bp_24", "structures/buildings/batch_processed/24", {}),
  bp_25: makeMonolithicBuilding("bp_25", "structures/buildings/batch_processed/25", {}),
  bp_26: makeMonolithicBuilding("bp_26", "structures/buildings/batch_processed/26", {}),
  bp_27: makeMonolithicBuilding("bp_27", "structures/buildings/batch_processed/27", {}),
  bp_28: makeMonolithicBuilding("bp_28", "structures/buildings/batch_processed/28", {}),
  bp_32: makeMonolithicBuilding("bp_32", "structures/buildings/batch_processed/32", {}),
  bp_33: makeMonolithicBuilding("bp_33", "structures/buildings/batch_processed/33", {}),
  bp_34: makeMonolithicBuilding("bp_34", "structures/buildings/batch_processed/34", {}),
  bp_35: makeMonolithicBuilding("bp_35", "structures/buildings/batch_processed/35", {}),
  bp_36: makeMonolithicBuilding("bp_36", "structures/buildings/batch_processed/36", {}),

  b1_building1: makeMonolithicBuilding("b1_building1", "structures/buildings/batch1/building1/images", {}),
  b1_building2: makeMonolithicBuilding("b1_building2", "structures/buildings/batch1/building2/images", {}),
  b1_building3: makeMonolithicBuilding("b1_building3", "structures/buildings/batch1/building3/images", {}),
  b1_building4: makeMonolithicBuilding("b1_building4", "structures/buildings/batch1/building4/images", {}),
  b1_building5: makeMonolithicBuilding("b1_building5", "structures/buildings/batch1/building5/images", {}),
  b1_building6: makeMonolithicBuilding("b1_building6", "structures/buildings/batch1/building6/images", {}),
  b1_building7: makeMonolithicBuilding("b1_building7", "structures/buildings/batch1/building7/images", {}),
  b1_building8: makeMonolithicBuilding("b1_building8", "structures/buildings/batch1/building8/images", {}),
  b1_building9: makeMonolithicBuilding("b1_building9", "structures/buildings/batch1/building9/images", {}),
  b1_building10: makeMonolithicBuilding("b1_building10", "structures/buildings/batch1/building10/images", {}),
  b1_background_test: makeMonolithicBuilding("b1_background_test", "structures/buildings/batch1/background_test/images", {}),
  b1_container: makeMonolithicBuilding("b1_container", "structures/buildings/batch1/container/images", {}),
  b1_hot_dog_stand1: makeMonolithicBuilding("b1_hot_dog_stand1", "structures/buildings/batch1/hot_dog_stand1/images", {}),
  b1_hot_dog_stand2: makeMonolithicBuilding("b1_hot_dog_stand2", "structures/buildings/batch1/hot_dog_stand2/images", {}),
  b1_lamp_post: makeMonolithicBuilding("b1_lamp_post", "structures/buildings/batch1/lamp_post/images", {}),
  b1_news_paper_stand: makeMonolithicBuilding("b1_news_paper_stand", "structures/buildings/batch1/news_paper_stand/images", {}),
  b1_newspaper_stand: makeMonolithicBuilding("b1_newspaper_stand", "structures/buildings/batch1/newspaper_stand/images", {}),
  b1_police_car: makeMonolithicBuilding("b1_police_car", "structures/buildings/batch1/police_car/images", {}),
  b1_rat_hooker: makeMonolithicBuilding("b1_rat_hooker", "structures/buildings/batch1/rat_hooker/images", {}),
  b1_street_light: makeMonolithicBuilding("b1_street_light", "structures/buildings/batch1/street_light/images", {}),
  b1_taxi: makeMonolithicBuilding("b1_taxi", "structures/buildings/batch1/taxi/images", {}),
  b1_thrash_can: makeMonolithicBuilding("b1_thrash_can", "structures/buildings/batch1/thrash_can/images", {}),
  b1_tree: makeMonolithicBuilding("b1_tree", "structures/buildings/batch1/tree/images", {}),
  b1_tree2: makeMonolithicBuilding("b1_tree2", "structures/buildings/batch1/tree2/images", {}),
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
  // Findings summary: authored maps select building content via buildingPackId, runtime theme via mapSkinId,
  // and delve reaches maps through DEFAULT_MAP_POOL. Keep industrial explicit and empty so it never aliases downtown.
  avenue_buildings: ["avenue_1", "avenue_2", "avenue_3", "avenue_4", "avenue_5", "avenue_6", "avenue_7"],
  downtown_buildings: ["downtown_1", "downtown_2", "downtown_3"],
  industrial_buildings: [],
  china_town_buildings: ["china_town_1", "china_town_2", "china_town_3", "china_town_4", "china_town_5"],
  containers: [
    "container1",
    "container_babyblue",
    "container_black",
    "container_blue",
    "container_green",
    "container_red",
  ],
  batch_processed_buildings: [
    "bp_0", "bp_1", "bp_2", "bp_3", "bp_4", "bp_5", "bp_6", "bp_7", "bp_8", "bp_9",
    "bp_10", "bp_11", "bp_12", "bp_13", "bp_14", "bp_15", "bp_16", "bp_17", "bp_18",
    "bp_20", "bp_21", "bp_22", "bp_23", "bp_24", "bp_25", "bp_26", "bp_27", "bp_28",
    "bp_32", "bp_33", "bp_34", "bp_35", "bp_36",
  ],
  batch1_buildings: [
    "b1_building1", "b1_building2", "b1_building3", "b1_building4", "b1_building5",
    "b1_building6", "b1_building7", "b1_building8", "b1_building9", "b1_building10",
    "b1_background_test", "b1_container",
    "b1_hot_dog_stand1", "b1_hot_dog_stand2",
    "b1_lamp_post", "b1_news_paper_stand", "b1_newspaper_stand",
    "b1_police_car", "b1_rat_hooker", "b1_street_light", "b1_taxi",
    "b1_thrash_can", "b1_tree", "b1_tree2",
  ],
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
