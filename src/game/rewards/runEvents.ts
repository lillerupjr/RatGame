// @system   progression/objectives/rewards
// @owns     defines durable run-event union and world-backed enqueue/shift/query helpers
// @doc      docs/canonical/progression_objectives_rewards.md
// @agents   no fact capture, reward planning, or ticket lifecycle; see rewardRunEventProducerSystem.ts, rewardSchedulerSystem.ts, and rewardTickets.ts

export type RunEvent =
  | {
      type: "ZONE_CLEARED";
      floorIndex: number;
      zoneIndex: 1 | 2;
    }
  | {
      type: "RARE_MILESTONE_CLEARED";
      floorIndex: number;
      rareIndex: 1 | 2;
    }
  | {
      type: "OBJECTIVE_COMPLETED";
      floorIndex: number;
      objectiveId: string;
    }
  | {
      type: "CHEST_OPEN_REQUESTED";
      floorIndex: number;
      chestKind: "BOSS" | "OTHER";
    }
  | {
      type: "SURVIVE_MILESTONE";
      floorIndex: number;
      seconds: 60;
    };

export function ensureRunEventQueue(world: any): RunEvent[] {
  if (!Array.isArray(world.runEvents)) world.runEvents = [];
  return world.runEvents as RunEvent[];
}

export function enqueueRunEvent(world: any, ev: RunEvent): void {
  ensureRunEventQueue(world).push(ev);
}

export function shiftRunEvent(world: any): RunEvent | null {
  const queue = ensureRunEventQueue(world);
  if (queue.length <= 0) return null;
  const ev = queue.shift();
  return ev ?? null;
}

export function hasQueuedRunEvent(world: any, predicate: (ev: RunEvent) => boolean): boolean {
  const queue = ensureRunEventQueue(world);
  for (let i = 0; i < queue.length; i++) {
    if (predicate(queue[i])) return true;
  }
  return false;
}
