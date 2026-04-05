import type { FloorArchetype } from "./floorArchetype";
import type { StageId } from "../content/stages";
import type { ObjectiveId } from "./objectivePlan";
import type { BossId } from "../bosses/bossTypes";

export type PlacementPolicy = "LONGEST_PATH" | "STATIC_POINTS";

export type FloorIntent = {
  nodeId: string;
  zoneId: StageId;
  depth: number;
  floorIndex: number;
  archetype: FloorArchetype;
  mapId?: string;
  bossId?: BossId;
  objectiveId?: ObjectiveId;
  variantSeed?: number;
  timeLimitSec?: number;
  bossCount?: number;
  spawnZoneCount?: number;
  spawnZoneRadiusTiles?: number;
  spawnZoneMinSeparationTiles?: number;
  placementPolicy?: PlacementPolicy;
  poeMapModifiers?: {
    packSizeMultiplier?: number;
    rarePackChanceMultiplier?: number;
    magicPackChanceMultiplier?: number;
    extraPopulationScalar?: number;
  };
};
