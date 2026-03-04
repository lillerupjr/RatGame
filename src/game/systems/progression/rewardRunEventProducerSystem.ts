import type { World } from "../../../engine/world/world";
import { ENEMY_TYPE } from "../../factories/enemyFactory";
import { enqueueRunEvent } from "../../rewards/runEvents";
import { OBJECTIVE_TRIGGER_IDS } from "./objectiveSpec";

export type RewardRunEventProducerOptions = {
  includeCoreFacts?: boolean;
  includeChest?: boolean;
};

function getFloorIndex(world: World): number {
  return Number.isFinite(world.floorIndex) ? (world.floorIndex | 0) : 0;
}

function parseBossZoneIndex(triggerId: string): number {
  if (!triggerId.startsWith(OBJECTIVE_TRIGGER_IDS.bossZonePrefix)) return -1;
  const raw = triggerId.slice(OBJECTIVE_TRIGGER_IDS.bossZonePrefix.length);
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return -1;
  return n;
}

function ensureBossMilestoneCount(world: World): number {
  const w = world as World & { _rewardBossMilestoneCount?: number };
  if (!Number.isFinite(w._rewardBossMilestoneCount)) w._rewardBossMilestoneCount = 0;
  return w._rewardBossMilestoneCount ?? 0;
}

function incrementBossMilestoneCount(world: World): number {
  const w = world as World & { _rewardBossMilestoneCount?: number };
  const next = ensureBossMilestoneCount(world) + 1;
  w._rewardBossMilestoneCount = next;
  return next;
}

function ensureSeenBossKillEvents(world: World): WeakSet<object> {
  const w = world as World & { _rewardSeenBossKillEvents?: WeakSet<object> };
  if (!w._rewardSeenBossKillEvents) w._rewardSeenBossKillEvents = new WeakSet<object>();
  return w._rewardSeenBossKillEvents;
}

function ensureObjectiveSeenMap(world: World): Record<string, true> {
  const w = world as World & { _rewardObjectiveCompletedSeen?: Record<string, true> };
  if (!w._rewardObjectiveCompletedSeen) {
    w._rewardObjectiveCompletedSeen = Object.create(null) as Record<string, true>;
  }
  return w._rewardObjectiveCompletedSeen;
}

function ensureSurviveMilestoneSeenMap(world: World): Record<string, true> {
  const w = world as World & { _rewardSurviveMilestoneSeen?: Record<string, true> };
  if (!w._rewardSurviveMilestoneSeen) {
    w._rewardSurviveMilestoneSeen = Object.create(null) as Record<string, true>;
  }
  return w._rewardSurviveMilestoneSeen;
}

function captureBossMilestoneEvents(world: World): void {
  const events = world.events;
  if (!Array.isArray(events) || events.length <= 0) return;

  const floorIndex = getFloorIndex(world);
  const seenBossKillEvents = ensureSeenBossKillEvents(world);
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev?.type !== "ENEMY_KILLED") continue;
    if (typeof ev === "object" && ev !== null) {
      if (seenBossKillEvents.has(ev as object)) continue;
      seenBossKillEvents.add(ev as object);
    }

    const enemyIndex = Number.isFinite(ev.enemyIndex) ? (ev.enemyIndex as number) : -1;
    if (enemyIndex < 0) continue;
    if (world.eType?.[enemyIndex] !== ENEMY_TYPE.BOSS) continue;

    const triggerId =
      typeof ev.spawnTriggerId === "string"
        ? ev.spawnTriggerId
        : world.eSpawnTriggerId?.[enemyIndex];
    if (typeof triggerId !== "string") continue;

    const bossIndex = parseBossZoneIndex(triggerId);
    if (bossIndex < 1) continue;

    // Boss-triple rewards are based on kill order (first/second boss killed),
    // not on fixed trigger zone ids.
    const milestone = incrementBossMilestoneCount(world);
    if (milestone !== 1 && milestone !== 2) continue;

    enqueueRunEvent(world, {
      type: "BOSS_MILESTONE_CLEARED",
      floorIndex,
      bossIndex: milestone,
    });
  }
}

function captureObjectiveCompletionEvents(world: World): void {
  const objectiveStates = world.objectiveStates;
  if (!Array.isArray(objectiveStates) || objectiveStates.length <= 0) return;

  const seen = ensureObjectiveSeenMap(world);
  const floorIndex = getFloorIndex(world);
  for (let i = 0; i < objectiveStates.length; i++) {
    const st = objectiveStates[i];
    if (st?.status !== "COMPLETED") continue;

    const objectiveId = typeof st.id === "string" ? st.id : "";
    if (!objectiveId) continue;
    if (seen[objectiveId]) continue;

    seen[objectiveId] = true;
    enqueueRunEvent(world, {
      type: "OBJECTIVE_COMPLETED",
      floorIndex,
      objectiveId,
    });
  }
}

function captureSurviveMilestoneEvents(world: World): void {
  if (world.floorRewardBudget?.mode !== "SURVIVE_TRIAL") return;
  if ((world.timeSec ?? 0) < 60) return;

  const seen = ensureSurviveMilestoneSeenMap(world);
  const key = "60";
  if (seen[key]) return;

  seen[key] = true;
  enqueueRunEvent(world, {
    type: "SURVIVE_MILESTONE",
    floorIndex: getFloorIndex(world),
    seconds: 60,
  });
}

function captureChestOpenRequest(world: World): void {
  if (!world.chestOpenRequested) return;
  enqueueRunEvent(world, {
    type: "CHEST_OPEN_REQUESTED",
    floorIndex: getFloorIndex(world),
    chestKind: "BOSS",
  });
  world.chestOpenRequested = false;
}

export function rewardRunEventProducerSystem(
  world: World,
  options: RewardRunEventProducerOptions = {},
): void {
  if (options.includeCoreFacts !== false) {
    captureBossMilestoneEvents(world);
    captureObjectiveCompletionEvents(world);
    captureSurviveMilestoneEvents(world);
  }

  if (options.includeChest !== false) {
    captureChestOpenRequest(world);
  }
}
