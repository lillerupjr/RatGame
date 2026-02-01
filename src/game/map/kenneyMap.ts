// src/game/map/kenneyMap.ts

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
 * OCCLUSION height (render/visibility):
 *
 * In isometric Kenney tiles, the vertical apron of a higher tile visually overlaps
 * a region *south* of that tile. A point can be "under" a higher tile in screen-space
 * before its world position maps into that tile's top-face.
 *
 * This function returns the height of "the tile that can visually cover this point".
 *
 * Tuning knobs:
 * - OCCLUSION_LOOKAHEAD_FRAC: how far "north" we sample (in world units, as a fraction of tileWorld)
 *   to detect the tile whose apron might cover this point.
 */
export let OCCLUSION_LOOKAHEAD_FRAC = 0.50; // 0.50 tile is a good starting point for Kenney apron overlap

import { RAMP_FACES, pointInQuad, rampHeightAt } from "./walkableGeometry";
import {KENNEY_TILE_WORLD} from "../visual/kenneyTiles";

export function heightAtWorld(wx: number, wy: number, tileWorld: number): number {
    // 1. Ramp faces override tiles
    for (const r of RAMP_FACES) {
        if (pointInQuad({ x: wx, y: wy }, r.poly)) {
            return rampHeightAt(r, { x: wx, y: wy });
        }
    }

    // 2. Fallback to tile tops (flat)
    const { tx, ty } = worldToTileTopLocalPx(wx, wy, tileWorld);
    const t = getTile(tx, ty);
    return t ? t.h : 0;
}


/**
 * Occlusion-aware "ceiling" height at a world point.
 *
 * Purpose:
 * - Used for *render-only* hiding (e.g. projectiles going "under" raised tiles).
 * - This intentionally accounts for Kenney tile sprite overhang/apron
 *   by extending the top-face diamond downward in tile-local space.
 *
 * Contract:
 * - Returns the maximum integer tile height (or stairs base height) among nearby tiles
 *   whose (extended) top-face diamond covers this point in screen-projection space.
 * - If nothing occludes, falls back to normal heightAtWorld.
 *
 * Tuning:
 * - Increase OCCLUSION_EXTRA_LOCAL_PX to hide sooner (bigger apron).
 * - Decrease it if bullets hide too aggressively near edges.
 */
export let OCCLUSION_EXTRA_LOCAL_PX = 24;

// How far around the point we search for potential occluders.
// Occluders usually come from tiles "north-ish", but this cheap neighborhood scan
// is robust and still fast (small constant).
export let OCCLUSION_SCAN_RX = 2;
export let OCCLUSION_SCAN_RY = 2;

function localPxForTile(tx: number, ty: number, wx: number, wy: number, tileWorld: number) {
    // Same math as worldToTileTopLocalPx, but relative to an explicit (tx,ty)
    const ox = wx - (tx + 0.5) * tileWorld;
    const oy = wy - (ty + 0.5) * tileWorld;

    const d = worldDeltaToScreen(ox, oy);

    const lx = (d.dx / tileWorld) * 64 + 64;
    const ly = (d.dy / (tileWorld * 0.5)) * 32 + 32;

    return { lx, ly };
}
export function heightAtWorldOcclusion(wx: number, wy: number, tileWorld: number): number {
    const base = heightAtWorld(wx, wy, tileWorld);

    const { tx, ty } = worldToTile(wx, wy, tileWorld);

    let best = base;

    // Scan nearby tiles (including "north" tiles whose apron can occlude south space)
    const rx = Math.max(1, OCCLUSION_SCAN_RX | 0);
    const ry = Math.max(1, OCCLUSION_SCAN_RY | 0);

    for (let yy = ty - ry; yy <= ty + ry; yy++) {
        for (let xx = tx - rx; xx <= tx + rx; xx++) {
            const t = getTile(xx, yy);
            if (t.kind === "VOID") continue;

            // Occlusion height is integer tile height.
            // (Stairs still have base integer h; the ramp is not treated as an overhang ceiling.)
            const th = (t.h | 0);

            // Only care about tiles that are >= current best.
            if (th <= best) continue;

            const { lx, ly } = localPxForTile(xx, yy, wx, wy, tileWorld);

            // Extend the diamond downward to approximate the Kenney sprite apron/overhang.
            // This makes "under platform" hiding happen as soon as the projectile is visually
            // behind the vertical face, not one whole tile later.
            const insideExtended = diamondContains(lx, ly, 128, 64 + Math.max(0, OCCLUSION_EXTRA_LOCAL_PX));

            if (insideExtended) best = th;
        }
    }

    return best;
}

