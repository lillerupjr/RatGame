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
  isFlippable: boolean;
  defaultFacing?: "S" | "S";
  flipMode?: "H";
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
    isFlippable: true,
    defaultFacing: "S",
    flipMode: "H",
    anchorLiftUnits: -2,

    roof: "structures/buildings/avenue/1",
    wallSouth: ["structures/buildings/avenue/1", "structures/buildings/avenue/1", "structures/buildings/avenue/1"],
    wallEast: ["structures/buildings/avenue/1", "structures/buildings/avenue/1"],
  },
  building2: {
    id: "building2",
    w: 3,
    h: 2,
    heightUnits: 16,
    isFlippable: true,
    defaultFacing: "S",
    flipMode: "H",
    anchorLiftUnits: -2,

    roof: "structures/buildings/avenue/2",
    wallSouth: ["structures/buildings/avenue/2", "structures/buildings/avenue/2", "structures/buildings/avenue/2"],
    wallEast: ["structures/buildings/avenue/2", "structures/buildings/avenue/2"],
  },
  building3: {
    id: "building3",
    w: 3,
    h: 2,
    heightUnits: 16,
    isFlippable: true,
    defaultFacing: "S",
    flipMode: "H",
    anchorLiftUnits: -2,

    roof: "structures/buildings/avenue/3",
    wallSouth: ["structures/buildings/avenue/3", "structures/buildings/avenue/3", "structures/buildings/avenue/3"],
    wallEast: ["structures/buildings/avenue/3", "structures/buildings/avenue/3"],
  },
  building4: {
    id: "building4",
    w: 3,
    h: 2,
    heightUnits: 32,
    isFlippable: true,
    defaultFacing: "S",
    flipMode: "H",
    anchorLiftUnits: -2,

    roof: "structures/buildings/avenue/4",
    wallSouth: ["structures/buildings/avenue/4", "structures/buildings/avenue/4", "structures/buildings/avenue/4"],
    wallEast: ["structures/buildings/avenue/4", "structures/buildings/avenue/4"],
  },
  building5: {
    id: "building5",
    w: 3,
    h: 2,
    heightUnits: 32,
    isFlippable: true,
    defaultFacing: "S",
    flipMode: "H",
    anchorLiftUnits: -2,

    roof: "structures/buildings/china_town/1",
    wallSouth: ["structures/buildings/china_town/1", "structures/buildings/china_town/1", "structures/buildings/china_town/1"],
    wallEast: ["structures/buildings/china_town/1", "structures/buildings/china_town/1"],
  },
  building6: {
    id: "building6",
    w: 3,
    h: 2,
    heightUnits: 16,
    isFlippable: true,
    defaultFacing: "S",
    flipMode: "H",
    anchorLiftUnits: -2,

    roof: "structures/buildings/china_town/2",
    wallSouth: ["structures/buildings/china_town/2", "structures/buildings/china_town/2", "structures/buildings/china_town/2"],
    wallEast: ["structures/buildings/china_town/2", "structures/buildings/china_town/2"],
  },
  building7: {
    id: "building7",
    w: 3,
    h: 2,
    heightUnits: 16,
    isFlippable: true,
    defaultFacing: "S",
    flipMode: "H",
    anchorLiftUnits: -2,

    roof: "structures/buildings/china_town/3",
    wallSouth: ["structures/buildings/china_town/3", "structures/buildings/china_town/3", "structures/buildings/china_town/3"],
    wallEast: ["structures/buildings/china_town/3", "structures/buildings/china_town/3"],
  },
  building8: {
    id: "building8",
    w: 3,
    h: 2,
    heightUnits: 32,
    isFlippable: true,
    defaultFacing: "S",
    flipMode: "H",
    anchorLiftUnits: -2,

    roof: "structures/buildings/china_town/4",
    wallSouth: ["structures/buildings/china_town/4", "structures/buildings/china_town/4", "structures/buildings/china_town/4"],
    wallEast: ["structures/buildings/china_town/4", "structures/buildings/china_town/4"],
  },
  building9: {
    id: "building9",
    w: 3,
    h: 2,
    heightUnits: 20,
    isFlippable: true,
    defaultFacing: "S",
    flipMode: "H",
    anchorLiftUnits: -1,

    roof: "structures/buildings/avenue/1",
    wallSouth: ["structures/buildings/avenue/1", "structures/buildings/avenue/1", "structures/buildings/avenue/1"],
    wallEast: ["structures/buildings/avenue/1", "structures/buildings/avenue/1"],
  },
  building10: {
    id: "building10",
    w: 3,
    h: 2,
    heightUnits: 24,
    isFlippable: true,
    defaultFacing: "S",
    flipMode: "H",
    anchorLiftUnits: -1,
    wallLiftUnits: 0,
    roofLiftUnits: -1,
    roof: "structures/buildings/avenue/2",
    wallSouth: ["structures/buildings/avenue/2", "structures/buildings/avenue/2", "structures/buildings/avenue/2"],
    wallEast: ["structures/buildings/avenue/2", "structures/buildings/avenue/2"],
  },
  building11: {
    id: "building11",
    w: 3,
    h: 2,
    heightUnits: 20,
    isFlippable: true,
    defaultFacing: "S",
    flipMode: "H",
    anchorLiftUnits: -1,

    roof: "structures/buildings/avenue/3",
    wallSouth: ["structures/buildings/avenue/3", "structures/buildings/avenue/3", "structures/buildings/avenue/3"],
    wallEast: ["structures/buildings/avenue/3", "structures/buildings/avenue/3"],
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
