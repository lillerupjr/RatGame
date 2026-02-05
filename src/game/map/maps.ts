// src/game/map/maps.ts
import type { TableMapDef } from "./tableMapTypes";


export const EXCEL_SANCTUARY_01: TableMapDef = {
    id: "EXCEL_SANCTUARY_01",
    w: 13,
    h: 15,
    defaultFloorSkin: "edges_landscape_28",
    defaultSpawnSkin: "edges_landscape_30",
    centerOnZero: true,

    // Coordinates are (x,y) inside the Excel selection box, top-left = (0,0).
    // Only non-empty cells are listed (everything else is VOID).
    cells: [
        // Row 0
        { x: 4, y: 0, t: "F0" },

        // Row 1: F0 F0 S0W S1W S2W S3W S4 S5 F5

        { x: 1, y: 5, t: "S1E" },
        { x: 0, y: 5, t: "S2E" },


        { x: 4, y: 1, t: "F0" },
        { x: 5, y: 1, t: "F0" },
        { x: 6, y: 1, t: "S1W" },
        { x: 7, y: 1, t: "S2W" },
        { x: 8, y: 1, t: "S3W" },
        { x: 9, y: 1, t: "S4W" },
        { x: 10, y: 1, t: "S5W" },
        { x: 11, y: 1, t: "F5" },

        // Row 2
        { x: 3, y: 2, t: "F0" },
        { x: 4, y: 2, t: "F0" },
        { x: 5, y: 2, t: "F0" },
        { x: 9, y: 2, t: "F5" },
        { x: 10, y: 2, t: "F5" },
        { x: 11, y: 2, t: "F5" },

        // Row 3
        { x: 1, y: 3, t: "F0" },
        { x: 2, y: 3, t: "F0" },
        { x: 3, y: 3, t: "F0" },
        { x: 4, y: 3, t: "F0" },
        { x: 9, y: 3, t: "F5" },
        { x: 10, y: 3, t: "F5" },
        { x: 11, y: 3, t: "F5" },

        // Row 4
        { x: 1, y: 4, t: "F0" },
        { x: 2, y: 4, t: "F0" },
        { x: 3, y: 4, t: "P0" },
        { x: 4, y: 4, t: "F0" },
        { x: 5, y: 4, t: "F0" },
        { x: 9, y: 4, t: "F5" },
        { x: 10, y: 4, t: "F5" },
        { x: 11, y: 4, t: "F5" },

        { x: 5, y: 3, t: "S0E" },
        { x: 6, y: 3, t: "F-1" },
        { x: 7, y: 3, t: "F-1" },
        { x: 8, y: 3, t: "F-1" },

        // Row 5
        { x: 2, y: 5, t: "F0" },
        { x: 3, y: 5, t: "F0" },
        { x: 4, y: 5, t: "F0" },
        { x: 5, y: 5, t: "F0" },
        { x: 9, y: 5, t: "F5" },
        { x: 10, y: 5, t: "F5" },
        { x: 11, y: 5, t: "F5" },

        // Row 6
        { x: 3, y: 6, t: "F0" },
        { x: 4, y: 6, t: "F0" },
        { x: 5, y: 6, t: "F0" },
        { x: 8, y: 6, t: "F5" },
        { x: 9, y: 6, t: "F5" },
        { x: 10, y: 6, t: "F5" },
        { x: 11, y: 6, t: "F5" },

        // Row 7
        { x: 4, y: 7, t: "S1N" },
        { x: 8, y: 7, t: "F5" },
        { x: 9, y: 7, t: "F5" },
        { x: 10, y: 7, t: "F5" },
        { x: 11, y: 7, t: "F5" },

        // Row 8
        { x: 4, y: 8, t: "S2N" },
        { x: 8, y: 8, t: "F5" },
        { x: 9, y: 8, t: "F5" },
        { x: 10, y: 8, t: "F5" },
        { x: 11, y: 8, t: "F5" },

        // Row 9
        { x: 4, y: 9, t: "S3N" },
        { x: 8, y: 9, t: "S5S" },

        // Row 10
        { x: 1, y: 10, t: "F3" },
        { x: 2, y: 10, t: "F3" },
        { x: 3, y: 10, t: "F3" },
        { x: 4, y: 10, t: "F3" },
        { x: 8, y: 10, t: "S4S" },
        { x: 8, y: 11, t: "F3" },
        { x: 8, y: 12, t: "F3" },
        { x: 8, y: 13, t: "F3" },

        // Row 11
        { x: 1, y: 11, t: "F3" },
        { x: 2, y: 11, t: "F3" },
        { x: 3, y: 11, t: "F3" },
        { x: 4, y: 11, t: "F3" },
        { x: 5, y: 11, t: "F3" },
        { x: 6, y: 11, t: "F3" },
        { x: 7, y: 11, t: "F3" },

        // Row 12
        { x: 2, y: 12, t: "F3" },
        { x: 3, y: 12, t: "F3" },
        { x: 4, y: 12, t: "F3" },
        { x: 5, y: 12, t: "F3" },
        { x: 6, y: 12, t: "F3" },
        { x: 7, y: 12, t: "F3" },

        // Row 13
        { x: 3, y: 13, t: "F3" },
        { x: 4, y: 13, t: "F3" },
        { x: 5, y: 13, t: "F3" },
        { x: 6, y: 13, t: "F3" },
        { x: 7, y: 13, t: "F3" },

        // Row 14
        { x: 4, y: 14, t: "F3" },
        { x: 5, y: 14, t: "F3" },
        { x: 6, y: 14, t: "F3" },
    ],
};
export const EXCEL_TEST_SPAWN_3X3: TableMapDef = {
    id: "EXCEL_TEST_SPAWN_3X3",
    w: 3,
    h: 3,
    defaultFloorSkin: "landscape_28",
    defaultSpawnSkin: "landscape_30",
    centerOnZero: true,

    cells: [
        // Top row
        { x: 0, y: 0, t: "F0" },
        { x: 1, y: 0, t: "F0" },
        { x: 2, y: 0, t: "F0" },

        // Middle row
        { x: 0, y: 1, t: "F0" },
        { x: 1, y: 1, t: "P0" }, // spawn at height 0
        { x: 2, y: 1, t: "F0" },

        // Bottom row
        { x: 0, y: 2, t: "F0" },
        { x: 1, y: 2, t: "F0" },
        { x: 2, y: 2, t: "F0" },
    ],
};

