import type { FloorArchetype } from "./floorArchetype";
import type { StageId } from "../content/stages";

export type PlacementPolicy = "LONGEST_PATH" | "STATIC_POINTS";

export type FloorIntent = {
  nodeId: string;
  zoneId: StageId;
  depth: number;
  floorIndex: number;
  archetype: FloorArchetype;
  timeLimitSec?: number;
  bossCount?: number;
  spawnZoneCount?: number;
  spawnZoneRadiusTiles?: number;
  spawnZoneMinSeparationTiles?: number;
  placementPolicy?: PlacementPolicy;
};