/**
 * Generic visibility query at a world point.
 *
 * This is the “unified occlusion API”:
 * - It always uses the map occlusion ceiling (heightAtWorldOcclusion)
 * - And compares a caller-provided absolute Z against that ceiling
 *
 * If zAbs is below the occlusion ceiling (minus eps), the point is considered occluded.
 */
export type VisibilityQuery = {
    occZ: number;      // integer-ish occlusion ceiling at (wx, wy)
    occluded: boolean; // true if zAbs is under the ceiling (with eps)
};

export function queryVisibilityAtWorld(
    wx: number,
    wy: number,
    zAbs: number,
    tileWorld: number,
    eps = 0
): VisibilityQuery {
    const occZ = heightAtWorldOcclusion(wx, wy, tileWorld);
    return { occZ, occluded: zAbs < occZ - eps };
}

// ---- Segment visibility (for LOS, future enemy vision, etc.) ----
export let VIS_SAMPLE_SPAN_FRAC = 0.10;   // ~10 samples per tile
export let VIS_SAMPLE_MAX_STEPS = 64;
export let VIS_SAMPLE_MIN_STEPS = 1;

/**
 * Returns true if any point along the segment is occluded for the segment's Z.
 * Z is linearly interpolated from (az) to (bz).
 */
export function isOccludedAlongSegment(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    tileWorld: number,
    eps = 0
): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;

    const dist = Math.hypot(dx, dy);
    if (dist <= 1e-6) {
        return queryVisibilityAtWorld(ax, ay, az, tileWorld, eps).occluded;
    }

    const spanFrac = Math.max(1e-4, VIS_SAMPLE_SPAN_FRAC);
    const wantSteps = Math.ceil(dist / (tileWorld * spanFrac));
    const baseSteps = Math.max(1, VIS_SAMPLE_MIN_STEPS | 0);
    const maxSteps = Math.max(1, VIS_SAMPLE_MAX_STEPS | 0);
    const steps = Math.min(maxSteps, Math.max(baseSteps, wantSteps));

    for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = ax + dx * t;
        const y = ay + dy * t;
        const z = az + dz * t;

        if (queryVisibilityAtWorld(x, y, z, tileWorld, eps).occluded) return true;
    }

    return false;
}






// ─────────────────────────────────────────────────────────────
// Phase 1 (decorative stairs): removed stairs-as-gameplay helpers.
// Connectors will replace stairs targeting in Phase 2+.
// ─────────────────────────────────────────────────────────────

export type StairsTarget = never;

/**
 * Phase 1: stairs are decorative only.
 * This helper will be reintroduced as "findNearestConnectorWorld" once connectors exist.
 */
export function findNearestStairsWorld(): null {
    return null;
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
// Phase 2: STAIRS are walkable, so you MAY add STAIRS anchor tweaks here if art needs it.
export const WALK_KIND_ANCHOR_PX: Partial<Record<IsoTileKind, { ox: number; oy: number }>> = {
    // Keep CONVERTER collision perfectly identical to FLOOR.
    // If you ever tune FLOOR anchors, CONVERTER must inherit them.
    CONVERTER: { ox: 0, oy: 0 },
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
        case "CONVERTER":
            return "FULL_TOP";
        case "STAIRS":
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
    tile: IsoTile;      // <-- NEW: full tile record
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
            tile: t,
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

    const inside = diamondContains(ax, ay, w, hh);

    // Walkable if you're inside the top-face diamond.
    // (Stairs are allowed here now.)
    const walkable = inside;

    return {
        wx, wy, tileWorld,
        tx, ty, lx, ly,
        tile: t,
        kind, shape,
        floorH,
        h: floorH, // back-compat
        z,
        blocked: !walkable,
        inside,
        walkable,
        reason: !inside ? "OUTSIDE" : undefined,
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
// Phase 1: removed stairs-walk hitbox helpers.
// Stairs are decorative only until connector volumes exist.



export function isWalkableWorld(wx: number, wy: number): boolean {
    // 1. Ramp faces are always walkable
    for (const r of RAMP_FACES) {
        if (pointInQuad({ x: wx, y: wy }, r.poly)) {
            return true;
        }
    }

    // 2. Tile tops
    const { tx, ty } = worldToTileTopLocalPx(wx, wy, KENNEY_TILE_WORLD);
    const t = getTile(tx, ty);
    return !!t && t.kind !== "VOID";
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
