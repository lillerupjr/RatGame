import { OBJECTIVE_TRIGGER_IDS } from "../../systems/progression/objectiveSpec";
import { beginCardReward } from "./cardRewardFlow";
import { beginRelicReward } from "./relicRewardFlow";

const DEFAULT_FLOOR_REWARD_BUDGET = 3;

export type FloorRewardPolicy = "ZONE_TRIAL" | "SURVIVE" | "BOSS" | "SURVIVE_BOSS";

function getFloorIndex(world: any): number {
  return Number.isFinite(world?.floorIndex) ? world.floorIndex : 0;
}

function ensureClaimKeyList(world: any): string[] {
  if (!Array.isArray(world.cardRewardClaimKeys)) world.cardRewardClaimKeys = [];
  return world.cardRewardClaimKeys;
}

function hasClaimKey(world: any, key: string): boolean {
  const keys = ensureClaimKeyList(world);
  return keys.includes(key);
}

function addClaimKey(world: any, key: string): void {
  const keys = ensureClaimKeyList(world);
  if (!keys.includes(key)) keys.push(key);
}

function firstCompletedObjectiveId(world: any): string | null {
  const states = world?.objectiveStates;
  if (Array.isArray(states)) {
    for (let i = 0; i < states.length; i++) {
      if (states[i]?.status === "COMPLETED" && typeof states[i]?.id === "string") {
        return states[i].id;
      }
    }
  }
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

function parseZoneClearIndex(triggerId: string): number {
  const raw = triggerId.slice(OBJECTIVE_TRIGGER_IDS.zoneClearedPrefix.length);
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : -1;
}

function consumeFirstBossZoneKillSignal(world: any): string | null {
  const signals = world?.triggerSignals;
  if (!Array.isArray(signals)) return null;
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    const id = signal?.triggerId;
    if (typeof id === "string" && id.startsWith(OBJECTIVE_TRIGGER_IDS.bossZonePrefix)) {
      signals.splice(i, 1);
      return id;
    }
  }
  return null;
}

function parseBossZoneIndex(triggerId: string): number {
  const raw = triggerId.slice(OBJECTIVE_TRIGGER_IDS.bossZonePrefix.length);
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : -1;
}

function hasSurviveBossSignals(world: any): boolean {
  return !!world?._surviveBossSpawned || !!world?.chestOpenRequested;
}

export function floorRewardPolicy(world: any): FloorRewardPolicy {
  const archetype = world?.floorArchetype;
  if (archetype === "TIME_TRIAL") return "ZONE_TRIAL";
  if (archetype === "BOSS_TRIPLE") return "BOSS";
  if (archetype === "SURVIVE") {
    return hasSurviveBossSignals(world) ? "SURVIVE_BOSS" : "SURVIVE";
  }
  return "SURVIVE";
}

export function resetFloorCardRewardBudget(world: any): void {
  world.cardRewardBudgetTotal = DEFAULT_FLOOR_REWARD_BUDGET;
  world.cardRewardBudgetUsed = 0;
  world.cardRewardClaimKeys = [];
  world.lastCardRewardClaimKey = null;
}

export function canGrantFloorCardReward(world: any): boolean {
  const total = Number.isFinite(world?.cardRewardBudgetTotal)
    ? world.cardRewardBudgetTotal
    : DEFAULT_FLOOR_REWARD_BUDGET;
  const used = Number.isFinite(world?.cardRewardBudgetUsed) ? world.cardRewardBudgetUsed : 0;
  return used < total;
}

export function consumeFloorCardReward(world: any): void {
  const used = Number.isFinite(world?.cardRewardBudgetUsed) ? world.cardRewardBudgetUsed : 0;
  world.cardRewardBudgetUsed = used + 1;
}

export function tryBeginCardReward(world: any, claimKey: string, source: "ZONE_TRIAL" | "BOSS_CHEST", optionCount: number): boolean {
  if (world?.state !== "RUN") return false;
  if (!canGrantFloorCardReward(world)) return false;
  if (hasClaimKey(world, claimKey)) return false;

  addClaimKey(world, claimKey);
  consumeFloorCardReward(world);
  world.lastCardRewardClaimKey = claimKey;

  beginCardReward(world, source, optionCount);
  world.state = "REWARD";
  return true;
}

