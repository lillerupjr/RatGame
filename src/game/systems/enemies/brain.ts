import type { World } from "../../../engine/world/world";
import { EnemyId, type EnemyDefinition } from "../../content/enemies";
import { registry } from "../../content/registry";

export type EnemyBehaviorState =
  | "idle"
  | "move"
  | "windup"
  | "acting"
  | "cooldown"
  | "dead";

export type EnemyBrainState = {
  state: EnemyBehaviorState;
  stateTimeSec: number;
  cooldownLeftSec: number;
  windupLeftSec: number;
  leapDirX: number;
  leapDirY: number;
  leapTimeLeftSec: number;
  leapHitDone: boolean;
};

function defaultEnemyState(archetype: EnemyDefinition): EnemyBehaviorState {
  return archetype.movement.mode === "scripted" ? "idle" : "move";
}

function createDefaultBrainState(archetype: EnemyDefinition): EnemyBrainState {
  return {
    state: defaultEnemyState(archetype),
    stateTimeSec: 0,
    cooldownLeftSec: 0,
    windupLeftSec: 0,
    leapDirX: 0,
    leapDirY: 0,
    leapTimeLeftSec: 0,
    leapHitDone: false,
  };
}

export function createEnemyBrainState(archetype: EnemyDefinition): EnemyBrainState {
  return createDefaultBrainState(archetype);
}

function normalizeEnemyBrainState(brain: EnemyBrainState, archetype: EnemyDefinition): EnemyBrainState {
  brain.state = (brain.state ?? defaultEnemyState(archetype)) as EnemyBehaviorState;
  brain.stateTimeSec = Number.isFinite(brain.stateTimeSec) ? brain.stateTimeSec : 0;
  brain.cooldownLeftSec = Number.isFinite(brain.cooldownLeftSec) ? Math.max(0, brain.cooldownLeftSec) : 0;
  brain.windupLeftSec = Number.isFinite(brain.windupLeftSec) ? Math.max(0, brain.windupLeftSec) : 0;
  brain.leapDirX = Number.isFinite(brain.leapDirX) ? brain.leapDirX : 0;
  brain.leapDirY = Number.isFinite(brain.leapDirY) ? brain.leapDirY : 0;
  brain.leapTimeLeftSec = Number.isFinite(brain.leapTimeLeftSec) ? Math.max(0, brain.leapTimeLeftSec) : 0;
  brain.leapHitDone = !!brain.leapHitDone;
  return brain;
}

export function resetEnemyBrain(w: World, enemyIndex: number, enemyType?: EnemyId): EnemyBrainState {
  const type = enemyType ?? ((w.eType?.[enemyIndex] ?? EnemyId.MINION) as EnemyId);
  const archetype = registry.enemy(type);
  const brain = createDefaultBrainState(archetype);
  if (!w.eBrain) w.eBrain = [];
  w.eBrain[enemyIndex] = brain;
  return brain;
}

export function ensureEnemyBrain(w: World, enemyIndex: number): EnemyBrainState {
  if (!w.eBrain) w.eBrain = [];
  const existing = w.eBrain[enemyIndex];
  if (!existing) return resetEnemyBrain(w, enemyIndex);
  const type = ((w.eType?.[enemyIndex] ?? EnemyId.MINION) as EnemyId);
  return normalizeEnemyBrainState(existing, registry.enemy(type));
}

export function setEnemyBehaviorState(brain: EnemyBrainState, nextState: EnemyBehaviorState): void {
  if (brain.state === nextState) return;
  brain.state = nextState;
  brain.stateTimeSec = 0;
}

export function clearEnemyTransientState(brain: EnemyBrainState): void {
  brain.windupLeftSec = 0;
  brain.leapDirX = 0;
  brain.leapDirY = 0;
  brain.leapTimeLeftSec = 0;
  brain.leapHitDone = false;
}
