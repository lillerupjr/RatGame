// @system   progression/objectives/rewards
// @owns     define floor objective reward budget tables
// @doc      docs/canonical/progression_objectives_rewards.md
// @agents   no reward event handling or payout application; see rewardDirector.ts

export type ObjectiveMode = "NORMAL" | "SURVIVE_TRIAL" | "ZONE_TRIAL";

export type FloorRewardBudget = {
  mode: ObjectiveMode;
  nonObjectiveRewardsRemaining: number;
  objectiveRewardAvailable: boolean;
  fired: Record<string, boolean>;     // idempotency keys
};

export function createFloorRewardBudget(mode: ObjectiveMode): FloorRewardBudget {
  return {
    mode,
    nonObjectiveRewardsRemaining: 0,
    objectiveRewardAvailable: true,
    fired: Object.create(null),
  };
}
