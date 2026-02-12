import type { FloorArchetype } from "./floorArchetype";
import type { StageId } from "../content/stages";
import type { MapId } from "./mapIds";
import type { ObjectiveId } from "./objectivePlan";

export type PlacementPolicy = "LONGEST_PATH" | "STATIC_POINTS";

export type FloorIntent = {
  nodeId: string;
  zoneId: StageId;
  depth: number;
  floorIndex: number;
  archetype: FloorArchetype;
  mapId?: MapId;
  objectiveId?: ObjectiveId;
  variantSeed?: number;
  timeLimitSec?: number;
  bossCount?: number;
  spawnZoneCount?: number;
  spawnZoneRadiusTiles?: number;
  spawnZoneMinSeparationTiles?: number;
  placementPolicy?: PlacementPolicy;
};
