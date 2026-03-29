export type ObjectiveMode = "NORMAL" | "SURVIVE_TRIAL" | "ZONE_TRIAL";

export type FloorRewardBudget = {
  mode: ObjectiveMode;
  nonObjectiveCardsRemaining: number; // floor card rewards disabled; kept for debug compatibility
  objectiveCardAvailable: boolean;    // legacy flag; objective rewards no longer spend card budget
  fired: Record<string, boolean>;     // idempotency keys
};

export function createFloorRewardBudget(mode: ObjectiveMode): FloorRewardBudget {
  return {
    mode,
    nonObjectiveCardsRemaining: 0,
    objectiveCardAvailable: true,
    fired: Object.create(null),
  };
}
