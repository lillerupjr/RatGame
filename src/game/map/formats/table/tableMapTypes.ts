// src/game/map/tableMapTypes.ts
import type { MapSkinBundle, MapSkinId } from "../../../content/mapSkins";
import type { BuildingPackId } from "../../../content/buildings";

export type TableMapCell = {
    x: number;  // column index in the Excel selection (tile +x / east)
    y: number;  // row index in the Excel selection (tile +y / south)
    z?: number;
    type?:
      | "floor"
      | "stairs"
      | "spawn"
      | "goal"
      | "wall"
      | "void"
      | "water"
      | "ocean"
      | "road"
      | "sidewalk"
      | "asphalt"
      | "interact_shop"
      | "interact_rest"
      | "npc_vendor"
      | "npc_healer";
    sprite?: string;
    blocksMove?: boolean;
    blocksSight?: boolean;
    dir?: "N" | "E" | "S" | "W";
    height?: number;
    zone?: string;
    tags?: string[];
    triggerId?: string;
    triggerType?: string;
    radius?: number;
};

export type SemanticStampType =
    | "building"
    | "container"
    | "prop"
    | "road"
    | "asphalt"
    | "sidewalk"
    | "park"
    | "sea"
    | "boss_room"
    | "fence"
    | "lamp_post";

export type SemanticStamp = {
    x: number;
    y: number;
    z?: number;
    zVisualOffsetUnits?: number;
    type: SemanticStampType;
    w?: number;
    h?: number;
    skinId?: string;
    pool?: string[];
    heightUnitsMin?: number;
    heightUnitsMax?: number;
    stackChance?: number;
    propId?: string;
    dir?: string;
    layout?: "perimeter_outward";
    semantic?: string;
    startHeight?: number;
    targetHeight?: number;
    collision?: "BLOCK" | "PASS";
    blocksMovement?: boolean;
    flipped?: boolean;
    stackLevel?: number;
    zStackUnits?: number;
};

export type TableObjectiveRule =
    | {
    type: "SIGNAL_COUNT";
    count: number;
    signalType?: "ENTER" | "EXIT" | "KILL" | "TICK" | "INTERACT";
};

export type TableOutcomeDef = {
    id: string;
    payload?: Record<string, unknown>;
};

export type TableObjectiveDef = {
    id: string;
    listensTo: string[];
    completionRule: TableObjectiveRule;
    outcomes: TableOutcomeDef[];
};

export type ApronBaseMode = "PLATEAU" | "ISLANDS";
export type TableMapLightShape = "RADIAL" | "STREET_LAMP";
export type TableMapLightColorMode = "off" | "standard" | "palette";
export type TableMapLightStrength = "low" | "medium" | "high";
export type TableMapLightSemanticType =
    | "street_lamp_n"
    | "street_lamp_e"
    | "street_lamp_s"
    | "street_lamp_w"
    | "neon_sign_pink"
    | "neon_sign_blue"
    | "neon_sign_green";
export type TableMapLightFlicker =
    | { kind: "NONE" }
    | { kind: "NOISE"; speed?: number; amount?: number }
    | { kind: "PULSE"; speed?: number; amount?: number };
export type TableMapLight = {
    x: number;
    y: number;
    heightUnits?: number;
    poolHeightOffsetUnits?: number;
    radiusPx: number;
    intensity: number;
    colorMode?: TableMapLightColorMode;
    strength?: TableMapLightStrength;
    color?: string;
    tintStrength?: number;
    shape?: TableMapLightShape;
    semanticType?: TableMapLightSemanticType;
    flicker?: TableMapLightFlicker;
    pool?: {
        radiusPx: number;
        yScale?: number;
    };
    cone?: {
        dirRad: number;
        angleRad: number;
        lengthPx: number;
    };
};

export type TableMapDef = {
    id: string;

    // Size of the selected region: w = columns (+x), h = rows (+y).
    w: number;
    h: number;

    // Optional: map skin ID from MAP_SKINS registry
    mapSkinId?: MapSkinId;
    // Optional: building pack used by semantic building areas
    buildingPackId?: BuildingPackId;
    // Optional: map-level sprite defaults for the tile skin pipeline
    mapSkinDefaults?: MapSkinBundle;
    // Optional: place the selection so its center ends up at tile (0,0)
    centerOnZero?: boolean;
    // Optional: how far aprons extend down (plateau uses min height; islands extend to 0)
    apronBaseMode?: ApronBaseMode;

    // Sparse placed cells (everything else is VOID)
    cells: TableMapCell[];

    // Optional semantic stamps (v2 pipeline)
    stamps?: SemanticStamp[];
    // Optional semantic road rectangles preserved from authored fields/stamps for compile-time debug derivations.
    roadSemanticRects?: Array<{
        x: number;
        y: number;
        z?: number;
        w: number;
        h: number;
        semantic?: string;
        dir?: "N" | "E" | "S" | "W";
        startHeight?: number;
        targetHeight?: number;
    }>;
    // Optional map-authored static lights (tile-space anchors).
    lights?: TableMapLight[];

    // Optional data-driven objectives attached to this map.
    objectiveDefs?: TableObjectiveDef[];
};