export function tryBeginObjectiveRelicReward(world: any, claimKey: string, optionCount: number): boolean {
  if (world?.state !== "RUN") return false;
  if (!canGrantFloorCardReward(world)) return false;
  if (hasClaimKey(world, claimKey)) return false;

  addClaimKey(world, claimKey);
  consumeFloorCardReward(world);
  world.lastCardRewardClaimKey = claimKey;

  beginRelicReward(world, "OBJECTIVE_COMPLETION", optionCount);
  world.state = "REWARD";
  return true;
}

export function processChestOpenRequested(world: any, optionCount: number): boolean {
  if (!world?.chestOpenRequested) return false;
  world.chestOpenRequested = false;
  if (floorRewardPolicy(world) === "BOSS") return false;

  const claimKey = `${getFloorIndex(world)}:BOSS_CHEST`;
  return tryBeginCardReward(world, claimKey, "BOSS_CHEST", optionCount);
}

export function processObjectiveCompletionReward(world: any, optionCount: number): boolean {
  if (world?.floorArchetype === "VENDOR" || world?.floorArchetype === "HEAL") return false;
  const policy = floorRewardPolicy(world);
  if (policy === "BOSS") return false;

  const objectiveId = firstCompletedObjectiveId(world);
  if (!objectiveId) return false;
  ensureObjectiveMarkedCompleted(world, objectiveId);

  const floorIndex = getFloorIndex(world);
  const claimKey =
    policy === "ZONE_TRIAL"
      ? `${floorIndex}:TRIAL_COMPLETE`
      : `${floorIndex}:OBJ_COMPLETE:${objectiveId}`;

  if (tryBeginObjectiveRelicReward(world, claimKey, optionCount)) {
    world.objectiveRewardClaimedKey = claimKey;
    return true;
  }

  return false;
}

export function processZoneClearedReward(world: any, optionCount: number): boolean {
  const policy = floorRewardPolicy(world);
  if (policy !== "ZONE_TRIAL") return false;
  // If objective is already complete, completion reward should control flow.
  if (firstCompletedObjectiveId(world)) return false;

  const triggerId = consumeFirstZoneClearedSignal(world);
  if (!triggerId) return false;

  const zoneIndex = parseZoneClearIndex(triggerId);
  if (zoneIndex <= 0 || zoneIndex > 2) return false;

  const claimKey = `${getFloorIndex(world)}:ZONE_CLEAR:${zoneIndex}`;
  if (tryBeginCardReward(world, claimKey, "ZONE_TRIAL", optionCount)) {
    world.zoneRewardClaimedKey = claimKey;
    return true;
  }

  return false;
}

export function processBossMilestoneRewards(world: any, optionCount: number): boolean {
  if (floorRewardPolicy(world) !== "BOSS") return false;

  const triggerId = consumeFirstBossZoneKillSignal(world);
  if (!triggerId) return false;
  const bossIndex = parseBossZoneIndex(triggerId);
  if (bossIndex <= 0 || bossIndex > 2) return false;

  const floorIndex = getFloorIndex(world);
  const key = `${floorIndex}:BOSS_CLEAR:${bossIndex}`;
  return tryBeginCardReward(world, key, "ZONE_TRIAL", optionCount);
}

export function processSurviveMilestoneRewards(world: any, optionCount: number): boolean {
  const policy = floorRewardPolicy(world);
  if (policy !== "SURVIVE" && policy !== "SURVIVE_BOSS") return false;

  const now = Number(world?.timeSec ?? 0);
  const floorIndex = getFloorIndex(world);

  // Survive reward cadence: one milestone at 60s, then objective completion and boss reward.
  const milestones = [60];
  for (let i = 0; i < milestones.length; i++) {
    const t = milestones[i];
    if (now < t) continue;

    const key = `${floorIndex}:SURVIVE_T:${t}`;
    if (tryBeginCardReward(world, key, "ZONE_TRIAL", optionCount)) return true;
  }

  return false;
}
