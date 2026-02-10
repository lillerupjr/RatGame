// src/game/map/tableMapTypes.ts
import type { MapSkinBundle, MapSkinId } from "../../../content/mapSkins";

export type TableToken = string;

export type TableMapCell = {
    x: number;  // column index in the Excel selection
    y: number;  // row index in the Excel selection
    // Legacy token format (e.g., "F0|W2E"); kept for backward compatibility.
    t?: TableToken;
    // Structured cell format (preferred).
    z?: number;
    type?: string;
    sprite?: string;
    blocksMove?: boolean;
    blocksSight?: boolean;
    meta?: Record<string, unknown>;
    tags?: string[];
    triggerId?: string;
    triggerType?: string;
    radius?: number;
};

export type SemanticStampType = "building" | "road" | "sidewalk" | "park" | "sea";

export type SemanticStamp = {
    x: number;
    y: number;
    z?: number;
    type: SemanticStampType;
    w?: number;
    h?: number;
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

    // Size of the selected region in Excel grid units (for centering/origin).
    w: number;
    h: number;

    // Optional: map skin ID from MAP_SKINS registry
    mapSkinId?: MapSkinId;
    // Optional: default floor skin (legacy identifier)
    defaultFloorSkin?: string;
    defaultSpawnSkin?: string;
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
