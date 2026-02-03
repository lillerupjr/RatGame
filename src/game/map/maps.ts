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

        { x: 3, y: 1, t: "F0" },
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

/**
 * EXCEL_SANCTUARY_02_LARGE
 *
 * Large deterministic “Arcane Sanctuary”-style layout:
 * - Big F0 “home” platform (with spawn P0)
 * - Multiple raised platforms (F3, F5, F8)
 * - Connected by several stair-bridges
 *
 * Stair authoring contract:
 * - Stairs use tokens S<number><dir>
 * - Adjacent stairs with same dir become a staircase ramp polygon in kenneyMap.ts
 * - We keep stair direction logic EXACTLY as in the current system.
 */
export const EXCEL_SANCTUARY_02: TableMapDef = {
    id: "EXCEL_SANCTUARY_02_LARGE",
    w: 60,
    h: 60,
    defaultFloorSkin: "edges_landscape_28",
    defaultSpawnSkin: "edges_landscape_30",
    centerOnZero: true,

    // Coordinates (x,y) in table space; top-left is (0,0).
    // Only non-empty cells listed; everything else is VOID.
    cells: [
        // ─────────────────────────────────────────────
        // MAIN PLATFORM (F0) — large “home” diamond-ish blob
        // Spawn is here (P0).
        // ─────────────────────────────────────────────

        // Core slab
        ...rect(18, 18, 24, 16, "F0"),

        // Little protrusions to feel more “sanctuary”
        ...rect(14, 22, 6, 8, "F0"),
        ...rect(42, 22, 6, 8, "F0"),
        ...rect(24, 14, 12, 6, "F0"),
        ...rect(24, 34, 12, 6, "F0"),

        // Spawn (first P token wins)
        { x: 26, y: 26, t: "P0" },

        // ─────────────────────────────────────────────
        // PLATFORM A (F3) — south-east
        // ─────────────────────────────────────────────
        ...rect(40, 36, 14, 12, "F3"),

        // Connector strip on the F3 platform for variety
        ...rect(46, 48, 4, 6, "F3"),

        // ─────────────────────────────────────────────
        // PLATFORM B (F5) — north-east
        // ─────────────────────────────────────────────
        ...rect(42, 10, 14, 12, "F5"),
        ...rect(38, 14, 4, 6, "F5"), // little spur

        // ─────────────────────────────────────────────
        // PLATFORM C (F8) — far north-west (highest)
        // ─────────────────────────────────────────────
        ...rect(6, 6, 14, 12, "F8"),
        ...rect(2, 10, 4, 6, "F8"), // spur

        // ─────────────────────────────────────────────
        // PLATFORM D (F5) — west-mid (secondary)
        // ─────────────────────────────────────────────
        ...rect(4, 30, 16, 14, "F5"),

        // ─────────────────────────────────────────────
        // STAIRCASES / BRIDGES
        //
        // Important: These are authored as straight runs where adjacent stairs
        // have the same direction and increasing height number.
        //
        // Your staircase builder will turn each run into ONE ramp polygon.
        // ─────────────────────────────────────────────

        // Bridge 1: MAIN (F0) → PLATFORM B (F5)
        // Runs EAST (dir=E), increasing S1E..S5E
        // Start near main platform's east edge and reach platform B's west edge.
        ...stairRunE(42 - 5, 22, 1, 5), // (x, y, startH, len)

        // Land tiles on both ends to ensure connectivity (flat tops)
        { x: 42 - 6, y: 22, t: "F0" },
        { x: 42 + 1, y: 22, t: "F5" },

        // Bridge 2: MAIN (F0) → PLATFORM A (F3)
        // Runs SOUTH (dir=S), increasing S1S..S3S
        ...stairRunS(30, 34, 1, 3),
        { x: 30, y: 33, t: "F0" },
        { x: 30, y: 38, t: "F3" },

        // Bridge 3: PLATFORM A (F3) → PLATFORM B (F5)
        // Runs NORTH (dir=N), increasing S4N..S5N (short)
        ...stairRunN(48, 34, 4, 2),
        { x: 48, y: 35, t: "F3" },
        { x: 48, y: 31, t: "F5" },

        // Bridge 4: MAIN (F0) → PLATFORM D (F5) west-mid
        // Runs WEST (dir=W), increasing S1W..S5W
        ...stairRunW(18, 30, 1, 5),
        { x: 17, y: 30, t: "F0" },
        { x: 12, y: 30, t: "F5" },

        // Bridge 5: PLATFORM D (F5) → PLATFORM C (F8) far NW
        // Two-stage climb:
        //   (a) F5 → F5 connector segment (flat) then
        //   (b) stair run NORTH to F8 (S6N..S8N)
        ...rect(10, 22, 6, 2, "F5"),
        ...stairRunN(12, 20, 6, 3),
        { x: 12, y: 21, t: "F5" },
        { x: 12, y: 16, t: "F8" },

        // Bridge 6: PLATFORM C (F8) → MAIN (F0) “return” route (long diagonal-ish feel)
        // We do it as two orthogonal stair runs with small flat islands:
        //   (a) run EAST at high level (S8E..S6E descending is NOT allowed)
        // So instead: we create a separate staircase that goes from F0 up to F8
        // using increasing heights again, but placed as a different route.
        //
        // Segment 1: F0→F3 (S1N..S3N) going north
        ...stairRunN(22, 18, 1, 3),
        { x: 22, y: 19, t: "F0" },
        { x: 22, y: 15, t: "F3" },
        // Segment 2: small F3 island
        ...rect(20, 14, 6, 4, "F3"),
        // Segment 3: F3→F5 (S4W..S5W) going west
        ...stairRunW(20, 16, 4, 2),
        { x: 21, y: 16, t: "F3" },
        { x: 17, y: 16, t: "F5" },
        // Segment 4: small F5 island
        ...rect(14, 14, 6, 4, "F5"),
        // Segment 5: F5→F8 (S6N..S8N) going north
        ...stairRunN(16, 14, 6, 3),
        { x: 16, y: 15, t: "F5" },
        { x: 16, y: 10, t: "F8" },
    ],
};

/**
 * Helpers to keep the map authoring readable.
 * These produce {x,y,t} entries with the given token string.
 */

function rect(x: number, y: number, w: number, h: number, t: string) {
    const out: Array<{ x: number; y: number; t: string }> = [];
    for (let yy = y; yy < y + h; yy++) {
        for (let xx = x; xx < x + w; xx++) {
            out.push({ x: xx, y: yy, t });
        }
    }
    return out;
}

function stairRunE(x: number, y: number, startH: number, len: number) {
    const out: Array<{ x: number; y: number; t: string }> = [];
    for (let i = 0; i < len; i++) {
        out.push({ x: x + i, y, t: `S${startH + i}E` });
    }
    return out;
}

function stairRunW(x: number, y: number, startH: number, len: number) {
    const out: Array<{ x: number; y: number; t: string }> = [];
    for (let i = 0; i < len; i++) {
        out.push({ x: x - i, y, t: `S${startH + i}W` });
    }
    return out;
}

function stairRunN(x: number, y: number, startH: number, len: number) {
    const out: Array<{ x: number; y: number; t: string }> = [];
    for (let i = 0; i < len; i++) {
        out.push({ x, y: y - i, t: `S${startH + i}N` });
    }
    return out;
}

function stairRunS(x: number, y: number, startH: number, len: number) {
    const out: Array<{ x: number; y: number; t: string }> = [];
    for (let i = 0; i < len; i++) {
        out.push({ x, y: y + i, t: `S${startH + i}S` });
    }
    return out;
}