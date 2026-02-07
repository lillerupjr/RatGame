// src/game/triggers/triggerTypes.ts

export type TriggerType = string;

export type TriggerDef = {
    id: string;
    type: TriggerType;
    tx: number;
    ty: number;
    radius?: number;
};

export type TriggerBookkeeping = {
    insideEntityIds: number[];
};

export type TriggerInstance = {
    id: string;
    type: TriggerType;
    tx: number;
    ty: number;
    radius?: number;
    bookkeeping: TriggerBookkeeping;
};

/** Instantiate triggers with bookkeeping only; no world mutation occurs here. */
export function instantiateTriggers(defs: TriggerDef[]): TriggerInstance[] {
    return defs.map((def) => ({
        id: def.id,
        type: def.type,
        tx: def.tx,
        ty: def.ty,
        radius: def.radius,
        bookkeeping: {
            insideEntityIds: [],
        },
    }));
}
