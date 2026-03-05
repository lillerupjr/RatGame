export type RunHeatState = {
  runHeat: number;
  floorClearCommitted: boolean;
};

export function normalizedRunHeat(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

export function resetFloorClearCommit(state: RunHeatState): void {
  state.floorClearCommitted = false;
}

export function commitFloorClear(state: RunHeatState): boolean {
  if (state.floorClearCommitted) return false;
  state.floorClearCommitted = true;
  state.runHeat = normalizedRunHeat(state.runHeat) + 1;
  return true;
}
