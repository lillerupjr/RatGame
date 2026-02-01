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
// SYSTEM FOR GENERATING MORE: x + 12, y - 5, h + 4
    const P2 = { cx: 14, cy: -8,  h: 4  };
    const P3 = { cx: 26, cy: -13, h: 8  }; // cy - 1 = W
    const P4 = { cx: 38, cy: -18, h: 12 };
    const P5 = { cx: 50, cy: -23, h: 16 };
    const P6 = { cx: 62, cy: -28, h: 20 };

    const dx2 = tx - P2.cx;
    const dy2 = ty - P2.cy;
    const onP2 = Math.abs(dx2) + Math.abs(dy2) <= platR;

    const dx3 = tx - P3.cx;
    const dy3 = ty - P3.cy;
    const onP3 = Math.abs(dx3) + Math.abs(dy3) <= platR;

    const dx4 = tx - P4.cx;
    const dy4 = ty - P4.cy;
    const onP4 = Math.abs(dx4) + Math.abs(dy4) <= platR;

    const dx5 = tx - P5.cx;
    const dy5 = ty - P5.cy;
    const onP5 = Math.abs(dx5) + Math.abs(dy5) <= platR;

    const dx6 = tx - P6.cx;
    const dy6 = ty - P6.cy;
    const onP6 = Math.abs(dx6) + Math.abs(dy6) <= platR;


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

    const s45 = stairTile(P4.cx + platR, P4.cy, P4.h); // P4 -> P5 : h 13..16
    if (s45) return s45;

    const s56 = stairTile(P5.cx + platR, P5.cy, P5.h); // P5 -> P6 : h 17..20
    if (s56) return s56;

    // ---- Carving to force void gaps so islands don't merge ----
    // We keep your base carveGap, plus "keep-away" zones around raised platforms.

    const carveGap = onBase && tx >= 5 && ty <= -3 && (tx + ty) >= 2;

    // Keep the base away from other platforms so connections are only via stairs.
    // Increase this padding if you see accidental bridges.
    const keepAway = 2;

    const nearP2 = Math.abs(dx2) + Math.abs(dy2) <= platR + keepAway;
    const nearP3 = Math.abs(dx3) + Math.abs(dy3) <= platR + keepAway;
    const nearP4 = Math.abs(dx4) + Math.abs(dy4) <= platR + keepAway;
    const nearP5 = Math.abs(dx5) + Math.abs(dy5) <= platR + keepAway;
    const nearP6 = Math.abs(dx6) + Math.abs(dy6) <= platR + keepAway;

    const carveAroundP2 = onBase && nearP2;
    const carveAroundP3 = onBase && nearP3;
    const carveAroundP4 = onBase && nearP4;
    const carveAroundP5 = onBase && nearP5;
    const carveAroundP6 = onBase && nearP6;

    const baseWalkable =
        onBase &&
        !carveGap &&
        !carveAroundP2 &&
        !carveAroundP3 &&
        !carveAroundP4 &&
        !carveAroundP5 &&
        !carveAroundP6;


    // ---- Platforms (highest precedence) ----
    // Raised platforms win visually (they sit above and should be distinct).
    if (onP6) return { kind: "FLOOR", h: P6.h };
    if (onP5) return { kind: "FLOOR", h: P5.h };
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

function clamp01(v: number) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Continuous height at a WORLD position (wx,wy).
 *
 * - FLOOR: returns integer height (h)
 * - VOID: returns its h (usually 0) (caller should treat VOID as not-walkable)
 * - STAIRS: returns h + step, where step is 0..1 within the tile
 *
 * IMPORTANT:
 * Current sanctuary layout defines stairs as a vertical run in tile-space:
 *   dx = 0, dy = -1  (moving "up" the stairs means decreasing ty)
 *
 * With our worldToTileTopLocalPx mapping:
 *   ly ∈ [0..64], where ly=0 is the "top" tip of the diamond,
 *   and ly=64 is the "bottom" tip.
 *
 * So moving up the stairs (towards the next higher tile) corresponds to
 * decreasing ly → step increases towards 1.
 */
