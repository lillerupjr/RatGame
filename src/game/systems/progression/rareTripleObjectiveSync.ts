import { OBJECTIVE_TRIGGER_IDS } from "./objectiveSpec";

function rareZoneIndexFromTriggerId(triggerId: string): number | null {
  if (!triggerId.startsWith(OBJECTIVE_TRIGGER_IDS.rareZonePrefix)) return null;
  const raw = triggerId.slice(OBJECTIVE_TRIGGER_IDS.rareZonePrefix.length);
  const idx = Number.parseInt(raw, 10) - 1;
  if (!Number.isFinite(idx) || idx < 0) return null;
  return idx;
}

function markCompletedIndex(world: any, idx: number): void {
  const rt = world?.rareTriple;
  if (!rt || !Array.isArray(rt.completed)) return;
  if (idx >= rt.completed.length) return;
  rt.completed[idx] = true;
}

export function markRareTripleClearsFromSignalsAndEvents(world: any): void {
  const rt = world?.rareTriple;
  if (!rt || !Array.isArray(rt.completed)) return;

  const signals = Array.isArray(world.triggerSignals) ? world.triggerSignals : [];
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    if (signal?.type !== "KILL") continue;
    const triggerId = signal?.triggerId;
    if (typeof triggerId !== "string") continue;
    const idx = rareZoneIndexFromTriggerId(triggerId);
    if (idx === null) continue;
    markCompletedIndex(world, idx);
  }

  const events = Array.isArray(world.events) ? world.events : [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev?.type !== "ENEMY_KILLED") continue;
    const enemyIndex = Number.isFinite(ev.enemyIndex) ? (ev.enemyIndex as number) : -1;
    const triggerIdFromEnemy =
      enemyIndex >= 0 && Array.isArray(world.eSpawnTriggerId) ? world.eSpawnTriggerId[enemyIndex] : undefined;
    const triggerId =
      typeof (ev as any).spawnTriggerId === "string"
        ? (ev as any).spawnTriggerId
        : triggerIdFromEnemy;
    if (typeof triggerId !== "string") continue;
    const idx = rareZoneIndexFromTriggerId(triggerId);
    if (idx === null) continue;
    markCompletedIndex(world, idx);
  }
}

export function syncRareTripleObjectiveStateFromClears(world: any): void {
  if (world?.floorArchetype !== "RARE_TRIPLE") return;
  const rt = world?.rareTriple;
  if (!rt || !Array.isArray(rt.completed)) return;
  const defs = Array.isArray(world.objectiveDefs) ? world.objectiveDefs : [];
  const states = Array.isArray(world.objectiveStates) ? world.objectiveStates : [];
  const idx = defs.findIndex((d: any) => d?.id === "OBJ_RARE_TRIPLE");
  if (idx < 0) return;
  const def = defs[idx];
  const st = states[idx];
  if (!st) return;

  const completedCount = rt.completed.reduce((n: number, v: boolean) => n + (v ? 1 : 0), 0);
  const required =
    def?.completionRule?.type === "SIGNAL_COUNT" && Number.isFinite(def?.completionRule?.count)
      ? Math.max(1, Math.floor(def.completionRule.count))
      : 1;

  if (!st.progress) st.progress = { signalCount: 0 };
  st.progress.signalCount = Math.max(st.progress.signalCount ?? 0, completedCount);
  if (st.status === "IDLE" && st.progress.signalCount > 0) st.status = "ACTIVE";
  const wasCompleted = st.status === "COMPLETED";
  if (completedCount >= required) st.status = "COMPLETED";
  if (!wasCompleted && st.status === "COMPLETED") {
    const floorId = world?.currentFloorIntent?.nodeId ?? `${world?.floorIndex ?? 0}:${world?.floorArchetype ?? "RARE_TRIPLE"}`;
    const frameNo = world?.__objectiveFrameNo ?? 0;
    console.debug(
      `[objectives:complete] floorId=${floorId} objectiveId=OBJ_RARE_TRIPLE required=${required} progress=${st.progress.signalCount ?? 0} frame=${frameNo}`,
    );
  }
}
