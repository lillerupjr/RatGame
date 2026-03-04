export type RunEvent =
  | {
      type: "ZONE_CLEARED";
      floorIndex: number;
      zoneIndex: 1 | 2;
    }
  | {
      type: "BOSS_MILESTONE_CLEARED";
      floorIndex: number;
      bossIndex: 1 | 2;
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
