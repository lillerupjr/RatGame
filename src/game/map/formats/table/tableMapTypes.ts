// src/game/map/tableMapTypes.ts
import type { MapSkinBundle, MapSkinId } from "../../../content/mapSkins";

export type TableMapCell = {
    x: number;  // column index in the Excel selection (tile +x / east)
    y: number;  // row index in the Excel selection (tile +y / south)
    z?: number;
    type?: "floor" | "stairs" | "spawn" | "goal" | "wall" | "void" | "road" | "sidewalk";
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

export type SemanticStampType = "building" | "container" | "prop" | "road" | "sidewalk" | "park" | "sea" | "boss_room" | "fence";

export type SemanticStamp = {
    x: number;
    y: number;
    z?: number;
    type: SemanticStampType;
    w?: number;
    h?: number;
    skinId?: string;
    pool?: string[];
    heightUnitsMin?: number;
    heightUnitsMax?: number;
    stackChance?: number;
    propId?: string;
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

export type TableMapDef = {
    id: string;

    // Size of the selected region: w = columns (+x), h = rows (+y).
    w: number;
    h: number;

    // Optional: map skin ID from MAP_SKINS registry
    mapSkinId?: MapSkinId;
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

    // Optional data-driven objectives attached to this map.
    objectiveDefs?: TableObjectiveDef[];
};
