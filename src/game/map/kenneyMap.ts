// src/game/map/kenneyMap.ts
//
// STAIRS → CONNECTORS migration (Phase 0: contract freeze)
// See: docs/stairs-connectors-master.md
// Phase 1 will delete: ramp math, stair walk masks/hitboxes, movement exceptions, projectile stair coupling.

import {
    compileKenneyMapFromTable,
    type IsoTile,
    type IsoTileKind,
    STAIR_SKIN_BY_DIR,
} from "./kenneyMapLoader";
import { EXCEL_SANCTUARY_01 } from "./maps";
import { worldDeltaToScreen } from "../visual/iso";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";

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
export function getSpawnWorld(tileWorld: number): {
    x: number;
    y: number;
    z: number;
    tx: number;
    ty: number;
    h: number;
} {
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

// ─────────────────────────────────────────────────────────────
// Walkable Geometry: Ramp Faces (NEW DIRECTION)
// Movement and height are determined by walkable geometry (tile tops + ramp faces).
// Tile tops are flat discrete surfaces. Ramp faces are continuous connectors.
// ─────────────────────────────────────────────────────────────


export type RampFace = {
    id: string;

    // Convex quad in WORLD (x,y)
    poly: [Pt, Pt, Pt, Pt];

    // Height endpoints
    z0: number;
    z1: number;

    // Optional: debugging / intent
    tag?: string;
};

function dot(ax: number, ay: number, bx: number, by: number) {
    return ax * bx + ay * by;
}
function clamp(v: number, lo: number, hi: number) {
    return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Convex quad containment test (winding-agnostic).
 * Returns true if p is inside or on the boundary.
 */
export function pointInQuad(p: Pt, q: [Pt, Pt, Pt, Pt]): boolean {
    // Cross sign consistency
    let sign = 0;
    for (let i = 0; i < 4; i++) {
        const a = q[i];
        const b = q[(i + 1) & 3];
        const cx = b.x - a.x;
        const cy = b.y - a.y;
        const px = p.x - a.x;
        const py = p.y - a.y;
        const cross = cx * py - cy * px;

        if (Math.abs(cross) < 1e-6) continue;
        const s = cross > 0 ? 1 : -1;
        if (sign === 0) sign = s;
        else if (sign !== s) return false;
    }
    return true;
}

/**
 * Height across a ramp face is defined by projecting onto the axis from low-edge midpoint to high-edge midpoint.
 *
 * Convention:
 * - low edge is (q0,q1) at z0
 * - high edge is (q3,q2) at z1
 * (i.e. t=0 at midpoint(q0,q1), t=1 at midpoint(q3,q2))
 */
export function rampHeightAt(r: RampFace, p: Pt): number {
    const q = r.poly;
    const lowMid = { x: (q[0].x + q[1].x) * 0.5, y: (q[0].y + q[1].y) * 0.5 };
    const highMid = { x: (q[3].x + q[2].x) * 0.5, y: (q[3].y + q[2].y) * 0.5 };

    const ax = highMid.x - lowMid.x;
    const ay = highMid.y - lowMid.y;

    const denom = ax * ax + ay * ay;
    if (denom < 1e-9) return r.z0;

    const px = p.x - lowMid.x;
    const py = p.y - lowMid.y;

    const t = clamp(dot(px, py, ax, ay) / denom, 0, 1);
    return r.z0 + (r.z1 - r.z0) * t;
}

// --- Step 2: first real ramp (Arcane-Sanctuary bridge) ---
// Authored in TILE space, converted to WORLD based on tileWorld.
// We cache per tileWorld so you can tune tileWorld without re-authoring.

const _rampCache = new Map<number, RampFace[]>();

// Build the single “bridge ramp” face used in the Sanctuary placeholder.
// This version adds a fast-debug “corner wiring” system so you can instantly
// swap which corners are used for low/high edges without rewriting the poly.

type Pt = { x: number; y: number };
type CornerKey = "SW" | "SE" | "NE" | "NW";

type CornerPts = Record<CornerKey, Pt>;

type RampCornerWiring = {
    // rampHeightAt convention:
    // - low edge = (q0,q1) at z0
    // - high edge = (q3,q2) at z1
    lowEdge: [CornerKey, CornerKey];   // becomes q0,q1
    highEdge: [CornerKey, CornerKey];  // becomes q3,q2 (NOTE: order matters)
};

const RAMP_WIRING_PRESET: Record<
    | "S->N" | "N->S" | "W->E" | "E->W"
    | "S->N_swapLow" | "S->N_swapHigh"
    | "N->S_swapLow" | "N->S_swapHigh",
    RampCornerWiring
> = {
    // Low = SOUTH edge, High = NORTH edge
    "S->N": { lowEdge: ["SW", "SE"], highEdge: ["NW", "NE"] },
    // Low = NORTH edge, High = SOUTH edge
    "N->S": { lowEdge: ["NW", "NE"], highEdge: ["SW", "SE"] },
    // Low = WEST edge, High = EAST edge
    "W->E": { lowEdge: ["NW", "SW"], highEdge: ["NE", "SE"] },
    // Low = EAST edge, High = WEST edge
    "E->W": { lowEdge: ["NE", "SE"], highEdge: ["NW", "SW"] },

    // Debug variants (swap ordering)
    "S->N_swapLow": { lowEdge: ["SE", "SW"], highEdge: ["NW", "NE"] },
    "S->N_swapHigh": { lowEdge: ["SW", "SE"], highEdge: ["NE", "NW"] },
    "N->S_swapLow": { lowEdge: ["NE", "NW"], highEdge: ["SW", "SE"] },
    "N->S_swapHigh": { lowEdge: ["NW", "NE"], highEdge: ["SE", "SW"] },
};

// Single knob: switch this string to try different corner selections quickly.
export let DEBUG_BRIDGE_RAMP_WIRING: keyof typeof RAMP_WIRING_PRESET = "N->S";

function buildRampPolyFromCorners(
    corners: CornerPts,
    wiring: RampCornerWiring
): [Pt, Pt, Pt, Pt] {
    const [l0, l1] = wiring.lowEdge;
    const [h0, h1] = wiring.highEdge;

    // rampHeightAt convention:
    // q0,q1 = low edge at z0
    // q3,q2 = high edge at z1
    const q0 = corners[l0];
    const q1 = corners[l1];
    const q3 = corners[h0];
    const q2 = corners[h1];

    // Poly order must remain [q0,q1,q2,q3]
    return [q0, q1, q2, q3];
}


type RampConnector = {
    id: string;
    tag?: string;

    // Tile-space endpoints (tops)
    low: { tx: number; ty: number };
    high: { tx: number; ty: number };

    // Which facing edges connect (debug-friendly knob)
    wiring: keyof typeof RAMP_WIRING_PRESET;

    // Optional overrides (otherwise read from tile.h)
    z0Override?: number;
    z1Override?: number;
};

// Author ramps here (tile-space).
// Add your other stair locations as additional connectors.
const RAMP_CONNECTORS: RampConnector[] = [
    {
        id: "sanctuary_bridge_col4_y7to9_0to3",
        tag: "bridge-ramp",
        // Existing one: low at south tile, high at north tile
        low: { tx: -2, ty: 2 },
        high: { tx: -2, ty: 0 },
        wiring: DEBUG_BRIDGE_RAMP_WIRING,
        z0Override: 0, z1Override: 3,
    },

    // TODO: add more ramps here, one per former stair segment.
    // Example template:
    // {
    //   id: "ramp_somewhere",
    //   low: { tx: X0, ty: Y0 },
    //   high:{ tx: X1, ty: Y1 },
    //   wiring: "S->N",
    // },
];

function tileTopCornersWorld(tx: number, ty: number, tileWorld: number): CornerPts {
    // NOTE: these corners describe the FULL tile extents in world.
    // For perfect seam matching, later we can switch this to use the tile’s walk quad.
    const x0 = tx * tileWorld;
    const x1 = (tx + 1) * tileWorld;
    const y0 = ty * tileWorld;
    const y1 = (ty + 1) * tileWorld;

    return {
        NW: { x: x0, y: y0 },
        NE: { x: x1, y: y0 },
        SW: { x: x0, y: y1 },
        SE: { x: x1, y: y1 },
    };
}

function buildRampFaceFromConnector(c: RampConnector, tileWorld: number): RampFace {
    // Heights come from the connected tiles unless overridden.
    const lowTile = getTile(c.low.tx, c.low.ty);
    const highTile = getTile(c.high.tx, c.high.ty);

    const z0 = (c.z0Override ?? (lowTile.h | 0)) as number;
    const z1 = (c.z1Override ?? (highTile.h | 0)) as number;

    // Build a single quad spanning from low tile to high tile.
    // We map SW/SE from the low tile, and NW/NE from the high tile,
    // then use wiring to choose which edge is low/high.
    const lowCorners = tileTopCornersWorld(c.low.tx, c.low.ty, tileWorld);
    const highCorners = tileTopCornersWorld(c.high.tx, c.high.ty, tileWorld);

    const corners: CornerPts = {
        SW: lowCorners.SW,
        SE: lowCorners.SE,
        NW: highCorners.NW,
        NE: highCorners.NE,
    };

    const wiring = RAMP_WIRING_PRESET[c.wiring];

    return {
        id: c.id,
        tag: c.tag ?? `ramp-${c.wiring}`,
        poly: buildRampPolyFromCorners(corners, wiring),
        z0,
        z1,
    };
}

export function buildAllRamps(tileWorld: number): RampFace[] {
    const out: RampFace[] = [];
    for (const c of RAMP_CONNECTORS) {
        out.push(buildRampFaceFromConnector(c, tileWorld));
    }
    return out;
}


function _getRampFaces(tileWorld: number): RampFace[] {
    const key = tileWorld | 0;
    const hit = _rampCache.get(key);
    if (hit) return hit;

    const ramps = buildAllRamps(tileWorld);
    _rampCache.set(key, ramps);
    return ramps;
}

// Debug/render helper: expose the authoritative ramp faces (same ones used by heightAtWorld / walkInfo)
export function getRampFacesForDebug(tileWorld: number): RampFace[] {
    return _getRampFaces(tileWorld);
}


function rampHitAtWorld(wx: number, wy: number, tileWorld: number): { r: RampFace; z: number } | null {
    const p = { x: wx, y: wy };
    const ramps = _getRampFaces(tileWorld);
    for (let i = 0; i < ramps.length; i++) {
        const r = ramps[i];
        if (!pointInQuad(p, r.poly)) continue;
        return { r, z: rampHeightAt(r, p) };
    }
    return null;
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

/**
 * Authoritative height at a world point.
 * NEW RULE: ramps override tiles; tiles are flat.
 */
export function heightAtWorld(wx: number, wy: number, tileWorld: number): number {
    // 1) Walkable geometry (ramps) wins
    const rh = rampHitAtWorld(wx, wy, tileWorld);
    if (rh) return rh.z;

    // 2) Fallback to tile top height (flat)
    const { tx, ty } = worldToTileTopLocalPx(wx, wy, tileWorld);
    const t = getTile(tx, ty);
    return (t.h | 0);
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
 * - Returns the maximum integer tile height among nearby tiles
 *   whose (extended) top-face diamond covers this point in screen-projection space.
 * - If nothing occludes, falls back to normal heightAtWorld.
 *
 * Tuning:
 * - Increase OCCLUSION_EXTRA_LOCAL_PX to hide sooner (bigger apron).
 * - Decrease it if bullets hide too aggressively near edges.
 */
export let OCCLUSION_EXTRA_LOCAL_PX = 24;

// How far around the point we search for potential occluders.
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
            // Ramps are NOT treated as an overhang ceiling.
            const th = (t.h | 0);

            // Only care about tiles that are >= current best.
            if (th <= best) continue;

            const { lx, ly } = localPxForTile(xx, yy, wx, wy, tileWorld);

            // Extend the diamond downward to approximate the Kenney sprite apron/overhang.
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
    occZ: number; // integer-ish occlusion ceiling at (wx, wy)
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
export let VIS_SAMPLE_SPAN_FRAC = 0.10; // ~10 samples per tile
export let VIS_SAMPLE_MAX_STEPS = 64;
export let VIS_SAMPLE_MIN_STEPS = 1;

/**
 * Returns true if any point along the segment is occluded for the segment's Z.
 * Z is linearly interpolated from (az) to (bz).
 */
export function isOccludedAlongSegment(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
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
// ─────────────────────────────────────────────────────────────

export type TileWalkShape = "FULL_TOP" | "BLOCKED" | "BRIDGE_TOP";

const TOP_W = 128;
const TOP_H_FULL = 64;

const BRIDGE_TOP_H = 32; // optional, tune later

// ─────────────────────────────────────────────────────────────
// Anchor offsets (in TOP-LOCAL PIXELS)
// ─────────────────────────────────────────────────────────────

export const WALK_SHAPE_ANCHOR_PX: Record<TileWalkShape, { ox: number; oy: number }> = {
    FULL_TOP: { ox: 0, oy: 0 },
    BRIDGE_TOP: { ox: 0, oy: 0 },
    BLOCKED: { ox: 0, oy: 0 },
};

export const WALK_KIND_ANCHOR_PX: Partial<Record<IsoTileKind, { ox: number; oy: number }>> = {
    // Keep CONVERTER collision perfectly identical to FLOOR.
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
            return "BLOCKED";
        default:
            return "FULL_TOP";
    }
}

// ─────────────────────────────────────────────────────────────
// Milestone B Map API
// ─────────────────────────────────────────────────────────────

export type WalkInfo = {
    // World → tile
    wx: number;
    wy: number;
    tileWorld: number;
    tx: number;
    ty: number;

    // Position inside tile-local top-face px space
    lx: number;
    ly: number;
    isRamp: boolean;
    // Tile definition + derived fields
    tile: IsoTile;
    kind: IsoTileKind;
    shape: TileWalkShape;

    // Integer floor level at this location (used for gating / active floor)
    floorH: number;

    // Back-compat alias (older code expects `.h`)
    h: number;

    // Continuous Z at this location (ramps continuous; tiles flat)
    z: number;

    // Walk decision
    blocked: boolean;
    inside: boolean;
    walkable: boolean;

    reason?: "BLOCKED" | "OUTSIDE";
};

/**
 * Rich walkability info for a world point.
 * This is the map-authoritative query that movement, enemies, and projectiles can share.
 *
 * Includes both:
 * - floorH (integer) for gating
 * - z (float) for continuous ramps
 */
export function walkInfo(wx: number, wy: number, tileWorld: number): WalkInfo {
    const { tx, ty, lx, ly } = worldToTileTopLocalPx(wx, wy, tileWorld);

    // 1) Ramp faces override tiles (walkable even over VOID)
    const rh = rampHitAtWorld(wx, wy, tileWorld);
    if (rh) {
        const z = rh.z;
        const floorH = Math.floor(z + 1e-6);

        // Virtual "tile" record for downstream code that expects tile/kind.
        const virtualTile: IsoTile = { kind: "FLOOR", h: floorH };

        return {
            wx,
            wy,
            tileWorld,
            tx: NaN,
            ty: NaN,
            lx,
            ly,
            tile: virtualTile,
            kind: "FLOOR",
            shape: "FULL_TOP",
            floorH,
            h: floorH,
            z,

            // NEW: mark as ramp surface
            isRamp: true,

            blocked: false,
            inside: true,
            walkable: true,
        };

    }

    // 2) Normal tile-top walking (flat, discrete)
    const t = getTile(tx, ty);
    const kind = t.kind;

    const shape = tileWalkShape(tx, ty);
    const blocked = shape === "BLOCKED" || kind === "VOID";

    // Integer floor level (gating)
    const floorH = tileHeight(tx, ty);

    // Continuous Z (flat tiles)
    const z = floorH;

    if (blocked) {
        return {
            wx,
            wy,
            tileWorld,
            tx,
            ty,
            lx,
            ly,

            isRamp: false,

            tile: t,
            kind,
            shape,
            floorH,
            h: floorH,
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
    const walkable = inside;

    return {
        wx,
        wy,
        tileWorld,
        tx,
        ty,
        lx,
        ly,

        isRamp: false,

        tile: t,
        kind,
        shape,
        floorH,
        h: floorH,
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

// ─────────────────────────────────────────────────────────────
// Legacy API preserved.
// Prefer walkInfo(...).walkable in new code.
// ─────────────────────────────────────────────────────────────

export function isWalkableWorld(wx: number, wy: number, tileWorld: number): boolean {
    // 1) Ramp faces are always walkable
    if (rampHitAtWorld(wx, wy, tileWorld)) return true;

    // 2) Tile tops via walkInfo (includes top-face diamond)
    return walkInfo(wx, wy, tileWorld).walkable;
}

// ─────────────────────────────────────────────────────────────
// DEBUG: outline of the logical walk shape (tile-local top-face px)
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

    // Default: diamond outline
    const base = [
        { x: w * 0.5, y: 0 }, // top
        { x: w, y: h * 0.5 }, // right
        { x: w * 0.5, y: h }, // bottom
        { x: 0, y: h * 0.5 }, // left
    ];

    const pts = base.map((p) => ({ x: p.x + ox, y: p.y + oy }));
    return { blocked: false, shape, pts };
}
