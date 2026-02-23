import { beginCardReward } from "./cardRewardFlow";

function firstCompletedObjectiveId(world: any): string | null {
  const states = world?.objectiveStates;
  if (!Array.isArray(states)) return null;
  for (let i = 0; i < states.length; i++) {
    if (states[i]?.status === "COMPLETED" && typeof states[i]?.id === "string") {
      return states[i].id;
    }
  }
  return null;
}

export function processChestOpenRequested(world: any, optionCount: number): boolean {
  if (!world?.chestOpenRequested) return false;
  world.chestOpenRequested = false;
  beginCardReward(world, "BOSS_CHEST", optionCount);
  world.state = "REWARD";
  return true;
}

export function processObjectiveCompletionReward(world: any, optionCount: number): boolean {
  const objectiveId = firstCompletedObjectiveId(world);
  if (!objectiveId) return false;

  const key = `${world.floorIndex ?? 0}:${objectiveId}`;
  if (world.objectiveRewardClaimedKey === key) return false;

  world.objectiveRewardClaimedKey = key;
  beginCardReward(world, "ZONE_TRIAL", optionCount);
  world.state = "REWARD";
  return true;
}
