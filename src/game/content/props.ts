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
        sprite: "props/boats/boat1",
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
