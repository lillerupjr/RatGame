// src/game/map/tableMapTypes.ts
export type TableToken = string;

export type TableMapCell = {
    x: number;  // column index in the Excel selection
    y: number;  // row index in the Excel selection
    t: TableToken;
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
};
