// src/game/systems/progression/objective.test.ts
// @ts-ignore
import { describe, it, expect } from "vitest";
import { createWorld } from "../../../../engine/world/world";
import { BossId } from "../../../../game/bosses/bossTypes";
import { spawnBossEncounter } from "../../../../game/bosses/spawnBossEncounter";
import { markBossEncounterDefeated } from "../../../../game/bosses/bossRuntime";
import { stageDocks } from "../../../../game/content/stages";
import {
    applySignalsToObjective,
    createObjectiveState,
    initObjectivesForFloor,
    objectiveSystem,
    resetObjectiveRuntime,
    type ObjectiveDef,
} from "../../../../game/systems/progression/objective";
import type { TriggerSignal } from "../../../../game/triggers/triggerSignals";
import { rewardRunEventProducerSystem } from "../../../../game/systems/progression/rewardRunEventProducerSystem";

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

    it("does not auto-complete count=0 objectives and enforces required >= 1", () => {
        const def: ObjectiveDef = {
            id: "bad_count",
            listensTo: ["zone_a"],
            completionRule: { type: "SIGNAL_COUNT", count: 0 },
            outcomes: [],
        };

        const state0 = createObjectiveState(def);
        const state1 = applySignalsToObjective(def, state0, []);
        expect(state1.status).toBe("ACTIVE");
        expect(state1.progress.signalCount).toBe(0);

        const world = {
            objectiveDefs: [],
            objectiveStates: [],
            objectiveEvents: [],
            floorArchetype: "BOSS_TRIPLE",
            floorIndex: 2,
        } as any;
        initObjectivesForFloor(world, {
            floorId: "FLOOR_TEST",
            objectiveDefs: [def],
        });
        expect(world.objectiveDefs[0].completionRule.count).toBe(1);
        expect(world.objectiveStates[0].status).toBe("IDLE");
        expect(world.objectiveStates[0].progress.signalCount).toBe(0);

        world.objectiveEvents.push({
            type: "OBJECTIVE_RESOLVED",
            objectiveId: "bad_count",
            status: "COMPLETED",
            outcomes: [],
        });
        resetObjectiveRuntime(world);
        expect(world.objectiveDefs).toEqual([]);
        expect(world.objectiveStates).toEqual([]);
        expect(world.objectiveEvents).toEqual([]);
    });
});

describe("ACT_BOSS objective tracking", () => {
    it("completes only when the tracked boss encounter is defeated", () => {
        const world = createWorld({ seed: 222, stage: stageDocks });
        world.floorArchetype = "ACT_BOSS";
        world.floorIndex = 0;

        initObjectivesForFloor(world, {
            floorId: "ACT_BOSS_TEST",
            objectiveSpec: {
                objectiveType: "ACT_BOSS",
                params: { bossId: BossId.RAT_KING },
            },
        });

        const spawned = spawnBossEncounter(world, {
            bossId: BossId.RAT_KING,
            spawnWorldX: 128,
            spawnWorldY: 128,
            objectiveId: "OBJ_ACT_BOSS",
        });

        world.events.push({
            type: "ENEMY_KILLED",
            enemyIndex: spawned.enemyIndex + 1,
            x: 0,
            y: 0,
            source: "OTHER",
        } as any);

        objectiveSystem(world);
        expect(world.objectiveStates[0]?.status).toBe("ACTIVE");
        expect(world.objectiveStates[0]?.progress.signalCount).toBe(0);

        markBossEncounterDefeated(world, spawned.enemyIndex);
        objectiveSystem(world);

        expect(world.objectiveStates[0]?.status).toBe("COMPLETED");
        expect(world.objectiveStates[0]?.progress.signalCount).toBe(1);
        expect(world.objectiveEvents).toHaveLength(1);
        expect(world.objectiveEvents[0]).toMatchObject({
            type: "OBJECTIVE_RESOLVED",
            objectiveId: "OBJ_ACT_BOSS",
            status: "COMPLETED",
        });
    });

    it("emits the objective-completed run event once for ACT_BOSS", () => {
        const world = createWorld({ seed: 223, stage: stageDocks });
        world.floorArchetype = "ACT_BOSS";
        world.floorIndex = 0;

        initObjectivesForFloor(world, {
            floorId: "ACT_BOSS_REWARD_TEST",
            objectiveSpec: {
                objectiveType: "ACT_BOSS",
                params: { bossId: BossId.RAT_KING },
            },
        });

        const spawned = spawnBossEncounter(world, {
            bossId: BossId.RAT_KING,
            spawnWorldX: 96,
            spawnWorldY: 160,
            objectiveId: "OBJ_ACT_BOSS",
        });

        markBossEncounterDefeated(world, spawned.enemyIndex);
        objectiveSystem(world);

        rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });
        rewardRunEventProducerSystem(world, { includeCoreFacts: true, includeChest: false });

        expect(
            world.runEvents.filter((event) =>
                event.type === "OBJECTIVE_COMPLETED" && event.objectiveId === "OBJ_ACT_BOSS"
            )
        ).toHaveLength(1);
    });
});
