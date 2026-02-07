import type { ObjectiveDef } from "./objective";

export type ObjectiveSpec =
  | { objectiveType: "SURVIVE_TIMER"; params: { timeLimitSec: number } }
  | {
      objectiveType: "TIME_TRIAL_ZONES";
      params: { timeLimitSec: number; zoneCount: number };
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
    case "TIME_TRIAL_ZONES": {
      return [
        {
          id: "OBJ_TIME_TRIAL",
          listensTo: [OBJECTIVE_TRIGGER_IDS.timer],
          completionRule: {
            type: "SIGNAL_COUNT",
            count: spec.params.timeLimitSec,
            signalType: "TICK",
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
