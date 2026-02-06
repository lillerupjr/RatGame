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
        // Top row (north edge walls)
        { x: 0, y: 0, t: "F0|W2N" },
        { x: 1, y: 0, t: "F0|W2N" },
        { x: 2, y: 0, t: "F0|W2N|W2E" },

        // Middle row
        { x: 0, y: 1, t: "F0" },
        { x: 1, y: 1, t: "P0" }, // spawn at height 0
        { x: 2, y: 1, t: "F0|W2E" },

        // Bottom row
        { x: 0, y: 2, t: "F0" },
        { x: 1, y: 2, t: "F0" },
        { x: 2, y: 2, t: "F0|W2E" },
        { x: 1, y: 3, t: "S1N" }
    ],
};

export const EXCEL_RENDER_STRESS_01: TableMapDef = {
    id: "EXCEL_RENDER_STRESS_01",
    w: 25,
    h: 25,
    defaultFloorSkin: "edges_landscape_28",
    defaultSpawnSkin: "edges_landscape_30",
    centerOnZero: true,

    // Goals:
    // - Base plaza at F0 with spawn.
    // - Stair run E: 0 -> 3 leading onto a bridge deck (F3).
    // - Under/near-bridge lower floor (F0) to stress occlusion ordering.
    // - Stair run N: 3 -> 6 up to a top plateau (F6).
    // - Stair run W: 3 -> 6 up to a small tower (F6).
    // - Stair run S: 0 -> 2 down to a mid platform (F2).
    // - Additional E stairs: 0 -> 2 connecting corridor into the F2 area.
    //
    // IMPORTANT:
    // - Do not “fix” visuals in render.ts by inspecting tile kinds.
    // - This map is designed to validate Tops → Entities → Curtains.

    cells: [
        // Row 9
        { x: 11, y: 9, t: "F6" },
        { x: 12, y: 9, t: "F6" },
        { x: 13, y: 9, t: "F6" },

        // Row 10
        { x: 11, y: 10, t: "F6" },
        { x: 12, y: 10, t: "F6" },
        { x: 13, y: 10, t: "F6" },
        { x: 18, y: 10, t: "F6" },
        { x: 19, y: 10, t: "F6" },
        { x: 20, y: 10, t: "F6" },
        { x: 21, y: 10, t: "F6" },
        { x: 22, y: 10, t: "F6" },
        { x: 23, y: 10, t: "F6" },

        // Row 11
        { x: 11, y: 11, t: "F6" },
        { x: 12, y: 11, t: "F6" },
        { x: 13, y: 11, t: "F6" },
        { x: 14, y: 11, t: "S6E" }, // was S6W
        { x: 15, y: 11, t: "S5E" }, // was S5W
        { x: 16, y: 11, t: "S4E" }, // was S4W
        { x: 17, y: 11, t: "F3" },
        { x: 18, y: 11, t: "F6" },
        { x: 19, y: 11, t: "F6" },
        { x: 20, y: 11, t: "F6" },
        { x: 21, y: 11, t: "F6" },
        { x: 22, y: 11, t: "F6" },
        { x: 23, y: 11, t: "F6" },

        // Row 12
        { x: 4, y: 12, t: "F0" },
        { x: 5, y: 12, t: "F0" },
        { x: 6, y: 12, t: "F0" },
        { x: 7, y: 12, t: "F0" },
        { x: 8, y: 12, t: "F0" },
        { x: 9, y: 12, t: "F0" },
        { x: 10, y: 12, t: "F0" },
        { x: 18, y: 12, t: "F6" },
        { x: 19, y: 12, t: "F6" },
        { x: 20, y: 12, t: "F6" },
        { x: 21, y: 12, t: "F6" },
        { x: 22, y: 12, t: "F6" },
        { x: 23, y: 12, t: "F6" },

        // Row 13
        { x: 4, y: 13, t: "F0" },
        { x: 5, y: 13, t: "F0" },
        { x: 6, y: 13, t: "F0" },
        { x: 7, y: 13, t: "F0" },
        { x: 8, y: 13, t: "F0" },
        { x: 9, y: 13, t: "F0" },
        { x: 10, y: 13, t: "F0" },
        { x: 19, y: 13, t: "S6S" }, // was S6N
        { x: 18, y: 13, t: "F6" },
        { x: 20, y: 13, t: "F6" },
        { x: 21, y: 13, t: "F6" },
        { x: 22, y: 13, t: "F6" },
        { x: 23, y: 13, t: "F6" },

        // Row 14
        { x: 4, y: 14, t: "F0" },
        { x: 5, y: 14, t: "F0" },
        { x: 6, y: 14, t: "F0" },
        { x: 7, y: 14, t: "F0" },
        { x: 8, y: 14, t: "F0" },
        { x: 9, y: 14, t: "F0" },
        { x: 10, y: 14, t: "F0" },
        { x: 14, y: 14, t: "F3" },
        { x: 15, y: 14, t: "F3" },
        { x: 16, y: 14, t: "F3" },
        { x: 17, y: 14, t: "F3" },
        { x: 18, y: 14, t: "F3" },
        { x: 19, y: 14, t: "S5S" }, // was S5N
        { x: 20, y: 14, t: "F3" },

        // Row 15
        { x: 4, y: 15, t: "F0" },
        { x: 5, y: 15, t: "F0" },
        { x: 6, y: 15, t: "F0" },
        { x: 7, y: 15, t: "P0" },
        { x: 8, y: 15, t: "F0" },
        { x: 9, y: 15, t: "F0" },
        { x: 10, y: 15, t: "F0" },
        { x: 11, y: 15, t: "S1W" }, // was S1E
        { x: 12, y: 15, t: "S2W" }, // was S2E
        { x: 13, y: 15, t: "S3W" }, // was S3E
        { x: 14, y: 15, t: "F3" },
        { x: 15, y: 15, t: "F3" },
        { x: 16, y: 15, t: "F3" },
        { x: 17, y: 15, t: "F3" },
        { x: 18, y: 15, t: "F3" },
        { x: 19, y: 15, t: "S4S" }, // was S4N

        // Row 16
        { x: 4, y: 16, t: "F0" },
        { x: 5, y: 16, t: "F0" },
        { x: 6, y: 16, t: "F0" },
        { x: 7, y: 16, t: "F0" },
        { x: 8, y: 16, t: "F0" },
        { x: 9, y: 16, t: "F0" },
        { x: 10, y: 16, t: "F0" },
        { x: 13, y: 16, t: "F0" },
        { x: 14, y: 16, t: "F3" },
        { x: 15, y: 16, t: "F3" },
        { x: 16, y: 16, t: "F3" },
        { x: 17, y: 16, t: "F3" },
        { x: 18, y: 16, t: "F3" },
        { x: 19, y: 16, t: "F3" },

        // Row 17
        { x: 4, y: 17, t: "F0" },
        { x: 5, y: 17, t: "F0" },
        { x: 6, y: 17, t: "F0" },
        { x: 7, y: 17, t: "F0" },
        { x: 8, y: 17, t: "F0" },
        { x: 9, y: 17, t: "F0" },
        { x: 10, y: 17, t: "F0" },
        { x: 13, y: 17, t: "F0" },
        { x: 14, y: 17, t: "F0" },
        { x: 15, y: 17, t: "F0" },
        { x: 16, y: 17, t: "F0" },
        { x: 17, y: 17, t: "F0" },

        // Row 18
        { x: 4, y: 18, t: "F0" },
        { x: 5, y: 18, t: "F0" },
        { x: 6, y: 18, t: "F0" },
        { x: 7, y: 18, t: "F0" },
        { x: 8, y: 18, t: "F0" },
        { x: 9, y: 18, t: "F0" },
        { x: 10, y: 18, t: "F0" },
        { x: 11, y: 18, t: "F0" },
        { x: 12, y: 18, t: "F0" },
        { x: 13, y: 18, t: "F0" },
        { x: 14, y: 18, t: "F0" },
        { x: 15, y: 18, t: "F0" },

        // Row 19
        { x: 6, y: 19, t: "S1N" }, // was S1S
        { x: 9, y: 19, t: "F0" },

        // Row 20
        { x: 6, y: 20, t: "S2N" }, // was S2S
        { x: 9, y: 20, t: "F0" },

        // Row 21
        { x: 4, y: 21, t: "F2" },
        { x: 5, y: 21, t: "F2" },
        { x: 6, y: 21, t: "F2" },
        { x: 7, y: 21, t: "F2" },
        { x: 8, y: 21, t: "F2" },
        { x: 9, y: 21, t: "F0" },

        // Row 22
        { x: 4, y: 22, t: "F2" },
        { x: 5, y: 22, t: "F2" },
        { x: 6, y: 22, t: "F2" },
        { x: 7, y: 22, t: "F2" },
        { x: 8, y: 22, t: "F2" },
        { x: 9, y: 22, t: "F0" },
        { x: 10, y: 22, t: "S1W" }, // was S1E
        { x: 11, y: 22, t: "S2W" }, // was S2E
        { x: 12, y: 22, t: "F2" },
        { x: 13, y: 22, t: "F2" },
        { x: 14, y: 22, t: "F2" },

        // Row 23
        { x: 4, y: 23, t: "F2" },
        { x: 5, y: 23, t: "F2" },
        { x: 6, y: 23, t: "F2" },
        { x: 7, y: 23, t: "F2" },
        { x: 8, y: 23, t: "F2" },
    ],

};
export const simple_test: TableMapDef = {
    id: "simple_test",
    w: 3,
    h: 3,
    defaultFloorSkin: "landscape_28",
    defaultSpawnSkin: "landscape_30",
    centerOnZero: true,

    cells: [
        { x: 0, y: 1, t: "S1W" },
        { x: 2, y: 1, t: "S1E" },
        { x: 1, y: 1, t: "P0" },
        { x: 1, y: 0, t: "S1N" },
        { x: 1, y: 2, t: "S1S" },
    ],
};