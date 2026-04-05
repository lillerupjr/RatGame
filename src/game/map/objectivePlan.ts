import type { FloorArchetype } from "./floorArchetype";
import type { ObjectiveSpec } from "../systems/progression/objectiveSpec";
import type { BossId } from "../bosses/bossTypes";

export type ObjectiveId =
  | "SURVIVE_TIMER"
  | "ZONE_TRIAL"
  | "POE_MAP_CLEAR"
  | "TIME_TRIAL_ZONES"
  | "VENDOR_VISIT"
  | "HEAL_VISIT"
  | "ACT_BOSS"
  | "KILL_RARES_IN_ZONES";

export const OBJECTIVE_IDS: ObjectiveId[] = [
  "SURVIVE_TIMER",
  "ZONE_TRIAL",
  "POE_MAP_CLEAR",
  "TIME_TRIAL_ZONES",
  "VENDOR_VISIT",
  "HEAL_VISIT",
  "ACT_BOSS",
  "KILL_RARES_IN_ZONES",
];

export function objectiveIdFromArchetype(archetype: FloorArchetype): ObjectiveId {
  switch (archetype) {
    case "SURVIVE":
      return "SURVIVE_TIMER";
    case "TIME_TRIAL":
      return "ZONE_TRIAL";
    case "VENDOR":
      return "VENDOR_VISIT";
    case "HEAL":
      return "HEAL_VISIT";
    case "ACT_BOSS":
      return "ACT_BOSS";
    case "BOSS_TRIPLE":
      return "KILL_RARES_IN_ZONES";
  }
}

export function objectiveSpecFromObjectiveId(
  objectiveId: ObjectiveId,
  params?: Partial<{
    timeLimitSec: number;
    zoneCount: number;
    bossCount: number;
    bossId: BossId | null;
  }>
): ObjectiveSpec {
  switch (objectiveId) {
    case "SURVIVE_TIMER":
      return {
        objectiveType: "SURVIVE_TIMER",
        params: {
          timeLimitSec: params?.timeLimitSec ?? 120,
        },
      };
    case "ZONE_TRIAL":
      return {
        objectiveType: "ZONE_TRIAL",
        params: {
          zoneCount: params?.zoneCount ?? 3,
          zoneSize: 4,
          killTargetPerZone: 8,
        },
      };
    case "POE_MAP_CLEAR":
      return {
        objectiveType: "POE_MAP_CLEAR",
        params: {
          clearCount: 1,
        },
      };
    case "TIME_TRIAL_ZONES":
      return {
        objectiveType: "ZONE_TRIAL",
        params: {
          zoneCount: params?.zoneCount ?? 3,
          zoneSize: 4,
          killTargetPerZone: 8,
        },
      };
    case "VENDOR_VISIT":
      return {
        objectiveType: "VENDOR_VISIT",
        params: {},
      };
    case "HEAL_VISIT":
      return {
        objectiveType: "HEAL_VISIT",
        params: {},
      };
    case "ACT_BOSS":
      return {
        objectiveType: "ACT_BOSS",
        params: {
          bossId: params?.bossId ?? null,
        },
      };
    case "KILL_RARES_IN_ZONES":
      return {
        objectiveType: "KILL_RARES_IN_ZONES",
        params: {
          bossCount: params?.bossCount ?? 3,
          zoneCount: params?.zoneCount ?? 3,
          timeLimitSec: params?.timeLimitSec ?? null,
        },
      };
  }
}
