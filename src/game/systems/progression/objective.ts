// src/game/systems/progression/objective.ts

import type { World } from "../../../engine/world/world";
import type { TriggerSignal } from "../../triggers/triggerSignals";
import { objectiveSpecToObjectiveDefs, type ObjectiveSpec } from "./objectiveSpec";

export type OutcomeDef = {
    id: string;
    payload?: Record<string, unknown>;
};

export type ObjectiveRule =
    | {
    type: "SIGNAL_COUNT";
    count: number;
    signalType?: TriggerSignal["type"];
};

export type ObjectiveDef = {
    id: string;
    listensTo: string[];
    completionRule: ObjectiveRule;
    outcomes: OutcomeDef[];
};

export type ObjectiveStatus = "IDLE" | "ACTIVE" | "COMPLETED" | "FAILED";

export type ObjectiveProgress = {
    signalCount: number;
};

export type ObjectiveState = {
    id: string;
    status: ObjectiveStatus;
    progress: ObjectiveProgress;
};

export type ObjectiveEvent = {
    type: "OBJECTIVE_RESOLVED";
    objectiveId: string;
    status: "COMPLETED" | "FAILED";
    outcomes: OutcomeDef[];
};

export type ObjectiveInitFloorContext = {
    floorId?: string;
    floorIndex?: number;
    objectiveSpec?: ObjectiveSpec | null;
    objectiveDefs?: ObjectiveDef[] | null;
};

function normalizedRequiredCount(def: ObjectiveDef): number {
    if (def.completionRule.type !== "SIGNAL_COUNT") return 1;
    const raw = Math.floor(def.completionRule.count);
    if (!Number.isFinite(raw) || raw <= 0) return 1;
    return raw;
}

function sanitizeObjectiveDefs(defs: ObjectiveDef[]): ObjectiveDef[] {
    const out: ObjectiveDef[] = [];
    for (let i = 0; i < defs.length; i++) {
        const def = defs[i];
        if (!def || typeof def !== "object") continue;
        if (def.completionRule.type !== "SIGNAL_COUNT") {
            out.push(def);
            continue;
        }
        const required = normalizedRequiredCount(def);
        out.push({
            ...def,
            completionRule: {
                ...def.completionRule,
                count: required,
            },
        });
    }
    return out;
}

/** Create a runtime state for an objective definition. */
export function createObjectiveState(def: ObjectiveDef): ObjectiveState {
    return {
        id: def.id,
        status: "IDLE",
        progress: {
            signalCount: 0,
        },
    };
}

/** Apply trigger signals to an objective state without mutating world state. */
export function applySignalsToObjective(
    def: ObjectiveDef,
    state: ObjectiveState,
    signals: TriggerSignal[]
): ObjectiveState {
    if (state.status === "COMPLETED" || state.status === "FAILED") return state;

    const nextState: ObjectiveState = {
        ...state,
        status: state.status === "IDLE" ? "ACTIVE" : state.status,
        progress: { ...state.progress },
    };

    const relevantSignals = signals.filter((signal) => def.listensTo.includes(signal.triggerId));

    switch (def.completionRule.type) {
        case "SIGNAL_COUNT": {
            const required = normalizedRequiredCount(def);
            const countSignals = def.completionRule.signalType
                ? relevantSignals.filter((signal) => signal.type === def.completionRule.signalType)
                : relevantSignals;
            if (def.completionRule.signalType === "TICK") {
                let total = 0;
                for (const signal of countSignals) total += signal.type === "TICK" ? signal.dt : 0;
                nextState.progress.signalCount += total;
            } else {
                nextState.progress.signalCount += countSignals.length;
            }
            if (nextState.progress.signalCount >= required) {
                nextState.status = "COMPLETED";
            }
            break;
        }
    }

    return nextState;
}

/** Initialize objectives for the world. */
export function setObjectives(world: World, defs: ObjectiveDef[]): void {
    const sanitized = sanitizeObjectiveDefs(Array.isArray(defs) ? defs : []);
    world.objectiveDefs = sanitized;
    world.objectiveStates = sanitized.map((def) => createObjectiveState(def));
    world.objectiveEvents.length = 0;
}

export function setObjectivesFromSpec(world: World, spec: ObjectiveSpec): void {
    setObjectives(world, objectiveSpecToObjectiveDefs(spec));
}

export function resetObjectiveRuntime(world: World): void {
    world.objectiveDefs = [];
    world.objectiveStates = [];
    world.objectiveEvents.length = 0;
}

export function initObjectivesForFloor(world: World, floorCtx: ObjectiveInitFloorContext): void {
    const floorId =
        floorCtx.floorId
        ?? `${floorCtx.floorIndex ?? world.floorIndex ?? 0}:${world.floorArchetype ?? "UNKNOWN"}`;
    const defsFromCtx = floorCtx.objectiveDefs;
    const defs = Array.isArray(defsFromCtx)
        ? defsFromCtx
        : floorCtx.objectiveSpec
            ? objectiveSpecToObjectiveDefs(floorCtx.objectiveSpec)
            : [];

    setObjectives(world, defs);

    if (world.objectiveDefs.length === 0) {
        console.debug(`[objectives:init] floorId=${floorId} objectiveId=none required=0 progress=0`);
        return;
    }

    for (let i = 0; i < world.objectiveDefs.length; i++) {
        const def = world.objectiveDefs[i];
        const state = world.objectiveStates[i];
        const required = normalizedRequiredCount(def);
        const progress = state?.progress?.signalCount ?? 0;
        console.debug(
            `[objectives:init] floorId=${floorId} objectiveId=${def.id} required=${required} progress=${progress}`,
        );
    }
}

export function hasCompletedAnyObjective(world: World): boolean {
    for (let i = 0; i < world.objectiveStates.length; i++) {
        if (world.objectiveStates[i]?.status === "COMPLETED") return true;
    }
    return false;
}

/** Process trigger signals and emit objective resolution events. */
export function objectiveSystem(world: World): void {
    if (world.objectiveDefs.length === 0) return;
    const frameNo = (((world as any).__objectiveFrameNo ?? 0) + 1);
    (world as any).__objectiveFrameNo = frameNo;

    const signals = world.triggerSignals;
    const nextStates: ObjectiveState[] = [];

    for (let i = 0; i < world.objectiveDefs.length; i++) {
        const def = world.objectiveDefs[i];
        const state = world.objectiveStates[i] ?? createObjectiveState(def);
        const updated = applySignalsToObjective(def, state, signals);
        nextStates.push(updated);

        if (state.status !== updated.status && (updated.status === "COMPLETED" || updated.status === "FAILED")) {
            world.objectiveEvents.push({
                type: "OBJECTIVE_RESOLVED",
                objectiveId: def.id,
                status: updated.status,
                outcomes: def.outcomes,
            });
            if (updated.status === "COMPLETED") {
                const floorId =
                    (world.currentFloorIntent?.nodeId as string | undefined)
                    ?? `${world.floorIndex}:${world.floorArchetype}`;
                const required = normalizedRequiredCount(def);
                const progress = updated.progress?.signalCount ?? 0;
                console.debug(
                    `[objectives:complete] floorId=${floorId} objectiveId=${def.id} required=${required} progress=${progress} frame=${frameNo}`,
                );
            }
        }
    }

    world.objectiveStates = nextStates;
}
