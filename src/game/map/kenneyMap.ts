// src/game/map/kenneyMap.ts
// Arcane-Sanctuary-style placeholder:
// - deterministic platforms over void
// - multi-height tiles
// - stairs currently exist in the map, but are migrating to CONNECTORS
//
// IMPORTANT: render + movement MUST use the same functions so visuals/collision match.
//
// STAIRS → CONNECTORS migration (Phase 0: contract freeze)
// See: docs/stairs-connectors-master.md
// Phase 1 will delete: ramp math, stair walk masks/hitboxes, movement exceptions, projectile stair coupling.

import {compileKenneyMapFromTable, type IsoTile, type IsoTileKind, STAIR_SKIN_BY_DIR} from "./kenneyMapLoader";
import { EXCEL_SANCTUARY_01 } from "./maps";
import { worldDeltaToScreen } from "../visual/iso";

export type { IsoTileKind, IsoTile } from "./kenneyMapLoader";

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
const _compiled = compileKenneyMapFromTable(EXCEL_SANCTUARY_01);

export function getTile(tx: number, ty: number): IsoTile {
    return _compiled.getTile(tx, ty);
}

/**
 * Map-authored spawn point (tile-space -> world-space center).
 * Uses the first P<number> token found in maps.ts.
 */
export function getSpawnWorld(tileWorld: number): { x: number; y: number; z: number; tx: number; ty: number; h: number } {
    const tx = (_compiled as any).spawnTx ?? 0;
    const ty = (_compiled as any).spawnTy ?? 0;

    const t = getTile(tx, ty);
    const h = (t.h | 0);

    // center of tile in world space
    const x = (tx + 0.5) * tileWorld;
    const y = (ty + 0.5) * tileWorld;

    // floors/spawn => z = h (stairs would be h+step, but we don't recommend spawning mid-ramp)
    const z = h;

    return { x, y, z, tx, ty, h };
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
    const { tx, ty } = worldToTileTopLocalPx(wx, wy, tileWorld);
    const t = getTile(tx, ty);
    const baseH = (t.h | 0);

    if (t.kind !== "STAIRS") return baseH;

    // World-space fractions inside this tile (0..1)
    const fx = (wx - tx * tileWorld) / tileWorld;
    const fy = (wy - ty * tileWorld) / tileWorld;

    // Authoritative ramp direction:
    // N: step increases when moving north (fy ↓)
    // S: step increases when moving south (fy ↑)
    // W: step increases when moving west  (fx ↓)
    // E: step increases when moving east  (fx ↑)
    const dir = (t.dir ?? "N") as any;

    let step = 0;
    if (dir === "N") step = 1 - fy;
    else if (dir === "S") step = fy;
    else if (dir === "W") step = 1 - fx;
    else if (dir === "E") step = fx;
    else step = 1 - fy; // hard fallback

    return baseH + clamp01(step);
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
// Use this to move the *logical walkable face* relative to the 128x64 top-local box.
//
// Positive oy moves the walkable hitbox DOWN (toward the player / screen bottom).
// Negative oy moves it UP (toward screen top).
export const STAIRS_WALK_FACE_OY_PX = 0; // <- tune this (try -6 .. +6)

// (Optional) X nudge too, if you ever need it:
export const STAIRS_WALK_FACE_OX_PX = 0;

export const WALK_KIND_ANCHOR_PX: Partial<Record<IsoTileKind, { ox: number; oy: number }>> = {
    STAIRS: { ox: STAIRS_WALK_FACE_OX_PX, oy: STAIRS_WALK_FACE_OY_PX },
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

export type StairDir = "N" | "W" | "E" | "S";


export function tileWalkShape(tx: number, ty: number): TileWalkShape {
    const t = getTile(tx, ty);
    switch (t.kind) {
        case "VOID":
            return "BLOCKED";
        case "FLOOR":
            return "FULL_TOP";
        case "STAIRS":
            // still a "top" walkable surface; we special-case hitbox test by kind === "STAIRS"
            return "FULL_TOP";
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

    // STAIRS == FLOOR for walk hitbox:
    // Use the same top-face diamond for all walkable kinds.
    const inside = diamondContains(ax, ay, w, hh);
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
