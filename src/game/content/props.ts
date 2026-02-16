import { type Dir8 } from "../../engine/render/sprites/dir8";

export type PropId = string;

export type PropDef = {
    id: PropId;
    w: number;
    h: number;
    isFlippable: boolean;
    defaultFacing?: "E" | "S";
    flipMode?: "H";
    sprite: string;
    /** Base path for 8-directional sprites. Direction suffix (_N, _NE, etc.) will be appended. */
    spriteDir8?: string;
    defaultDir8?: Dir8;
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
    hooker1: {
        id: "hooker1",
        w: 1,
        h: 1,
        isFlippable: false,
        sprite: "props/hooker/1/crimson_lace_corset_on_a_bed_S",
        spriteDir8: "props/hooker/1/crimson_lace_corset_on_a_bed",
        defaultDir8: "S",
        anchorLiftUnits: 0,
        anchorOffsetPx: { x: 0, y: 0 },
    },
    hooker2: {
        id: "hooker2",
        w: 1,
        h: 1,
        isFlippable: false,
        sprite: "props/hooker/2/edge_of_elegance_S",
        spriteDir8: "props/hooker/2/edge_of_elegance",
        defaultDir8: "S",
        anchorLiftUnits: 0,
        anchorOffsetPx: { x: 0, y: 0 },
    },
    hooker3: {
        id: "hooker3",
        w: 1,
        h: 1,
        isFlippable: false,
        sprite: "props/hooker/3/midnight_officer_S",
        spriteDir8: "props/hooker/3/midnight_officer",
        defaultDir8: "S",
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

/** Resolves the sprite path for a prop, considering direction if spriteDir8 is defined */
export function resolvePropSprite(prop: PropDef, dir?: Dir8): string {
    if (prop.spriteDir8 && dir) {
        return `${prop.spriteDir8}_${dir}`;
    }
    if (prop.spriteDir8 && prop.defaultDir8) {
        return `${prop.spriteDir8}_${prop.defaultDir8}`;
    }
    return prop.sprite;
}

