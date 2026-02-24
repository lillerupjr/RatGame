export type ObjectiveMode = "NORMAL" | "SURVIVE_TRIAL" | "ZONE_TRIAL";

export type FloorRewardBudget = {
  mode: ObjectiveMode;
  nonObjectiveCardsRemaining: number; // starts at 2
  objectiveCardAvailable: boolean;    // starts true
  fired: Record<string, boolean>;     // idempotency keys
};

export function createFloorRewardBudget(mode: ObjectiveMode): FloorRewardBudget {
  return {
    mode,
    nonObjectiveCardsRemaining: 2,
    objectiveCardAvailable: true,
    fired: Object.create(null),
  };
}
