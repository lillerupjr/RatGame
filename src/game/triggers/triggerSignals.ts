// src/game/triggers/triggerSignals.ts

export type EntityId = number;

export type TriggerSignal =
    | { type: "ENTER"; entityId: EntityId; triggerId: string }
    | { type: "EXIT"; entityId: EntityId; triggerId: string }
    | { type: "KILL"; entityId: EntityId; triggerId: string }
    | { type: "TICK"; dt: number; triggerId: string }
    | { type: "INTERACT"; entityId: EntityId; triggerId: string };
