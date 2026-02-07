// src/game/map/tableMapTypes.ts
export type TableToken = string;

export type TableMapCell = {
    x: number;  // column index in the Excel selection
    y: number;  // row index in the Excel selection
    t: TableToken;
    triggerId?: string;
    triggerType?: string;
    radius?: number;
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

export type TableMapDef = {
    id: string;

    // Size of the selected region in Excel grid units (for centering/origin).
    w: number;
    h: number;

    // Optional: default floor skin (e.g. "landscape_23")
    defaultFloorSkin?: string;
    defaultSpawnSkin?: string;
    // Optional: place the selection so its center ends up at tile (0,0)
    centerOnZero?: boolean;

    // Sparse placed cells (everything else is VOID)
    cells: TableMapCell[];

    // Optional data-driven objectives attached to this map.
    objectiveDefs?: TableObjectiveDef[];
};
