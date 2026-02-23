import { beginCardReward } from "./cardRewardFlow";
import { OBJECTIVE_TRIGGER_IDS } from "../../systems/progression/objectiveSpec";

function isZoneTrialCompleted(world: any): boolean {
  return !!world?.zoneTrialObjective?.completed;
}

function firstCompletedObjectiveId(world: any): string | null {
  const states = world?.objectiveStates;
  if (!Array.isArray(states)) return null;
  for (let i = 0; i < states.length; i++) {
    if (states[i]?.status === "COMPLETED" && typeof states[i]?.id === "string") {
      return states[i].id;
    }
  }
  if (isZoneTrialCompleted(world)) return "OBJ_ZONE_TRIAL";
  return null;
}

function ensureObjectiveMarkedCompleted(world: any, objectiveId: string): void {
  const states = world?.objectiveStates;
  if (!Array.isArray(states)) return;
  for (let i = 0; i < states.length; i++) {
    const st = states[i];
    if (st?.id !== objectiveId) continue;
    if (st.status !== "COMPLETED") st.status = "COMPLETED";
    return;
  }
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

  ensureObjectiveMarkedCompleted(world, objectiveId);
  world.objectiveRewardClaimedKey = key;
  beginCardReward(world, "ZONE_TRIAL", optionCount);
  world.state = "REWARD";
  return true;
}

function consumeFirstZoneClearedSignal(world: any): string | null {
  const signals = world?.triggerSignals;
  if (!Array.isArray(signals)) return null;
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    const id = signal?.triggerId;
    if (typeof id === "string" && id.startsWith(OBJECTIVE_TRIGGER_IDS.zoneClearedPrefix)) {
      signals.splice(i, 1);
      return id;
    }
  }
  return null;
}

function ensureZoneClaimSet(world: any): Set<string> {
  if (Array.isArray(world.zoneRewardClaimedKeys)) {
    return new Set(world.zoneRewardClaimedKeys.filter((x: unknown) => typeof x === "string"));
  }
  if (typeof world.zoneRewardClaimedKey === "string" && world.zoneRewardClaimedKey.length > 0) {
    return new Set([world.zoneRewardClaimedKey]);
  }
  return new Set<string>();
}

/**
 * Start a card reward when a zone is cleared inside Zone Trial.
 * Claimed once per floor+zone trigger id.
 */
export function processZoneClearedReward(world: any, optionCount: number): boolean {
  const triggerId = consumeFirstZoneClearedSignal(world);
  if (!triggerId) return false;

  const key = `${world.floorIndex ?? 0}:${triggerId}`;
  const claimed = ensureZoneClaimSet(world);
  if (claimed.has(key)) return false;

  claimed.add(key);
  world.zoneRewardClaimedKeys = Array.from(claimed);
  world.zoneRewardClaimedKey = key;
  beginCardReward(world, "ZONE_TRIAL", optionCount);
  world.state = "REWARD";
  return true;
}
