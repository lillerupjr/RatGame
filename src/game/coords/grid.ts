// src/game/coords/grid.ts
// Screen-aligned logical grid conversions. North is +gy (screen up).
// This is the only module that converts between grid, tile, and world spaces.

export type GridPos = { gx: number; gy: number };
export type GridDelta = { dx: number; dy: number };
export type GridAnchor = { gxi: number; gyi: number; gox: number; goy: number };
export type GridDir = "N" | "E" | "S" | "W" | "NE" | "NW" | "SE" | "SW";

export function gridToTile(gx: number, gy: number): { tx: number; ty: number } {
    return {
        tx: (gx - gy) * 0.5,
        ty: (-gx - gy) * 0.5,
    };
}

export function tileToGrid(tx: number, ty: number): { gx: number; gy: number } {
    return {
        gx: tx - ty,
        gy: -(tx + ty),
    };
}

export function gridToWorld(
    gx: number,
    gy: number,
    tileWorld: number
): { wx: number; wy: number } {
    const { tx, ty } = gridToTile(gx, gy);
    return {
        wx: tx * tileWorld,
        wy: ty * tileWorld,
    };
}

export function worldToGrid(
    wx: number,
    wy: number,
    tileWorld: number
): { gx: number; gy: number } {
    const tx = wx / tileWorld;
    const ty = wy / tileWorld;
    return tileToGrid(tx, ty);
}

export function gridDirDelta(dir: GridDir): GridDelta {
    switch (dir) {
        case "N":
            return { dx: 0, dy: 1 };
        case "E":
            return { dx: 1, dy: 0 };
        case "S":
            return { dx: 0, dy: -1 };
        case "W":
            return { dx: -1, dy: 0 };
        case "NE":
            return { dx: 1, dy: 1 };
        case "NW":
            return { dx: -1, dy: 1 };
        case "SE":
            return { dx: 1, dy: -1 };
        case "SW":
            return { dx: -1, dy: -1 };
        default:
            return { dx: 0, dy: 0 };
    }
}
