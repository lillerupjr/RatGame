import { AILMENT_DURATIONS, AILMENT_STACK_CAP, type AilmentInstance } from "./ailmentTypes";

export interface EnemyAilmentsState {
  poison: AilmentInstance[]; // stacked
  bleed: AilmentInstance[]; // stacked
  ignite: AilmentInstance | null; // strongest only
}

export function createEnemyAilmentsState(): EnemyAilmentsState {
  return { poison: [], bleed: [], ignite: null };
}

export function addPoison(state: EnemyAilmentsState, totalDamage: number): void {
  if (totalDamage <= 0) return;
  if (state.poison.length >= AILMENT_STACK_CAP) return;

  const dur = AILMENT_DURATIONS.poison;
  state.poison.push({
    kind: "poison",
    dps: totalDamage / dur,
    tLeft: dur,
  });
}

export function addBleed(state: EnemyAilmentsState, totalDamage: number): void {
  if (totalDamage <= 0) return;
  if (state.bleed.length >= AILMENT_STACK_CAP) return;

  const dur = AILMENT_DURATIONS.bleed;
  state.bleed.push({
    kind: "bleed",
    dps: totalDamage / dur,
    tLeft: dur,
  });
}

/**
 * Ignite: strongest-only
 * - If no ignite exists => set
 * - If new ignite DPS is greater => replace
 * - Else ignore
 */
export function applyIgniteStrongestOnly(state: EnemyAilmentsState, totalDamage: number): void {
  if (totalDamage <= 0) return;
  const dur = AILMENT_DURATIONS.ignite;
  const dps = totalDamage / dur;

  if (!state.ignite || dps > state.ignite.dps) {
    state.ignite = { kind: "ignite", dps, tLeft: dur };
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
