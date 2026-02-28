import {
  AILMENT_DURATIONS,
  AILMENT_STACK_CAP,
  AILMENT_TICK_INTERVAL_SEC,
  type AilmentInstance,
} from "./ailmentTypes";

export interface EnemyAilmentsState {
  poison: AilmentInstance[]; // stacked
  bleed: AilmentInstance[]; // stacked
  ignite: AilmentInstance | null; // strongest only
}

export interface AilmentApplyOptions {
  durationMult?: number;
}

export function createEnemyAilmentsState(): EnemyAilmentsState {
  return { poison: [], bleed: [], ignite: null };
}

function dpsFromDamageBudget(totalDamage: number, durationSec: number): number {
  const ticks = Math.max(1, Math.floor((durationSec + 1e-9) / AILMENT_TICK_INTERVAL_SEC));
  const appliedDuration = ticks * AILMENT_TICK_INTERVAL_SEC;
  return totalDamage / appliedDuration;
}

export function addPoison(state: EnemyAilmentsState, totalDamage: number, options?: AilmentApplyOptions): void {
  if (totalDamage <= 0) return;
  if (state.poison.length >= AILMENT_STACK_CAP) return;

  const durationMult = Math.max(0, options?.durationMult ?? 1);
  const dur = AILMENT_DURATIONS.poison * durationMult;
  state.poison.push({
    kind: "poison",
    dps: dpsFromDamageBudget(totalDamage, dur),
    tLeft: dur,
  });
}

export function addBleed(state: EnemyAilmentsState, totalDamage: number): void {
  if (totalDamage <= 0) return;
  if (state.bleed.length >= AILMENT_STACK_CAP) return;

  const dur = AILMENT_DURATIONS.bleed;
  state.bleed.push({
    kind: "bleed",
    dps: dpsFromDamageBudget(totalDamage, dur),
    tLeft: dur,
  });
}

/**
 * Ignite: strongest-only
 * - If no ignite exists => set
 * - If new ignite DPS is greater => replace
 * - Else ignore
 */
export function applyIgniteStrongestOnly(state: EnemyAilmentsState, totalDamage: number, options?: AilmentApplyOptions): void {
  if (totalDamage <= 0) return;
  const durationMult = Math.max(0, options?.durationMult ?? 1);
  const dur = AILMENT_DURATIONS.ignite * durationMult;
  const dps = dpsFromDamageBudget(totalDamage, dur);

  if (!state.ignite || dps > state.ignite.dps) {
    state.ignite = { kind: "ignite", dps, tLeft: dur };
  }
}

/** Ignite strongest-only using explicit ignite snapshot values. */
export function applyIgniteStrongestFromSnapshot(
  state: EnemyAilmentsState,
  ignite: AilmentInstance,
): void {
  const dps = Math.max(0, ignite.dps ?? 0);
  const tLeft = Math.max(0, ignite.tLeft ?? 0);
  if (!(dps > 0) || !(tLeft > 0)) return;
  if (!state.ignite || dps > state.ignite.dps) {
    state.ignite = { kind: "ignite", dps, tLeft };
  }
}

/** Tick down timers and prune expired stacks */
export function tickEnemyAilments(state: EnemyAilmentsState, dt: number): void {
  for (const s of state.poison) s.tLeft -= dt;
  for (const s of state.bleed) s.tLeft -= dt;
  if (state.ignite) state.ignite.tLeft -= dt;

  state.poison = state.poison.filter((s) => s.tLeft > 0);
  state.bleed = state.bleed.filter((s) => s.tLeft > 0);
  if (state.ignite && state.ignite.tLeft <= 0) state.ignite = null;
}
