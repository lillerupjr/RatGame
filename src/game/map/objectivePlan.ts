import type { FloorArchetype } from "./floorArchetype";
import type { ObjectiveSpec } from "../systems/progression/objectiveSpec";

export type ObjectiveId =
  | "SURVIVE_TIMER"
  | "ZONE_TRIAL"
  | "TIME_TRIAL_ZONES"
  | "VENDOR_VISIT"
  | "HEAL_VISIT"
  | "KILL_RARES_IN_ZONES";

export const OBJECTIVE_IDS: ObjectiveId[] = [
  "SURVIVE_TIMER",
  "ZONE_TRIAL",
  "TIME_TRIAL_ZONES",
  "VENDOR_VISIT",
  "HEAL_VISIT",
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
  }>
): ObjectiveSpec {
  switch (objectiveId) {
    case "SURVIVE_TIMER":
      return {
        objectiveType: "SURVIVE_TIMER",
        params: {
          timeLimitSec: params?.timeLimitSec ?? 60,
        },
      };
    case "ZONE_TRIAL":
      return {
        objectiveType: "ZONE_TRIAL",
        params: {
          zoneCount: params?.zoneCount ?? 2,
          zoneSize: 4,
          killTargetPerZone: 8,
        },
      };
    case "TIME_TRIAL_ZONES":
      return {
        objectiveType: "ZONE_TRIAL",
        params: {
          zoneCount: params?.zoneCount ?? 2,
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
