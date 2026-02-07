// src/game/systems/progression/outcomeSystem.ts

import type { World } from "../../../engine/world/world";
import type { OutcomeDef } from "./objective";

type OutcomeHandler = (world: World, outcome: OutcomeDef) => void;

const outcomeHandlers: Record<string, OutcomeHandler> = {
    SET_RUN_STATE: (world, outcome) => {
        const state = outcome.payload?.state;
        if (typeof state === "string") {
            world.runState = state as typeof world.runState;
        }
    },
    SET_GAME_STATE: (world, outcome) => {
        const state = outcome.payload?.state;
        if (typeof state === "string") {
            world.state = state as typeof world.state;
        }
    },
};

function applyOutcome(world: World, outcome: OutcomeDef) {
    const handler = outcomeHandlers[outcome.id];
    if (!handler) return;
    handler(world, outcome);
}

/** Apply outcomes for resolved objectives. */
export function outcomeSystem(world: World): void {
    if (world.objectiveEvents.length === 0) return;

    for (let i = 0; i < world.objectiveEvents.length; i++) {
        const ev = world.objectiveEvents[i];
        for (let j = 0; j < ev.outcomes.length; j++) {
            applyOutcome(world, ev.outcomes[j]);
        }
    }

    world.objectiveEvents.length = 0;
}
