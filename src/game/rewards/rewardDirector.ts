import type { FloorRewardBudget } from "./floorRewardBudget";

export type RewardEvent =
  | { type: "CHEST_OPENED"; chestKind: "BOSS" | "OTHER" }
  | { type: "OBJECTIVE_COMPLETED" }
  | { type: "SURVIVE_1MIN_REWARD" }
  | { type: "ZONE_COMPLETED"; zoneIndex: 1 | 2 };

export type RewardOutcome =
  | { type: "GRANT_PROGRESSION_REWARD"; reason: string }
  | { type: "GRANT_GOLD"; amount: number; reason: string }
  | { type: "NO_REWARD"; reason: string };

export const OBJECTIVE_COMPLETION_GOLD = 50;

export function handleRewardEvent(
  budget: FloorRewardBudget,
  ev: RewardEvent,
  ctx: { depth: number }
): RewardOutcome {
  switch (ev.type) {
    case "CHEST_OPENED": {
      return { type: "NO_REWARD", reason: `${ev.chestKind} chest rewards disabled` };
    }

    case "OBJECTIVE_COMPLETED": {
      return { type: "GRANT_PROGRESSION_REWARD", reason: "Objective completion grants progression reward" };
    }

    case "SURVIVE_1MIN_REWARD": {
      return { type: "NO_REWARD", reason: "Survive milestone rewards disabled" };
    }

    case "ZONE_COMPLETED": {
      return { type: "NO_REWARD", reason: `Zone ${ev.zoneIndex} completion reward disabled` };
    }

    default:
      return { type: "NO_REWARD", reason: "Unhandled reward event" };
  }
}
