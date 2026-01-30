// src/game/map/kenneyMap.ts
// Shared Kenney-style placeholder map logic for Milestone A.
// IMPORTANT: render + movement MUST use the same function so holes and collision match.

export const HOLE_P = 0.18;

/**
 * Deterministic hash-based "hole" test for a tile coordinate.
 * Stable across runs, no RNG needed.
 */
export function isHoleTile(tx: number, ty: number): boolean {
    let h = tx * 374761393 + ty * 668265263; // big primes
    h = (h ^ (h >>> 13)) | 0;
    h = (h * 1274126177) | 0;
    const r01 = ((h >>> 0) % 1000) / 1000; // [0,1)

    // Occasional bigger chunk holes so it's obvious
    const bigHole = ((tx & 7) === 0 && (ty & 7) === 0 && r01 < 0.65);

    return r01 < HOLE_P || bigHole;
}

/**
 * Convert world coords -> tile coords given world-units-per-tile.
 * Uses the same "centered tile" convention as the renderer.
 */
export function worldToTile(wx: number, wy: number, tileWorld: number) {
    const tx = Math.floor(wx / tileWorld);
    const ty = Math.floor(wy / tileWorld);
    return { tx, ty };
}

/**
 * World position is walkable if its tile is not a hole.
 */
export function isWalkableWorld(wx: number, wy: number, tileWorld: number): boolean {
    const { tx, ty } = worldToTile(wx, wy, tileWorld);
    return !isHoleTile(tx, ty);
}
