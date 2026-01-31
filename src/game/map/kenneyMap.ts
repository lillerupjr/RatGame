// src/game/map/kenneyMap.ts
// Arcane-Sanctuary-style placeholder:
// - deterministic platforms over void
// - multi-height tiles
// - stairs connecting levels
//
// IMPORTANT: render + movement MUST use the same functions so visuals/collision match.

export type IsoTileKind = "VOID" | "FLOOR" | "STAIRS";

export type IsoTile = {
    kind: IsoTileKind;

    // integer height levels (0 = base platform, 1 = raised, etc.)
    h: number;

    // for STAIRS only: where on the step we are (0..1) (purely visual for now)
    step?: number;
};

/**
 * A simple deterministic "Arcane Sanctuary" layout in tile-space.
 *
 * Coordinate system:
 * - (tx, ty) are the same tiles your renderer already draws.
 *
 * Layout idea:
 * - Big base diamond platform at h=0
 * - Smaller raised diamond platform at h=1 (offset)
 * - A stair "bridge" strip that connects them
 */
export function getTile(tx: number, ty: number): IsoTile {
    // ==========================================
    // 4-platform Arcane Sanctuary test layout
    //
    // Platform heights (logical levels):
    //   P1 (base): h=0
    //   P2:        h=4
    //   P3:        h=8
    //   P4:        h=12
    //
    // Stairs:
    //   Each connection is 4 tiles long, rising +1 per tile (16px per level in render via ELEV_PX=16)
    // ==========================================

    // ---- Base platform (big) ----
    const baseCx = 0;
    const baseCy = 0;
    const baseR = 12;
    const bx = tx - baseCx;
    const by = ty - baseCy;
    const onBase = Math.abs(bx) + Math.abs(by) <= baseR;

    // ---- Platform parameters ----
    const platR = 6;

    // "Move towards the right" in your tile coords: +tx
    // Keep a slight upward drift so the bridges don't overlap the base.
    // SYSTEM FOR GENERATING MORE: x + 12, y - 5, h + 4
    const P2 = { cx: 14, cy: -8, h: 4 };
    const P3 = { cx: 26, cy: -13, h: 8 }; // cy - 1 = W
    const P4 = { cx: 38, cy: -18, h: 12 };

    const dx2 = tx - P2.cx;
    const dy2 = ty - P2.cy;
    const onP2 = Math.abs(dx2) + Math.abs(dy2) <= platR;

    const dx3 = tx - P3.cx;
    const dy3 = ty - P3.cy;
    const onP3 = Math.abs(dx3) + Math.abs(dy3) <= platR;

    const dx4 = tx - P4.cx;
    const dy4 = ty - P4.cy;
    const onP4 = Math.abs(dx4) + Math.abs(dy4) <= platR;

    // ---- Stairs helper (vertical run in tile-space: dx=0, dy=-1) ----
    // Each stair is 4 tiles. We return STAIRS with height = baseH + k.
    const STAIRS_LEN = 4;

    function stairTile(
        startTx: number,
        startTy: number,
        baseH: number
    ): IsoTile | null {
        // stairs go "north" in tile-space (same as your current setup)
        const stairDx = 0;
        const stairDy = -1;

        for (let k = 1; k <= STAIRS_LEN; k++) {
            const sx = startTx + stairDx * k;
            const sy = startTy + stairDy * k;
            if (tx === sx && ty === sy) {
                return { kind: "STAIRS", h: baseH + k };
            }
        }
        return null;
    }

    // Put stairs in the *void corridor* between platforms (not on top of platform tiles).
// Since each platform has radius platR=6, the rightmost edge is at cx+6.
// We start at cx+7 so the stair column sits 1 tile outside the platform footprint.
    const s12 = stairTile(9, -2, 0); // Base -> P2 : h 1..4 (your tuned position)
    if (s12) return s12;

    const s23 = stairTile(P2.cx + platR, P2.cy, P2.h); // P2 -> P3 : h 5..8
    if (s23) return s23;

    const s34 = stairTile(P3.cx + platR, P3.cy, P3.h); // P3 -> P4 : h 9..12
    if (s34) return s34;


    // ---- Carving to force void gaps so islands don't merge ----
    // We keep your base carveGap, plus "keep-away" zones around raised platforms.

    const carveGap =
        onBase &&
        tx >= 5 &&
        ty <= -3 &&
        (tx + ty) >= 2;

    // Keep the base away from other platforms so connections are only via stairs.
    // Increase this padding if you see accidental bridges.
    const keepAway = 2;

    const nearP2 = Math.abs(dx2) + Math.abs(dy2) <= (platR + keepAway);
    const nearP3 = Math.abs(dx3) + Math.abs(dy3) <= (platR + keepAway);
    const nearP4 = Math.abs(dx4) + Math.abs(dy4) <= (platR + keepAway);

    const carveAroundP2 = onBase && nearP2;
    const carveAroundP3 = onBase && nearP3;
    const carveAroundP4 = onBase && nearP4;

    const baseWalkable =
        onBase &&
        !carveGap &&
        !carveAroundP2 &&
        !carveAroundP3 &&
        !carveAroundP4;

    // ---- Platforms (highest precedence) ----
    // Raised platforms win visually (they sit above and should be distinct).
    if (onP4) return { kind: "FLOOR", h: P4.h };
    if (onP3) return { kind: "FLOOR", h: P3.h };
    if (onP2) return { kind: "FLOOR", h: P2.h };

    if (baseWalkable) return { kind: "FLOOR", h: 0 };

    return { kind: "VOID", h: 0 };
}


/**
 * Keep old name for compatibility: "hole" == "void".
 */
export function isHoleTile(tx: number, ty: number): boolean {
    return getTile(tx, ty).kind === "VOID";
}

export function isStairsTile(tx: number, ty: number): boolean {
    return getTile(tx, ty).kind === "STAIRS";
}

/**
 * Integer height level for this tile (0/1/2...).
 * Note: STAIRS currently return h=0, but step() can be used for visual lift.
 */
export function tileHeight(tx: number, ty: number): number {
    return getTile(tx, ty).h | 0;
}

/**
 * Convert world coords -> tile coords given world-units-per-tile.
 * Uses the same convention as the renderer.
 */
export function worldToTile(wx: number, wy: number, tileWorld: number) {
    const tx = Math.floor(wx / tileWorld);
    const ty = Math.floor(wy / tileWorld);
    return { tx, ty };
}

/**
 * World position is walkable if its tile is not void.
 *
 * (This keeps your current movement/collision behavior consistent with the new map.)
 */
export function isWalkableWorld(wx: number, wy: number, tileWorld: number): boolean {
    const { tx, ty } = worldToTile(wx, wy, tileWorld);
    return getTile(tx, ty).kind !== "VOID";
}
