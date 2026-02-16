export type PropId = string;

export type PropDef = {
    id: PropId;
    w: number;
    h: number;
    isFlippable: boolean;
    defaultFacing?: "E" | "S";
    flipMode?: "H";
    sprite: string;
    anchorLiftUnits?: number;
    lightHeightOffsetUnits?: number;
    lightPoolHeightOffsetUnits?: number;
    lightScreenOffsetPx?: { x: number; y: number };
    anchorOffsetPx?: { x: number; y: number };
};

export const PROPS: Record<PropId, PropDef> = {
    boat1: {
        id: "boat1",
        w: 3,
        h: 2,
        isFlippable: true,
        defaultFacing: "E",
        flipMode: "H",
        sprite: "props/boats/boat1_e",
        anchorLiftUnits: 0,
        anchorOffsetPx: { x: 0, y: 0 },
    },
    boat2: {
        id: "boat2",
        w: 3,
        h: 2,
        isFlippable: true,
        defaultFacing: "E",
        flipMode: "H",
        sprite: "props/boats/boat2_e",
        anchorLiftUnits: 0,
        anchorOffsetPx: { x: 0, y: 0 },
    },
    boat3: {
        id: "boat3",
        w: 2,
        h: 3,
        isFlippable: true,
        defaultFacing: "S",
        flipMode: "H",
        sprite: "props/boats/boat1_s",
        anchorLiftUnits: 0,
        anchorOffsetPx: { x: 0, y: 0 },
    },
    boat4: {
        id: "boat4",
        w: 2,
        h: 3,
        isFlippable: true,
        defaultFacing: "S",
        flipMode: "H",
        sprite: "props/boats/boat2_s",
        anchorLiftUnits: 0,
        anchorOffsetPx: { x: 0, y: 0 },
    },
    street_lamp_e: {
        id: "street_lamp_e",
        w: 1,
        h: 1,
        isFlippable: false,
        sprite: "props/lights/street_lamp_e",
        anchorLiftUnits: -2,
        lightHeightOffsetUnits: 12,
        lightPoolHeightOffsetUnits: -12,
        lightScreenOffsetPx: { x: 24, y: 32 },
        anchorOffsetPx: { x: 16, y: 64 },
    },
    street_lamp_s: {
        id: "street_lamp_s",
        w: 1,
        h: 1,
        isFlippable: false,
        sprite: "props/lights/street_lamp_s",
        anchorLiftUnits: -2,
        lightHeightOffsetUnits: 12,
        lightPoolHeightOffsetUnits: -12,
        lightScreenOffsetPx: { x: -24, y: 16 },
        anchorOffsetPx: { x: -16, y: 64 },
    },
    street_lamp_w: {
        id: "street_lamp_w",
        w: 1,
        h: 1,
        isFlippable: false,
        sprite: "props/lights/street_lamp_w",
        anchorLiftUnits: -2,
        lightHeightOffsetUnits: 12,
        lightPoolHeightOffsetUnits: -12,
        lightScreenOffsetPx: { x: -32, y: 0 },
        anchorOffsetPx: { x: -16, y: 64 },
    },
    street_lamp_n: {
        id: "street_lamp_n",
        w: 1,
        h: 1,
        isFlippable: false,
        sprite: "props/lights/street_lamp_n",
        anchorLiftUnits: -2,
        lightHeightOffsetUnits: 12,
        lightPoolHeightOffsetUnits: -12,
        lightScreenOffsetPx: { x: 32, y: 0 },
        anchorOffsetPx: { x: 16, y: 64 },
    },
    midnight_officer: {
        id: "midnight_officer",
        w: 1,
        h: 1,
        isFlippable: true,
        defaultFacing: "S",
        flipMode: "H",
        sprite: "props/hooker/midnight_officer_SE",
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
