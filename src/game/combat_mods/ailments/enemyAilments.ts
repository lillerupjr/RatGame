import {
  AILMENT_DURATIONS,
  AILMENT_STACK_CAP,
  AILMENT_TICK_INTERVAL_SEC,
  type AilmentInstance,
} from "./ailmentTypes";

export interface EnemyAilmentsState {
  poison: AilmentInstance[]; // stacked
  bleed: AilmentInstance[]; // stacked
  ignite: AilmentInstance[]; // stacked
  bleedVfxAlive?: boolean;
  poisonVfxAlive?: boolean;
  burningVfxAlive?: boolean;
}

export interface AilmentApplyOptions {
  durationMult?: number;
}

export function createEnemyAilmentsState(): EnemyAilmentsState {
  return { poison: [], bleed: [], ignite: [] };
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

function normalizeIgniteState(state: EnemyAilmentsState): AilmentInstance[] {
  const raw = (state as any).ignite;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    state.ignite = [raw as AilmentInstance];
    return state.ignite;
  }
  state.ignite = [];
  return state.ignite;
}

function insertIgniteStack(state: EnemyAilmentsState, ignite: AilmentInstance): void {
  const stacks = normalizeIgniteState(state);
  if (stacks.length < AILMENT_STACK_CAP) {
    stacks.push(ignite);
    return;
  }

  let weakestIndex = 0;
  let weakestDps = stacks[0]?.dps ?? Number.POSITIVE_INFINITY;
  for (let i = 1; i < stacks.length; i++) {
    const dps = stacks[i]?.dps ?? Number.POSITIVE_INFINITY;
    if (dps < weakestDps) {
      weakestDps = dps;
      weakestIndex = i;
    }
  }

  if (ignite.dps >= weakestDps) stacks[weakestIndex] = ignite;
}

export function applyIgniteStacked(state: EnemyAilmentsState, totalDamage: number, options?: AilmentApplyOptions): void {
  if (totalDamage <= 0) return;
  const durationMult = Math.max(0, options?.durationMult ?? 1);
  const dur = AILMENT_DURATIONS.ignite * durationMult;
  const dps = dpsFromDamageBudget(totalDamage, dur);
  insertIgniteStack(state, { kind: "ignite", dps, tLeft: dur });
}

/** Adds one ignite stack from explicit snapshot values. */
export function addIgniteFromSnapshot(
  state: EnemyAilmentsState,
  ignite: AilmentInstance,
): void {
  const dps = Math.max(0, ignite.dps ?? 0);
  const tLeft = Math.max(0, ignite.tLeft ?? 0);
  if (!(dps > 0) || !(tLeft > 0)) return;

  insertIgniteStack(state, { kind: "ignite", dps, tLeft });
}

export function addIgniteStacksFromSnapshots(
  state: EnemyAilmentsState,
  igniteStacks: AilmentInstance[],
): void {
  const stacks = Array.isArray(igniteStacks) ? igniteStacks : [];
  for (let i = 0; i < stacks.length; i++) {
    addIgniteFromSnapshot(state, stacks[i]);
  }
}

/** Tick down timers and prune expired stacks */
export function tickEnemyAilments(state: EnemyAilmentsState, dt: number): void {
  const ignite = normalizeIgniteState(state);
  for (const s of state.poison) s.tLeft -= dt;
  for (const s of state.bleed) s.tLeft -= dt;
  for (const s of ignite) s.tLeft -= dt;

  state.poison = state.poison.filter((s) => s.tLeft > 0);
  state.bleed = state.bleed.filter((s) => s.tLeft > 0);
  state.ignite = ignite.filter((s) => s.tLeft > 0);
}
