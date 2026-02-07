import type { FloorIntent } from "./floorIntent";
import type { ObjectiveSpec } from "../systems/progression/objectiveSpec";

export function objectiveSpecFromFloorIntent(intent: FloorIntent): ObjectiveSpec {
  switch (intent.archetype) {
    case "SURVIVE":
      return {
        objectiveType: "SURVIVE_TIMER",
        params: {
          timeLimitSec: intent.timeLimitSec ?? 120,
        },
      };
    case "TIME_TRIAL":
      return {
        objectiveType: "TIME_TRIAL_ZONES",
        params: {
          timeLimitSec: intent.timeLimitSec ?? 120,
          zoneCount: intent.spawnZoneCount ?? 3,
        },
      };
    case "VENDOR":
      return {
        objectiveType: "VENDOR_VISIT",
        params: {},
      };
    case "HEAL":
      return {
        objectiveType: "HEAL_VISIT",
        params: {},
      };
    case "BOSS_TRIPLE":
      return {
        objectiveType: "KILL_RARES_IN_ZONES",
        params: {
          bossCount: intent.bossCount ?? 3,
          zoneCount: intent.spawnZoneCount ?? 3,
          timeLimitSec: intent.timeLimitSec ?? null,
        },
      };
  }
}
