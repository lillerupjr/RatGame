import type { ObjectiveDef } from "./objective";

export type ObjectiveSpec =
  | { objectiveType: "SURVIVE_TIMER"; params: { timeLimitSec: number } }
  | {
      objectiveType: "ZONE_TRIAL";
      params: { zoneCount: number; zoneSize: number; killTargetPerZone: number };
    }
  | { objectiveType: "VENDOR_VISIT"; params: Record<string, never> }
  | { objectiveType: "HEAL_VISIT"; params: Record<string, never> }
  | {
      objectiveType: "KILL_RARES_IN_ZONES";
      params: { bossCount: number; zoneCount: number; timeLimitSec: number | null };
    };

export const OBJECTIVE_TRIGGER_IDS = {
  timer: "OBJ_TIMER",
  zonePrefix: "OBJ_ZONE_",
  bossZonePrefix: "OBJ_BOSS_ZONE_",

  // Trial-level completion (existing)
  zoneTrialComplete: "OBJ_ZONE_TRIAL_COMPLETE",
  vendor: "OBJ_VENDOR",
  heal: "OBJ_HEAL",
};

function buildIndexedTriggerIds(prefix: string, count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(`${prefix}${i + 1}`);
  }
  return ids;
}

export function objectiveSpecToObjectiveDefs(spec: ObjectiveSpec): ObjectiveDef[] {
  switch (spec.objectiveType) {
    case "SURVIVE_TIMER":
      return [
        {
          id: "OBJ_SURVIVE",
          listensTo: [OBJECTIVE_TRIGGER_IDS.timer],
          completionRule: {
            type: "SIGNAL_COUNT",
            count: spec.params.timeLimitSec,
            signalType: "TICK",
          },
          outcomes: [],
        },
      ];
    case "ZONE_TRIAL": {
      return [
        {
          id: "OBJ_ZONE_TRIAL",
          listensTo: [OBJECTIVE_TRIGGER_IDS.zoneTrialComplete],
          completionRule: {
            type: "SIGNAL_COUNT",
            count: 1,
            signalType: "KILL",
          },
          outcomes: [],
        },
      ];
    }
    case "VENDOR_VISIT":
      return [
        {
          id: "OBJ_VENDOR",
          listensTo: [OBJECTIVE_TRIGGER_IDS.vendor],
          completionRule: {
            type: "SIGNAL_COUNT",
            count: 1,
            signalType: "INTERACT",
          },
          outcomes: [],
        },
      ];
    case "HEAL_VISIT":
      return [
        {
          id: "OBJ_HEAL",
          listensTo: [OBJECTIVE_TRIGGER_IDS.heal],
          completionRule: {
            type: "SIGNAL_COUNT",
            count: 1,
            signalType: "INTERACT",
          },
          outcomes: [],
        },
      ];
    case "KILL_RARES_IN_ZONES": {
      const zones = buildIndexedTriggerIds(OBJECTIVE_TRIGGER_IDS.bossZonePrefix, spec.params.zoneCount);
      return [
        {
          id: "OBJ_BOSS_RARES",
          listensTo: zones,
          completionRule: {
            type: "SIGNAL_COUNT",
            count: spec.params.bossCount,
            signalType: "KILL",
          },
          outcomes: [],
        },
      ];
    }
  }
}
