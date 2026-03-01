import { OBJECTIVE_TRIGGER_IDS } from "./objectiveSpec";

function bossZoneIndexFromTriggerId(triggerId: string): number | null {
  if (!triggerId.startsWith(OBJECTIVE_TRIGGER_IDS.bossZonePrefix)) return null;
  const raw = triggerId.slice(OBJECTIVE_TRIGGER_IDS.bossZonePrefix.length);
  const idx = Number.parseInt(raw, 10) - 1;
  if (!Number.isFinite(idx) || idx < 0) return null;
  return idx;
}

function markCompletedIndex(world: any, idx: number): void {
  const bt = world?.bossTriple;
  if (!bt || !Array.isArray(bt.completed)) return;
  if (idx >= bt.completed.length) return;
  bt.completed[idx] = true;
}

export function markBossTripleClearsFromSignalsAndEvents(world: any): void {
  const bt = world?.bossTriple;
  if (!bt || !Array.isArray(bt.completed)) return;

  const signals = Array.isArray(world.triggerSignals) ? world.triggerSignals : [];
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    if (signal?.type !== "KILL") continue;
    const triggerId = signal?.triggerId;
    if (typeof triggerId !== "string") continue;
    const idx = bossZoneIndexFromTriggerId(triggerId);
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
    const idx = bossZoneIndexFromTriggerId(triggerId);
    if (idx === null) continue;
    markCompletedIndex(world, idx);
  }
}

export function syncBossTripleObjectiveStateFromClears(world: any): void {
  if (world?.floorArchetype !== "BOSS_TRIPLE") return;
  const bt = world?.bossTriple;
  if (!bt || !Array.isArray(bt.completed)) return;
  const defs = Array.isArray(world.objectiveDefs) ? world.objectiveDefs : [];
  const states = Array.isArray(world.objectiveStates) ? world.objectiveStates : [];
  const idx = defs.findIndex((d: any) => d?.id === "OBJ_BOSS_RARES");
  if (idx < 0) return;
  const def = defs[idx];
  const st = states[idx];
  if (!st) return;

  const completedCount = bt.completed.reduce((n: number, v: boolean) => n + (v ? 1 : 0), 0);
  const required =
    def?.completionRule?.type === "SIGNAL_COUNT" && Number.isFinite(def?.completionRule?.count)
      ? Math.max(1, Math.floor(def.completionRule.count))
      : Math.max(1, bt.completed.length);

  if (!st.progress) st.progress = { signalCount: 0 };
  st.progress.signalCount = Math.max(st.progress.signalCount ?? 0, completedCount);
  if (st.status === "IDLE" && st.progress.signalCount > 0) st.status = "ACTIVE";
  if (completedCount >= required) st.status = "COMPLETED";
}
