// src/game/map/kenneyMap.ts
// Arcane-Sanctuary-style placeholder:
// - deterministic platforms over void
// - multi-height tiles
// - stairs connecting levels
//
// IMPORTANT: render + movement MUST use the same functions so visuals/collision match.

import { worldDeltaToScreen } from "../visual/iso";

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

    function stairTile(startTx: number, startTy: number, baseH: number): IsoTile | null {
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

    const carveGap = onBase && tx >= 5 && ty <= -3 && (tx + ty) >= 2;

    // Keep the base away from other platforms so connections are only via stairs.
    // Increase this padding if you see accidental bridges.
    const keepAway = 2;

    const nearP2 = Math.abs(dx2) + Math.abs(dy2) <= platR + keepAway;
    const nearP3 = Math.abs(dx3) + Math.abs(dy3) <= platR + keepAway;
    const nearP4 = Math.abs(dx4) + Math.abs(dy4) <= platR + keepAway;

    const carveAroundP2 = onBase && nearP2;
    const carveAroundP3 = onBase && nearP3;
    const carveAroundP4 = onBase && nearP4;

    const baseWalkable = onBase && !carveGap && !carveAroundP2 && !carveAroundP3 && !carveAroundP4;

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
 * Convert world position -> tile coords + tile-local top-face pixels (lx,ly).
 *
 * NOTE:
 * - world coords are your "flat 2D" simulation coords.
 * - we use worldDeltaToScreen to derive the iso-projected offset inside the tile.
 * - then we map that projected offset into the canonical top-face box: 128x64.
 */
function worldToTileTopLocalPx(wx: number, wy: number, tileWorld: number) {
    const tx = Math.floor(wx / tileWorld);
    const ty = Math.floor(wy / tileWorld);

    const ox = wx - (tx + 0.5) * tileWorld;
    const oy = wy - (ty + 0.5) * tileWorld;

    const d = worldDeltaToScreen(ox, oy);

    // Now d.dx spans roughly [-tileWorld..+tileWorld]  -> map to [0..128]
    // and d.dy spans roughly [-tileWorld/2..+tileWorld/2] (with ISO_Y=0.5) -> map to [0..64]
    const lx = (d.dx / tileWorld) * 64 + 64;
    const ly = (d.dy / (tileWorld * 0.5)) * 32 + 32; // <-- ISO_Y normalization

    return { tx, ty, lx, ly };
}

// ─────────────────────────────────────────────────────────────
// Milestone B: hardcoded logical top-face shapes (no sprite sampling)
//
// Practical shapes (minimum set):
//   FULL_TOP     -> standard floor tile (128x64 diamond)
//   TOP_CUT_16   -> floor/stairs tile with visible front face (cuts bottom 16px)
//   BLOCKED      -> walls/void
//   BRIDGE_TOP   -> narrow top face (optional/later)
// ─────────────────────────────────────────────────────────────

export type TileWalkShape = "FULL_TOP"  | "BLOCKED" | "BRIDGE_TOP";

const TOP_W = 128;
const TOP_H_FULL = 64;

const BRIDGE_TOP_H = 32; // optional, tune later


// ─────────────────────────────────────────────────────────────
// Anchor offsets (in TOP-LOCAL PIXELS)
// These shift the logical diamond relative to the tile’s visual 128x64 box.
//
// +ox moves diamond right
// +oy moves diamond down
//
// Use-case: if a tile’s art top face is not centered in the 128x64 local
// box, you can “recenter” collision by nudging anchors here.
// ─────────────────────────────────────────────────────────────

// Per-walk-shape default anchors:
export const WALK_SHAPE_ANCHOR_PX: Record<TileWalkShape, { ox: number; oy: number }> = {
    FULL_TOP: { ox: 0, oy: 0 },
    BRIDGE_TOP: { ox: 0, oy: 0 },
    BLOCKED: { ox: 0, oy: 0 },
};

// Optional per-kind anchor nudges (adds on top of shape anchor).
// Keep these at 0 unless you notice a particular tile kind is “off”.
export const WALK_KIND_ANCHOR_PX: Partial<Record<IsoTileKind, { ox: number; oy: number }>> = {
    // Example knobs (leave at 0 until needed):
    // STAIRS: { ox: 0, oy: -8 },
    // FLOOR:  { ox: 0, oy: 0 },
};

function diamondContains(lx: number, ly: number, w: number, h: number): boolean {
    // |(x-cx)/hw| + |(y-cy)/hh| <= 1
    const cx = w * 0.5;
    const cy = h * 0.5;
    const hw = w * 0.5;
    const hh = h * 0.5;

    const dx = Math.abs(lx - cx) / hw;
    const dy = Math.abs(ly - cy) / hh;
    return dx + dy <= 1;
}

function shapeDims(shape: TileWalkShape): { w: number; h: number } {
    switch (shape) {
        case "FULL_TOP":
            return { w: TOP_W, h: TOP_H_FULL }; // 128x64
        case "BRIDGE_TOP":
            return { w: TOP_W, h: BRIDGE_TOP_H }; // 128x32
        case "BLOCKED":
        default:
            return { w: TOP_W, h: 0 };
    }
}

export function tileWalkShape(tx: number, ty: number): TileWalkShape {
    const t = getTile(tx, ty);
    switch (t.kind) {
        case "VOID":
            return "BLOCKED";
        case "FLOOR":
            return "FULL_TOP"
        default:
            return "FULL_TOP";
    }
}

/**
 * True if (wx, wy) is walkable within the tile's top face shape.
 * This is the core Milestone B logic gate (no sprite sampling).
 */
export function isWalkableWorld(wx: number, wy: number, tileWorld: number): boolean {
    const { tx, ty, lx, ly } = worldToTileTopLocalPx(wx, wy, tileWorld);

    const t = getTile(tx, ty);
    const shape = tileWalkShape(tx, ty);
    if (shape === "BLOCKED") return false;

    const { w, h } = shapeDims(shape);

    // Compose anchors: shape anchor + optional kind anchor
    const aShape = WALK_SHAPE_ANCHOR_PX[shape] ?? { ox: 0, oy: 0 };
    const aKind = WALK_KIND_ANCHOR_PX[t.kind] ?? { ox: 0, oy: 0 };
    const ox = aShape.ox + aKind.ox;
    const oy = aShape.oy + aKind.oy;

    // Apply anchor shift in tile-local top-face px space
    const ax = lx - ox;
    const ay = ly - oy;

    return diamondContains(ax, ay, w, h);
}

// ─────────────────────────────────────────────────────────────
// DEBUG: outline of the logical walk shape (tile-local top-face px)
//
// Returns points in the SAME "top local px" space as (lx, ly):
//   lx: 0..128, ly: 0..64 (visual top box)
// Anchors are applied so it matches isWalkableWorld exactly.
// ─────────────────────────────────────────────────────────────
export type WalkOutlineLocal = {
    blocked: boolean;
    shape: TileWalkShape;
    pts: Array<{ x: number; y: number }>; // closed by renderer
};

export function getWalkOutlineLocalPx(tx: number, ty: number): WalkOutlineLocal {
    const t = getTile(tx, ty);
    const shape = tileWalkShape(tx, ty);
    if (shape === "BLOCKED") return { blocked: true, shape, pts: [] };

    const { w, h } = shapeDims(shape);

    // Base diamond for the chosen shape dims (w x h)
    const base = [
        { x: w * 0.5, y: 0 }, // top
        { x: w, y: h * 0.5 }, // right
        { x: w * 0.5, y: h }, // bottom
        { x: 0, y: h * 0.5 }, // left
    ];

    // Same anchor composition as isWalkableWorld
    const aShape = WALK_SHAPE_ANCHOR_PX[shape] ?? { ox: 0, oy: 0 };
    const aKind = WALK_KIND_ANCHOR_PX[t.kind] ?? { ox: 0, oy: 0 };
    const ox = aShape.ox + aKind.ox;
    const oy = aShape.oy + aKind.oy;

    // Because we test (lx - ox, ly - oy), the diamond itself is shifted by (+ox, +oy)
    const pts = base.map((p) => ({ x: p.x + ox, y: p.y + oy }));

    return { blocked: false, shape, pts };
}