export function heightAtWorld(wx: number, wy: number, tileWorld: number): number {
    const { tx, ty, lx: _lx, ly } = worldToTileTopLocalPx(wx, wy, tileWorld);
    const t = getTile(tx, ty);
    const baseH = (t.h | 0);

    if (t.kind !== "STAIRS") return baseH;

// STAIRS: interpolate within this tile in WORLD space (stable across tile seams).
// Our stairs run "north" in tile-space (ty decreasing), so:
// - south edge of tile => step = 0
// - north edge of tile => step = 1
//
// Use world fraction inside the tile instead of top-local ly, so the height ramp
// lines up with the actual boundary you cross.
    const fy = (wy - ty * tileWorld) / tileWorld; // 0..1
    const step = clamp01(1 - fy);
    return baseH + step;

}

// ─────────────────────────────────────────────────────────────
// Enemy/AI helper: find a good stairs "magnet" target
// Used by Option B (“Always converge”).
// ─────────────────────────────────────────────────────────────

export type StairsTarget = {
    tx: number;
    ty: number;
    h: number;      // integer stair level at that tile
    wx: number;     // world target (tile center)
    wy: number;
};

/**
 * Find a nearby STAIRS tile to steer toward when you want to change floors.
 *
 * Scoring favors:
 * - closer distance
 * - stairs whose integer h is close to the caller's current floor
 * - stairs whose integer h moves you toward the target floor
 *
 * Returns a world-space point you can steer toward (tile center).
 */
