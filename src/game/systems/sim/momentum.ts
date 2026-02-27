import type { World } from "../../../engine/world/world";
import { restoreArmor } from "./playerArmor";
import type { GameEvent } from "../../events";

export const MOMENTUM_IDLE_RESET_DELAY = 2.0;
export const MOMENTUM_DECAY_PER_SEC = 3.0;
export const MOMENTUM_GAIN_CAP_PER_HIT = 0.5;
export const MOMENTUM_KILL_BONUS = 0.75;
export const MOMENTUM_GLOBAL_CAP = 20;
const MOMENTUM_PROC_POWER_CAP = 20;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function finiteOr(v: number | undefined, fallback: number): number {
  return Number.isFinite(v) ? (v as number) : fallback;
}

function momentumCap(world: World): number {
  return Math.max(0, finiteOr(world.momentumMax, MOMENTUM_GLOBAL_CAP));
}

function pushMomentumEvent(world: World, event: GameEvent): void {
  world.eventQueue.push(event);
}

function updateFullMomentumTransitions(world: World): void {
  const cap = momentumCap(world);
  const clamped = Math.max(0, Math.min(cap, finiteOr(world.momentumValue, 0)));
  world.momentumValue = clamped;

  const wasFull = !!world.momentumWasFull;
  const isFull = cap > 0 && clamped >= cap;
  if (!wasFull && isFull) {
    pushMomentumEvent(world, { type: "FULL_MOMENTUM_REACHED" });
  } else if (wasFull && !isFull) {
    pushMomentumEvent(world, { type: "FULL_MOMENTUM_LOST" });
  }
  world.momentumWasFull = isFull;
}

export function getMomentumIdleResetDelay(world: World): number {
  const base = MOMENTUM_IDLE_RESET_DELAY;
  const bonus = world.relics.includes("MOM_DECAY_DELAY_PLUS_1") ? 1.0 : 0.0;
  return base + bonus;
}

export function addMomentumFromDamage(world: World, damageDealt: number, enemyMaxLife: number, now: number): void {
  const dealt = Math.max(0, finiteOr(damageDealt, 0));
  const maxLife = Math.max(1, finiteOr(enemyMaxLife, 1));
  const gain = clamp(dealt / maxLife, 0, MOMENTUM_GAIN_CAP_PER_HIT);
  if (gain <= 0) return;
  const current = Math.max(0, finiteOr(world.momentumValue, 0));
  const next = Math.min(momentumCap(world), current + gain);
  if (next === current) return;
  world.momentumValue = next;
  world.momentumLastGainTime = finiteOr(now, 0);
  updateFullMomentumTransitions(world);
}

export function addMomentumOnKill(world: World, now: number): void {
  const current = Math.max(0, finiteOr(world.momentumValue, 0));
  const next = Math.min(momentumCap(world), current + MOMENTUM_KILL_BONUS);
  if (next === current) return;
  world.momentumValue = next;
  world.momentumLastGainTime = finiteOr(now, 0);
  updateFullMomentumTransitions(world);
}

export function resetMomentumOnLifeDamage(world: World, now: number): void {
  world.momentumValue = 0;
  world.momentumLastGainTime = finiteOr(now, 0);
}

export function breakMomentumOnLifeDamage(world: World, now: number): void {
  const current = Math.max(0, finiteOr(world.momentumValue, 0));
  const hadMomentum = current > 0;
  if (!hadMomentum) return;
  const wasFull = current >= momentumCap(world);
  world.momentumValue = 0;
  world.momentumLastGainTime = finiteOr(now, 0);
  pushMomentumEvent(world, { type: "MOMENTUM_BREAK", wasFull });
  updateFullMomentumTransitions(world);
}

export function relicTriggerMomentumDamageMultiplier(world: World): number {
  if (!world.relics.includes("MOM_PROC_POWER_SCALING_2P")) return 1;
  const m = Math.max(0, Math.min(MOMENTUM_PROC_POWER_CAP, finiteOr(world.momentumValue, 0)));
  return 1 + 0.02 * m;
}

export function tickMomentumDecay(world: World, dt: number, now: number): void {
  const delta = Math.max(0, finiteOr(dt, 0));
  if (delta <= 0) return;
  const tNow = finiteOr(now, 0);
  const lastGain = finiteOr(world.momentumLastGainTime, 0);
  const idleDelay = getMomentumIdleResetDelay(world);
  if (tNow - lastGain <= idleDelay) return;
  const current = Math.max(0, finiteOr(world.momentumValue, 0));
  if (current <= 0) return;
  const next = Math.max(0, current - MOMENTUM_DECAY_PER_SEC * delta);
  world.momentumValue = next;
  if (next <= 0) {
    pushMomentumEvent(world, { type: "MOMENTUM_DECAYED" });
  }
  updateFullMomentumTransitions(world);
}

export function processMomentumEventQueue(world: World): void {
  if (!Array.isArray(world.eventQueue) || world.eventQueue.length === 0) return;
  const hasBreakArmorRelic = world.relics.includes("MOM_FULL_BREAK_GRANTS_ARMOR_20");
  const hasFullCritRelic = world.relics.includes("MOM_FULL_CRIT_DOUBLE");
  if (!hasFullCritRelic) world.fullMomentumActive = false;

  for (let i = 0; i < world.eventQueue.length; i++) {
    const ev = world.eventQueue[i];
    if (ev.type === "MOMENTUM_BREAK" && ev.wasFull && hasBreakArmorRelic) {
      restoreArmor(world, 20);
      continue;
    }
    if (!hasFullCritRelic) continue;
    if (ev.type === "FULL_MOMENTUM_REACHED") {
      world.fullMomentumActive = true;
      continue;
    }
    if (ev.type === "FULL_MOMENTUM_LOST") {
      world.fullMomentumActive = false;
    }
  }
  world.eventQueue.length = 0;
}
