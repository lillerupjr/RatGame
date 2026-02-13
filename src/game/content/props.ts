export type PropId = string;

export type PropDef = {
    id: PropId;
    w: number;
    h: number;
    sprite: string;
    anchorLiftUnits?: number;
    anchorOffsetPx?: { x: number; y: number };
};

export const PROPS: Record<PropId, PropDef> = {
    boat1: {
        id: "boat1",
        w: 3,
        h: 2,
        sprite: "props/boats/boat1_e",
        anchorLiftUnits: 0,
        anchorOffsetPx: { x: 0, y: 0 },
    },
    boat2: {
        id: "boat2",
        w: 3,
        h: 2,
        sprite: "props/boats/boat2_e",
        anchorLiftUnits: 0,
        anchorOffsetPx: { x: 0, y: 0 },
    },
    boat3: {
        id: "boat3",
        w: 2,
        h: 3,
        sprite: "props/boats/boat1_s",
        anchorLiftUnits: 0,
        anchorOffsetPx: { x: 0, y: 0 },
    },
    boat4: {
        id: "boat4",
        w: 2,
        h: 3,
        sprite: "props/boats/boat2_s",
        anchorLiftUnits: 0,
        anchorOffsetPx: { x: 0, y: 0 },
    },
    testBuilding1: {
        id: "testBuilding1",
        w: 3,
        h: 2,
        sprite: "structures/buildings/test/test1",
        anchorLiftUnits: -2,
        anchorOffsetPx: { x: -3, y: 0 },
    },
    testBuilding2: {
        id: "testBuilding2",
        w: 3,
        h: 2,
        sprite: "structures/buildings/test/test2",
        anchorLiftUnits: 0,
        anchorOffsetPx: { x: 0, y: 0 },
    },
    testBuilding3: {
        id: "testBuilding3",
        w: 3,
        h: 2,
        sprite: "structures/buildings/test/test3",
        anchorLiftUnits: 0,
        anchorOffsetPx: { x: 0, y: 0 },
    },

};

export function requireProp(id: PropId, context: string): PropDef {
    const prop = PROPS[id];
    if (!prop) {
        throw new Error(`Prop selection: unknown Prop id "${id}" (${context}).`);
    }
    return prop;
}
