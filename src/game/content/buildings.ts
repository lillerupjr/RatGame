import { HEIGHT_UNIT_PX } from "./structureSkins";
import type { RNG } from "../util/rng";

export { HEIGHT_UNIT_PX };

export type BuildingSkinId = string;
export type BuildingPackId = string;

export const DEFAULT_BUILDING_PACK_ID: BuildingPackId = "default_buildings";

export type BuildingSkin = {
  id: BuildingSkinId;

  // Footprint + vertical
  w: number;
  h: number;
  heightUnits: number;

  // Existing tuning
  anchorLiftUnits: number;
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
    offsetPx?: { x: number; y: number };
  };

  // Sprite ids
  roof: string;
  wallSouth: string[];
  wallEast: string[];
};

export const BUILDING_SKINS: Record<BuildingSkinId, BuildingSkin> = {
  building1: {
    id: "building1",
    w: 3,
    h: 2,
    heightUnits: 32,
    anchorLiftUnits: -2,
    wallLiftUnits: 0,
    roofLiftUnits: -2,
    roof: "structures/buildings/avenue/1/top",
    wallSouth: ["structures/buildings/avenue/1/s_1", "structures/buildings/avenue/1/s_2", "structures/buildings/avenue/1/s_3"],
    wallEast: ["structures/buildings/avenue/1/e_1", "structures/buildings/avenue/1/e_2"],
  },
  building2: {
    id: "building2",
    w: 3,
    h: 2,
    heightUnits: 16,
    anchorLiftUnits: -2,
    wallLiftUnits: 0,
    roofLiftUnits: -2,
    roof: "structures/buildings/avenue/2/top",
    wallSouth: ["structures/buildings/avenue/2/s_1", "structures/buildings/avenue/2/s_2", "structures/buildings/avenue/2/s_3"],
    wallEast: ["structures/buildings/avenue/2/e_1", "structures/buildings/avenue/2/e_2"],
  },
  building3: {
    id: "building3",
    w: 3,
    h: 2,
    heightUnits: 16,
    anchorLiftUnits: -2,
    wallLiftUnits: 0,
    roofLiftUnits: -2,
    roof: "structures/buildings/avenue/3/top",
    wallSouth: ["structures/buildings/avenue/3/s_1", "structures/buildings/avenue/3/s_2", "structures/buildings/avenue/3/s_3"],
    wallEast: ["structures/buildings/avenue/3/e_1", "structures/buildings/avenue/3/e_2"],
  },
  building4: {
    id: "building4",
    w: 3,
    h: 2,
    heightUnits: 32,
    anchorLiftUnits: -2,
    wallLiftUnits: 0,
    roofLiftUnits: -2,
    roof: "structures/buildings/avenue/4/top",
    wallSouth: ["structures/buildings/avenue/4/s_1", "structures/buildings/avenue/4/s_2", "structures/buildings/avenue/4/s_3"],
    wallEast: ["structures/buildings/avenue/4/e_1", "structures/buildings/avenue/4/e_2"],
  },
  building5: {
    id: "building5",
    w: 2,
    h: 3,
    heightUnits: 32,
    anchorLiftUnits: -2,
    wallLiftUnits: 0,
    roofLiftUnits: -2,
    roof: "structures/buildings/china_town/5/top",
    wallSouth: ["structures/buildings/china_town/5/s_1", "structures/buildings/china_town/5/s_2", "structures/buildings/china_town/5/s_3"],
    wallEast: ["structures/buildings/china_town/5/e_1", "structures/buildings/china_town/5/e_2"],
  },
  building6: {
    id: "building6",
    w: 2,
    h: 3,
    heightUnits: 16,
    anchorLiftUnits: -2,
    wallLiftUnits: 0,
    roofLiftUnits: -2,
    roof: "structures/buildings/china_town/6/top",
    wallSouth: ["structures/buildings/china_town/6/s_1", "structures/buildings/china_town/6/s_2", "structures/buildings/china_town/6/s_3"],
    wallEast: ["structures/buildings/china_town/6/e_1", "structures/buildings/china_town/6/e_2"],
  },
  building7: {
    id: "building7",
    w: 2,
    h: 3,
    heightUnits: 16,
    anchorLiftUnits: -2,
    wallLiftUnits: 0,
    roofLiftUnits: -2,
    roof: "structures/buildings/china_town/7/top",
    wallSouth: ["structures/buildings/china_town/7/s_1", "structures/buildings/china_town/7/s_2", "structures/buildings/china_town/7/s_3"],
    wallEast: ["structures/buildings/china_town/7/e_1", "structures/buildings/china_town/7/e_2"],
  },
  building8: {
    id: "building8",
    w: 2,
    h: 3,
    heightUnits: 32,
    anchorLiftUnits: -2,
    wallLiftUnits: 0,
    roofLiftUnits: -2,
    roof: "structures/buildings/china_town/8/top",
    wallSouth: ["structures/buildings/china_town/8/s_1", "structures/buildings/china_town/8/s_2", "structures/buildings/china_town/8/s_3"],
    wallEast: ["structures/buildings/china_town/8/e_1", "structures/buildings/china_town/8/e_2"],
  },
  building9: {
    id: "building9",
    w: 3,
    h: 2,
    heightUnits: 20,
    anchorLiftUnits: -1,
    wallLiftUnits: 0,
    roofLiftUnits: -2,
    roof: "structures/buildings/avenue/9/top",
    wallSouth: ["structures/buildings/avenue/9/s_1", "structures/buildings/avenue/9/s_2", "structures/buildings/avenue/9/s_3"],
    wallEast: ["structures/buildings/avenue/9/e_1", "structures/buildings/avenue/9/e_2"],
  },
  building10: {
    id: "building10",
    w: 3,
    h: 2,
    heightUnits: 24,
    anchorLiftUnits: -1,
    wallLiftUnits: 0,
    roofLiftUnits: -1,
    roof: "structures/buildings/avenue/10/top",
    wallSouth: ["structures/buildings/avenue/10/s_1", "structures/buildings/avenue/10/s_2", "structures/buildings/avenue/10/s_3"],
    wallEast: ["structures/buildings/avenue/10/e_1", "structures/buildings/avenue/10/e_2"],
  },
  building11: {
    id: "building11",
    w: 3,
    h: 2,
    heightUnits: 20,
    anchorLiftUnits: -1,
    wallLiftUnits: 0,
    roofLiftUnits: -2,
    roof: "structures/buildings/avenue/11/top",
    wallSouth: ["structures/buildings/avenue/11/s_1", "structures/buildings/avenue/11/s_2", "structures/buildings/avenue/11/s_3"],
    wallEast: ["structures/buildings/avenue/11/e_1", "structures/buildings/avenue/11/e_2"],
  },
};

export const BUILDING_PACKS: Record<BuildingPackId, BuildingSkinId[]> = {
  avenue_buildings: ["building1", "building2", "building3", "building4", "building9", "building10", "building11"],
  china_town_buildings: ["building5", "building6", "building7", "building8"],
  [DEFAULT_BUILDING_PACK_ID]: [
    "building1",
    "building2",
    "building3",
    "building4",
    "building5",
    "building6",
    "building7",
    "building8",
    "building9",
    "building10",
    "building11",
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
