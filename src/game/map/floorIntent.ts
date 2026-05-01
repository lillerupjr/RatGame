// @system   map-compilation/activation/floor-topology
// @owns     defines selected-floor intent payloads, placement policy, objective/boss/map/reward routing fields
// @doc      docs/canonical/map_compilation_activation_floor_topology.md
// @agents   no intent construction, activation, or objective execution; see delveMap.ts, game.ts, authoredMapActivation.ts, and systems/progression/*

import type { FloorArchetype } from "./floorArchetype";
import type { StageId } from "../content/stages";
import type { ObjectiveId } from "./objectivePlan";
import type { BossId } from "../bosses/bossTypes";
import type { ProgressionRewardFamily } from "../progression/rewards/rewardFamilies";

export type PlacementPolicy = "LONGEST_PATH" | "STATIC_POINTS";

export type FloorIntent = {
  nodeId: string;
  zoneId: StageId;
  depth: number;
  floorIndex: number;
  archetype: FloorArchetype;
  mapId?: string;
  bossId?: BossId;
  rewardFamily?: ProgressionRewardFamily;
  objectiveId?: ObjectiveId;
  variantSeed?: number;
  timeLimitSec?: number;
  rareCount?: number;
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
