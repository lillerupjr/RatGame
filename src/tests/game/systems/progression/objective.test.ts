// src/game/systems/progression/objective.test.ts
// @ts-ignore
import { describe, it, expect } from "vitest";
import {
    applySignalsToObjective,
    createObjectiveState,
    type ObjectiveDef,
} from "../../../../game/systems/progression/objective";
import type { TriggerSignal } from "../../../../game/triggers/triggerSignals";

describe("Objective applySignalsToObjective", () => {
    it("tracks signal counts and completes deterministically", () => {
        const def: ObjectiveDef = {
            id: "reach_zone_a",
            listensTo: ["zone_a"],
            completionRule: { type: "SIGNAL_COUNT", count: 2, signalType: "ENTER" },
            outcomes: [],
        };

        const signals: TriggerSignal[] = [
            { type: "ENTER", entityId: 0, triggerId: "zone_a" },
            { type: "EXIT", entityId: 0, triggerId: "zone_a" },
            { type: "ENTER", entityId: 0, triggerId: "zone_a" },
        ];

        const state0 = createObjectiveState(def);
        const state1 = applySignalsToObjective(def, state0, signals);

        expect(state0.status).toBe("IDLE");
        expect(state1.status).toBe("COMPLETED");
        expect(state1.progress.signalCount).toBe(2);

        const state2 = applySignalsToObjective(def, state1, signals);
        expect(state2).toBe(state1);
    });

    it("ignores signals for other triggers", () => {
        const def: ObjectiveDef = {
            id: "reach_zone_a",
            listensTo: ["zone_a"],
            completionRule: { type: "SIGNAL_COUNT", count: 1 },
            outcomes: [],
        };

        const signals: TriggerSignal[] = [
            { type: "ENTER", entityId: 0, triggerId: "zone_b" },
        ];

        const state0 = createObjectiveState(def);
        const state1 = applySignalsToObjective(def, state0, signals);

        expect(state1.status).toBe("ACTIVE");
        expect(state1.progress.signalCount).toBe(0);
    });
});
