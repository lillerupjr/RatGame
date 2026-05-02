// @system   progression/objectives/rewards
// @owns     define progression reward family/source vocabulary and depth defaults
// @doc      docs/canonical/progression_objectives_rewards.md
// @agents   no option generation, ticket scheduling, or ring state mutation; see progressionOffers.ts, rewardSchedulerSystem.ts, and progressionRewardFlow.ts

export type ProgressionRewardFamily = "RING" | "RING_MODIFIER_TOKEN" | "HAND_EFFECT";

export type ProgressionRewardSource =
  | "FLOOR_COMPLETION"
  | "BOSS_CHEST"
  | "SIDE_OBJECTIVE"
  | "LEVEL_UP";

export function rewardFamilyLabel(family: ProgressionRewardFamily): string {
  switch (family) {
    case "RING":
      return "Ring";
    case "RING_MODIFIER_TOKEN":
      return "Modifier";
    case "HAND_EFFECT":
      return "Hand";
    default:
      return "Reward";
  }
}

export function defaultRewardFamilyForDepth(depth: number): ProgressionRewardFamily {
  const normalized = Math.max(1, Math.floor(depth));
  const mod = normalized % 3;
  if (mod === 1) return "RING";
  if (mod === 2) return "RING_MODIFIER_TOKEN";
  return "HAND_EFFECT";
}
