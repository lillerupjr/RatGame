// src/game/systems/objective.ts
//
// Objective System
// Handles tracking progress toward map objectives (e.g., reaching a destination).

import type { World } from "../world";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";
import { getGoalWorldFromActive, getActiveMap } from "../map/proceduralMapBridge";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ObjectiveType = "REACH_GOAL" | "SURVIVE" | "KILL_BOSS";

export type ObjectiveState = {
    type: ObjectiveType;
    completed: boolean;
    
    // For REACH_GOAL objectives
    goalX: number;
    goalY: number;
    goalZ: number;
    goalRadius: number;  // World units - how close player must get
    
    // Progress tracking
    distanceToGoal: number;
    initialDistance: number;
    progressPercent: number;
    
    // Time tracking
    timeElapsed: number;
    timeLimit: number | null;  // null = no time limit
};

// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────

let _objectiveState: ObjectiveState | null = null;

/**
 * Get the current objective state.
 */
/** Return the current objective state if active. */
export function getObjectiveState(): ObjectiveState | null {
    return _objectiveState;
}

/**
 * Check if the current objective is completed.
 */
/** Return true if the current objective is completed. */
export function isObjectiveCompleted(): boolean {
    return _objectiveState?.completed ?? false;
}

// ─────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────

/**
 * Initialize a "reach goal" objective from the active procedural map.
 * Call this after generating and activating a procedural map.
 */
/** Initialize a reach-goal or survive objective for the active map. */
export function initReachGoalObjective(world: World, timeLimitSeconds: number | null = null): ObjectiveState | null {
    const goal = getGoalWorldFromActive();
    
    if (!goal) {
        // No goal on this map - use SURVIVE objective instead
        _objectiveState = {
            type: "SURVIVE",
            completed: false,
            goalX: 0,
            goalY: 0,
            goalZ: 0,
            goalRadius: 0,
            distanceToGoal: 0,
            initialDistance: 0,
            progressPercent: 0,
            timeElapsed: 0,
            timeLimit: timeLimitSeconds,
        };
        return _objectiveState;
    }
    
    const distanceToGoal = Math.hypot(
        goal.x - world.px,
        goal.y - world.py
    );
    
    _objectiveState = {
        type: "REACH_GOAL",
        completed: false,
        goalX: goal.x,
        goalY: goal.y,
        goalZ: goal.z,
        goalRadius: KENNEY_TILE_WORLD * 1.5, // Must be within 1.5 tiles
        distanceToGoal,
        initialDistance: distanceToGoal,
        progressPercent: 0,
        timeElapsed: 0,
        timeLimit: timeLimitSeconds,
    };
    
    return _objectiveState;
}

/**
 * Initialize a boss fight objective.
 */
/** Initialize a boss objective with an optional time limit. */
export function initBossObjective(timeLimitSeconds: number = 30): ObjectiveState {
    _objectiveState = {
        type: "KILL_BOSS",
        completed: false,
        goalX: 0,
        goalY: 0,
        goalZ: 0,
        goalRadius: 0,
        distanceToGoal: 0,
        initialDistance: 0,
        progressPercent: 0,
        timeElapsed: 0,
        timeLimit: timeLimitSeconds,
    };
    
    return _objectiveState;
}

/**
 * Clear the current objective.
 */
/** Clear the current objective state. */
export function clearObjective(): void {
    _objectiveState = null;
}

// ─────────────────────────────────────────────────────────────
// Update System
// ─────────────────────────────────────────────────────────────

/**
 * Update the objective system each frame.
 * Call this in your main game loop.
 */
/** Update objective progress each frame. */
export function objectiveSystem(world: World, dt: number): void {
    if (!_objectiveState || _objectiveState.completed) return;
    
    // Update time
    _objectiveState.timeElapsed += dt;
    
    switch (_objectiveState.type) {
        case "REACH_GOAL":
            updateReachGoalObjective(world);
            break;
        case "SURVIVE":
            updateSurviveObjective(world);
            break;
        case "KILL_BOSS":
            // Boss completion is handled externally when boss dies
            break;
    }
}

function updateReachGoalObjective(world: World): void {
    if (!_objectiveState) return;
    
    const dx = _objectiveState.goalX - world.px;
    const dy = _objectiveState.goalY - world.py;
    const distance = Math.hypot(dx, dy);
    
    _objectiveState.distanceToGoal = distance;
    
    // Calculate progress (inverse of distance ratio)
    if (_objectiveState.initialDistance > 0) {
        const traveled = _objectiveState.initialDistance - distance;
        _objectiveState.progressPercent = Math.max(0, Math.min(100,
            (traveled / _objectiveState.initialDistance) * 100
        ));
    }
    
    // Check completion
    if (distance <= _objectiveState.goalRadius) {
        _objectiveState.completed = true;
        _objectiveState.progressPercent = 100;
    }
}

function updateSurviveObjective(world: World): void {
    if (!_objectiveState || !_objectiveState.timeLimit) return;
    
    // Progress is time-based
    _objectiveState.progressPercent = Math.min(100,
        (_objectiveState.timeElapsed / _objectiveState.timeLimit) * 100
    );
    
    // Check completion
    if (_objectiveState.timeElapsed >= _objectiveState.timeLimit) {
        _objectiveState.completed = true;
        _objectiveState.progressPercent = 100;
    }
}

/**
 * Mark the boss objective as completed (call when boss dies).
 */
/** Mark the current boss objective as completed. */
export function completeBossObjective(): void {
    if (_objectiveState && _objectiveState.type === "KILL_BOSS") {
        _objectiveState.completed = true;
        _objectiveState.progressPercent = 100;
    }
}

// ─────────────────────────────────────────────────────────────
// Query Functions
// ─────────────────────────────────────────────────────────────

/**
 * Get the direction from player to goal (normalized).
 */
/** Return normalized direction to the goal if one exists. */
export function getDirectionToGoal(world: World): { dx: number; dy: number } | null {
    if (!_objectiveState || _objectiveState.type !== "REACH_GOAL") {
        return null;
    }
    
    const dx = _objectiveState.goalX - world.px;
    const dy = _objectiveState.goalY - world.py;
    const len = Math.hypot(dx, dy);
    
    if (len < 0.001) return { dx: 0, dy: 0 };
    
    return { dx: dx / len, dy: dy / len };
}

/**
 * Get time remaining (for timed objectives).
 */
/** Return remaining time for timed objectives. */
export function getTimeRemaining(): number | null {
    if (!_objectiveState || _objectiveState.timeLimit === null) {
        return null;
    }
    
    return Math.max(0, _objectiveState.timeLimit - _objectiveState.timeElapsed);
}

/**
 * Check if player is close to the goal (for UI hints).
 */
/** Return true if the player is within threshold of the goal. */
export function isNearGoal(world: World, threshold: number = KENNEY_TILE_WORLD * 3): boolean {
    if (!_objectiveState || _objectiveState.type !== "REACH_GOAL") {
        return false;
    }
    
    return _objectiveState.distanceToGoal <= threshold;
}
