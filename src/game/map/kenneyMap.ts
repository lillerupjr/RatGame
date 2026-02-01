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
 * Phase 2: STAIRS are walkable and provide SMOOTH ramp Z.
 *
 * Rule:
 * - FLOORS/SPAWN: z = tile.h (integer)
 * - STAIRS with dir: z = baseH + step(0..1) based on position in the tile
 * - STAIRS without dir: treated as flat at baseH
 *
 * NOTE:
 * We use top-face local px (lx,ly) because it matches your iso projection (128x64 box).
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
    // N: increases when moving north (fy ↓)
    // S: increases when moving south (fy ↑)
    // W: increases when moving west  (fx ↓)
    // E: increases when moving east  (fx ↑)
    const dir = (t.dir ?? "N") as any;

    let step = 0;
    if (dir === "N") step = 1 - fy;
    else if (dir === "S") step = fy;
    else if (dir === "W") step = 1 - fx;
    else if (dir === "E") step = fx;

    return baseH + clamp01(step);
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
export const WALK_KIND_ANCHOR_PX: Partial<Record<IsoTileKind, { ox: number; oy: number }>> = {};





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
            // Phase 2: stairs are walkable; treat as a normal top-face diamond.
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

    // Phase 2: STAIRS are walkable (ramp Z comes from heightAtWorld)
    const inside = diamondContains(ax, ay, w, hh);

    // Walkable if you're inside the top-face diamond.
    // (Stairs are allowed here now.)
    const walkable = inside;

    return {
        wx, wy, tileWorld,
        tx, ty, lx, ly,
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
