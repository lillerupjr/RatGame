export type ObjectiveMode = "NORMAL" | "SURVIVE_TRIAL" | "ZONE_TRIAL";

export type FloorRewardBudget = {
  mode: ObjectiveMode;
  fired: Record<string, boolean>;
};

export function createFloorRewardBudget(mode: ObjectiveMode): FloorRewardBudget {
  return {
    mode,
    fired: Object.create(null),
  };
}
