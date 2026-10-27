// @system   progression/objectives/rewards
// @owns     define progression reward family/source vocabulary
// @doc      docs/canonical/progression_objectives_rewards.md
// @agents   no option generation, ticket scheduling, or ring state mutation; see progressionOffers.ts, rewardSchedulerSystem.ts, and progressionRewardFlow.ts

export type ProgressionRewardFamily = "RING";

export type ProgressionRewardSource =
  | "FLOOR_COMPLETION"
  | "BOSS_CHEST"
  | "SIDE_OBJECTIVE";

export function rewardFamilyLabel(family: ProgressionRewardFamily): string {
  switch (family) {
    case "RING":
      return "Ring";
    default:
      return "Reward";
  }
}