export function findNearestStairsWorld(
    fromWx: number,
    fromWy: number,
    fromFloorH: number,
    targetFloorH: number,
    tileWorld: number,
    radiusTiles = 40
): StairsTarget | null {
    const { tx: cx, ty: cy } = worldToTile(fromWx, fromWy, tileWorld);

    let best: StairsTarget | null = null;
    let bestScore = Infinity;

    for (let ty = cy - radiusTiles; ty <= cy + radiusTiles; ty++) {
        for (let tx = cx - radiusTiles; tx <= cx + radiusTiles; tx++) {
            const t = getTile(tx, ty);
            if (t.kind !== "STAIRS") continue;

            const h = (t.h | 0);

            // Candidate world target (tile center)
            const wx = (tx + 0.5) * tileWorld;
            const wy = (ty + 0.5) * tileWorld;

            // Ensure the point is actually inside the walkable top-face
            const wi = walkInfo(wx, wy, tileWorld);
            if (!wi.walkable) continue;

            // Distance term
            const dx = wx - fromWx;
            const dy = wy - fromWy;
            const dist2 = dx * dx + dy * dy;

            // Prefer stairs that are "reachable" from our current floor band
            // (still allow others, but penalize heavily)
            const floorBandPenalty = Math.abs(h - fromFloorH);

            // Prefer stairs whose h is closer to the player's floor direction
            const towardPenalty = Math.abs(h - targetFloorH);

            // Weighted score
            const score =
                dist2
                + floorBandPenalty * floorBandPenalty * 1200
                + towardPenalty * towardPenalty * 250;

            if (score < bestScore) {
                bestScore = score;
                best = { tx, ty, h, wx, wy };
            }
        }
    }

    return best;
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
// ─────────────────────────────────────────────────────────────
// Milestone B Map API
// - heightAt(wx,wy): authoritative "floor height" at world point
// - walkInfo(wx,wy): rich walkability info for movement, AI, etc.
// - isWalkableWorld: legacy wrapper kept for compatibility
// ─────────────────────────────────────────────────────────────

export type WalkInfo = {
    // World → tile
    wx: number;
    wy: number;
    tileWorld: number;
    tx: number;
    ty: number;

    // Position inside the tile's "top-face local px" space
    // lx: 0..128, ly: 0..64 (for classic 2:1 iso top box)
    lx: number;
    ly: number;

    // Tile definition + derived fields
    kind: IsoTileKind;
    shape: TileWalkShape;

    // Integer floor level at this location (used for gating / active floor)
    floorH: number;

    // Back-compat alias (older code expects `.h`)
    // Keep equal to floorH.
    h: number;

    // Continuous Z at this location (stairs interpolate inside tile)
    // For non-stairs, z === floorH.
    z: number;

    // Walk decision
    blocked: boolean;   // true if shape is BLOCKED or tile is VOID
    inside: boolean;    // true if point lies inside the top-face diamond for this shape
    walkable: boolean;  // final decision: !blocked && inside

    // Debug helper (why it failed)
    reason?: "BLOCKED" | "OUTSIDE";
};

/**
 * Rich walkability info for a world point.
 * This is the map-authoritative query that movement, enemies, and projectiles can share.
 *
 * Includes both:
 * - floorH (integer) for gating
 * - z (float) for smooth stairs
 */
export function walkInfo(wx: number, wy: number, tileWorld: number): WalkInfo {
    const { tx, ty, lx, ly } = worldToTileTopLocalPx(wx, wy, tileWorld);

    const t = getTile(tx, ty);
    const kind = t.kind;

    const shape = tileWalkShape(tx, ty);
    const blocked = (shape === "BLOCKED") || (kind === "VOID");

    // Integer floor level (gating)
    const floorH = kind === "STAIRS" ? (t.h ?? 0) : tileHeight(tx, ty);

    // Continuous Z (stairs interpolate within tile)
    // NOTE: This works even when not walkable; callers should still use .walkable to gate occupancy.
    const z = heightAtWorld(wx, wy, tileWorld);

    if (blocked) {
        return {
            wx, wy, tileWorld,
            tx, ty, lx, ly,
            kind, shape,
            floorH,
            h: floorH, // back-compat
            z,
            blocked: true,
            inside: false,
            walkable: false,
            reason: "BLOCKED",
        };
    }

    const { w, h: hh } = shapeDims(shape);

    // Compose anchors: shape anchor + optional kind anchor
    const aShape = WALK_SHAPE_ANCHOR_PX[shape] ?? { ox: 0, oy: 0 };
    const aKind = WALK_KIND_ANCHOR_PX[kind] ?? { ox: 0, oy: 0 };
    const ox = aShape.ox + aKind.ox;
    const oy = aShape.oy + aKind.oy;

    // Apply anchor shift in tile-local top-face px space
    const ax = lx - ox;
    const ay = ly - oy;

    let inside = false;

// STAIRS: use the skew-friendly quad in 130x80 space
    if (kind === "STAIRS") {
        // Note: anchors still apply (ax/ay), then we test in stairs pixel space.
        inside = stairsTopContainsTopLocal(ax, ay);
    } else {
        // FLOOR (and any other future kind): classic diamond contains
        inside = diamondContains(ax, ay, w, hh);
    }

    const walkable = inside;

    return {
        wx, wy, tileWorld,
        tx, ty, lx, ly,
        kind, shape,
        floorH,
        h: floorH, // back-compat
        z,
        blocked: false,
        inside,
        walkable,
        reason: inside ? undefined : "OUTSIDE",
    };
}
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

// ─────────────────────────────────────────────────────────────
// STAIRS TOP-FACE HITBOX (skew-friendly)
// Your map-local top space is canonical 128x64.
// But the stair art top face is ~130x80 and slightly skewed.
//
// We solve this by:
//  1) scaling (lx,ly) from 128x64 → 130x80
//  2) testing inside a convex quad (4 points) in that 130x80 space
// ─────────────────────────────────────────────────────────────

type Pt = { x: number; y: number };

export const STAIRS_TOP_W = 128;

// Walkable top-face height (NOT the sprite height)
export const STAIRS_TOP_H = 64;

// Single “feel” knob: shrink inset to avoid edge-snags (tune 0..6)
// IMPORTANT: keep non-negative. Negative expands and causes seam disagreement.
export let STAIRS_TOP_INSET_PX = 0;

// Define the walkable top as a 128x64 diamond in STAIRS pixel space.
// Keep it within [0..128] x [0..64].
export const STAIRS_TOP_QUAD_PX: { p0: Pt; p1: Pt; p2: Pt; p3: Pt } = {
    p0: { x: STAIRS_TOP_W * 0.5, y: 0 },                 // top
    p1: { x: STAIRS_TOP_W,       y: STAIRS_TOP_H * 0.5 },// right
    p2: { x: STAIRS_TOP_W * 0.5, y: STAIRS_TOP_H },      // bottom
    p3: { x: 0,                  y: STAIRS_TOP_H * 0.5 },// left
};

function cross(ax: number, ay: number, bx: number, by: number) {
    return ax * by - ay * bx;
}

function pointInConvexQuad(px: number, py: number, a: Pt, b: Pt, c: Pt, d: Pt) {
    // Convex quad, consistent winding (CW or CCW).
    const ab = cross(b.x - a.x, b.y - a.y, px - a.x, py - a.y);
    const bc = cross(c.x - b.x, c.y - b.y, px - b.x, py - b.y);
    const cd = cross(d.x - c.x, d.y - c.y, px - c.x, py - c.y);
    const da = cross(a.x - d.x, a.y - d.y, px - d.x, py - d.y);

    const hasNeg = (ab < 0) || (bc < 0) || (cd < 0) || (da < 0);
    const hasPos = (ab > 0) || (bc > 0) || (cd > 0) || (da > 0);
    return !(hasNeg && hasPos);
}

function insetQuadTowardCenter(q: { p0: Pt; p1: Pt; p2: Pt; p3: Pt }, inset: number) {
    if (inset <= 0) return q;

    const cx = (q.p0.x + q.p1.x + q.p2.x + q.p3.x) / 4;
    const cy = (q.p0.y + q.p1.y + q.p2.y + q.p3.y) / 4;

    function move(p: Pt): Pt {
        const vx = cx - p.x;
        const vy = cy - p.y;
        const len = Math.hypot(vx, vy) || 1;
        return { x: p.x + (vx / len) * inset, y: p.y + (vy / len) * inset };
    }

    return { p0: move(q.p0), p1: move(q.p1), p2: move(q.p2), p3: move(q.p3) };
}

function stairsTopContainsTopLocal(lx: number, ly: number): boolean {
    const q = insetQuadTowardCenter(STAIRS_TOP_QUAD_PX, STAIRS_TOP_INSET_PX);
    return pointInConvexQuad(lx, ly, q.p0, q.p1, q.p2, q.p3);
}


/**
 * Legacy API preserved.
 * Prefer walkInfo(...).walkable in new code.
 */
export function isWalkableWorld(wx: number, wy: number, tileWorld: number): boolean {
    return walkInfo(wx, wy, tileWorld).walkable;
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

// Same anchor composition as isWalkableWorld
    const aShape = WALK_SHAPE_ANCHOR_PX[shape] ?? { ox: 0, oy: 0 };
    const aKind = WALK_KIND_ANCHOR_PX[t.kind] ?? { ox: 0, oy: 0 };
    const ox = aShape.ox + aKind.ox;
    const oy = aShape.oy + aKind.oy;

    if (t.kind === "STAIRS") {
        // Convert the STAIRS quad (130x80 space) back into top-local (128x64) for debug overlay.
        const sxInv = TOP_W / STAIRS_TOP_W;        // 128/130
        const syInv = TOP_H_FULL / STAIRS_TOP_H;   // 64/80

        const q = insetQuadTowardCenter(STAIRS_TOP_QUAD_PX, STAIRS_TOP_INSET_PX);

        const base = [
            { x: q.p0.x * sxInv, y: q.p0.y * syInv },
            { x: q.p1.x * sxInv, y: q.p1.y * syInv },
            { x: q.p2.x * sxInv, y: q.p2.y * syInv },
            { x: q.p3.x * sxInv, y: q.p3.y * syInv },
        ];

        // Apply same anchor shift as the walk test (diamond/quad is shifted by +ox/+oy)
        const pts = base.map((p) => ({ x: p.x + ox, y: p.y + oy }));
        return { blocked: false, shape, pts };
    }

// Default: diamond outline for non-stairs
    const base = [
        { x: w * 0.5, y: 0 }, // top
        { x: w, y: h * 0.5 }, // right
        { x: w * 0.5, y: h }, // bottom
        { x: 0, y: h * 0.5 }, // left
    ];

    const pts = base.map((p) => ({ x: p.x + ox, y: p.y + oy }));
    return { blocked: false, shape, pts };

}
