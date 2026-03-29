import type { FloorRewardBudget } from "./floorRewardBudget";

export type RewardEvent =
  | { type: "CHEST_OPENED"; chestKind: "BOSS" | "OTHER" }
  | { type: "OBJECTIVE_COMPLETED" }
  | { type: "SURVIVE_1MIN_REWARD" }
  | { type: "ZONE_COMPLETED"; zoneIndex: 1 | 2 };

export type RewardOutcome =
  | { type: "GRANT_CARD"; reason: string }
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
      if (ev.chestKind === "BOSS") {
        if (budget.nonObjectiveCardsRemaining > 0) {
          budget.nonObjectiveCardsRemaining -= 1;
          return { type: "GRANT_CARD", reason: "Boss chest consumed non-objective budget" };
        }
        return { type: "NO_REWARD", reason: "Boss chest skipped (budget exhausted)" };
      }
      return { type: "NO_REWARD", reason: "Non-boss chest ignored" };
    }

    case "OBJECTIVE_COMPLETED": {
      return { type: "GRANT_GOLD", amount: OBJECTIVE_COMPLETION_GOLD, reason: "Objective completion grants gold" };
    }

    case "SURVIVE_1MIN_REWARD": {
      // Hardcoded: only meaningful in SURVIVE_TRIAL
      if (budget.mode !== "SURVIVE_TRIAL") return { type: "NO_REWARD", reason: "Survive 1-min ignored in this mode" };
      return consumeNonObjectiveOnce(budget, "SURVIVE_1MIN_REWARD", "Survive 1-min reward");
    }

    case "ZONE_COMPLETED": {
      // Hardcoded: only meaningful in ZONE_TRIAL
      if (budget.mode !== "ZONE_TRIAL") return { type: "NO_REWARD", reason: "Zone completion ignored in this mode" };
      if (ev.zoneIndex !== 1 && ev.zoneIndex !== 2) return { type: "NO_REWARD", reason: "Invalid zone index" };
      return consumeNonObjectiveOnce(budget, `ZONE_${ev.zoneIndex}_COMPLETE`, `Zone ${ev.zoneIndex} completion`);
    }

    default:
      return { type: "NO_REWARD", reason: "Unhandled reward event" };
  }
}

function consumeNonObjectiveOnce(budget: FloorRewardBudget, key: string, reason: string): RewardOutcome {
  if (budget.fired[key]) return { type: "NO_REWARD", reason: `${reason} already fired` };
  budget.fired[key] = true;

  if (budget.nonObjectiveCardsRemaining > 0) {
    budget.nonObjectiveCardsRemaining -= 1;
    return { type: "GRANT_CARD", reason: `${reason} consumed non-objective budget` };
  }

  // IMPORTANT: do NOT substitute gold here unless design changes later.
  return { type: "NO_REWARD", reason: `${reason} skipped (budget exhausted)` };
}
