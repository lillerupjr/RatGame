// src/game/map/kenneyMap.ts
//
// STAIRS → CONNECTORS migration (Phase 0: contract freeze)
// See: docs/stairs-connectors-master.md
// Phase 1 will delete: ramp math, stair walk masks/hitboxes, movement exceptions, projectile stair coupling.

import {
    compileKenneyMapFromTable,
    type IsoTile,
    type IsoTileKind,
    type StairDir,
    type RenderPiece,
    type RenderPieceKind,
    type RenderRole,
    type ViewRect,
    type Surface,
    type CompiledKenneyMap,
    type DecalPiece,
} from "./kenneyMapLoader";
import type { TableMapDef } from "../formats/table/tableMapTypes";
import { worldDeltaToScreen, worldToScreen } from "../../../engine/math/iso";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { gridToWorld, worldToGrid } from "../../coords/grid";
import { worldToTile, tileToWorldCenter } from "../../coords/tile";
import { generateFloorMap } from "../generators/proceduralMap";
import { loadTableMapDefFromJson } from "../formats/json/jsonMapLoader";

export type {
    IsoTileKind,
    IsoTile,
    Surface,
    RenderPiece,
    RenderPieceKind,
    RenderRole,
    ViewRect,
    StampOverlay,
    CompiledKenneyMap,
    DecalPiece,
} from "./kenneyMapLoader";
export { worldToTile, tileToWorldCenter };

// Plane tiles are visually 2 units tall; lower their placement by 1 unit.
export const PLANE_TILE_Z_OFFSET = -1;

export type ZRoles = {
    zLogical: number;
    zVisual: number;
};

export type RampSurface = {
    id: string;
    kind: "RAMP_FACE";
    tx: number;
    ty: number;
    zBase: number;
    ramp: RampFace;
};

export type SurfaceLike = Surface | RampSurface;

export type SurfaceHit = {
    surface: SurfaceLike;
    zVisual: number;
    zLogical: number;
    isRamp: boolean;
};

export interface SupportSurface {
    worldX: number;
    worldY: number;
    worldZ: number;
    screenX: number;
    screenY: number;
}


// NOTE: We intentionally do NOT import any authored maps here.
// The active map is set by higher-level game flow (menu/proceduralMapBridge).
let _compiled: CompiledKenneyMap = compileKenneyMapFromTable({
    id: "EMPTY_BOOT",
    w: 1,
    h: 1,
    centerOnZero: true,
    cells: [{ x: 0, y: 0, type: "spawn", z: 0 }], // spawn so systems don’t explode if queried before activation
});
/**
 * Set the active map dynamically (e.g., for procedural generation).
 */
/** Compile and activate a new map definition. */
export function setActiveMap(mapDef: TableMapDef, options?: { runSeed?: number; mapId?: string }): CompiledKenneyMap {
    _compiled = compileKenneyMapFromTable(mapDef, options);
    _rampCache.clear();
    return _compiled;
}

/**
 * Regenerate and set a new procedural map.
 */
/** Generate and activate a new procedural map with a fresh seed. */
export function regenerateProceduralMap(): CompiledKenneyMap {
    const seed = Date.now() >>> 0;
    return setActiveMap(generateFloorMap(seed, 0), { runSeed: seed });
}

/**
 * Get the current compiled map.
 */
/** Return the currently active compiled map. */
export function getActiveMap(): CompiledKenneyMap {
    return _compiled;
}

export function getApronDebugStats(): {
    apronCandidates: number;
    apronScanHits: number;
    apronOwnedByStair: number;
    apronAnyStairHits: number;
    apronSameZHits: number;
    stairDeltaCounts: Array<{ delta: string; count: number }>;
    offsetCountsE: Array<{ offset: string; count: number }>;
    offsetCountsS: Array<{ offset: string; count: number }>;
    pickedOffsetsE: Array<{ offset: string; count: number }>;
    pickedOffsetsS: Array<{ offset: string; count: number }>;
} | null {
    return _compiled.debugApronStats ?? null;
}

/** Fetch a tile by tile-space coordinates. */
export function getTile(tx: number, ty: number): IsoTile {
    return _compiled.getTile(tx, ty);
}

/** Fetch a tile by logical grid coordinates. */
export function getTileAtGrid(gx: number, gy: number, tileWorld: number): IsoTile {
    const { wx, wy } = gridToWorld(gx, gy, tileWorld);
    const { tx, ty } = worldToTile(wx, wy, tileWorld);
    return getTile(tx, ty);
}

/**
 * Map-authored spawn point (tile-space -> world-space center).
 * Uses the first spawn tile found in the compiled map.
 */
export function getSpawnWorld(tileWorld: number): {
    x: number;
    y: number;
    z: number;
    tx: number;
    ty: number;
    h: number;
} {
    const startTx = (_compiled as any).spawnTx ?? 0;
    const startTy = (_compiled as any).spawnTy ?? 0;
    const safe = findSafeSpawnTile(startTx, startTy);
    const tx = safe.tx;
    const ty = safe.ty;

    const t = getTile(tx, ty);
    const h = (t.h | 0);

    // center of tile in world space
    const x = (tx + 0.5) * tileWorld;
    const y = (ty + 0.5) * tileWorld;

    // floors/spawn => z = h (stairs would be h+step, but we don't recommend spawning mid-ramp)
    const z = h;

    return { x, y, z, tx, ty, h };
}

function isSpawnSafe(kind: IsoTileKind): boolean {
    return kind !== "VOID" && kind !== "STAIRS";
}

function clampSpawn(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
}

function findSafeSpawnTile(tx: number, ty: number): { tx: number; ty: number } {
    const minTx = _compiled.originTx;
    const minTy = _compiled.originTy;
    const maxTx = _compiled.originTx + _compiled.width - 1;
    const maxTy = _compiled.originTy + _compiled.height - 1;

    const startTx = clampSpawn(tx, minTx, maxTx);
    const startTy = clampSpawn(ty, minTy, maxTy);
    const startTile = getTile(startTx, startTy);
    if (isSpawnSafe(startTile.kind)) return { tx: startTx, ty: startTy };

    const maxR = Math.max(_compiled.width, _compiled.height);
    for (let r = 1; r <= maxR; r++) {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                const nx = startTx + dx;
                const ny = startTy + dy;
                if (nx < minTx || nx > maxTx || ny < minTy || ny > maxTy) continue;
                const tile = getTile(nx, ny);
                if (isSpawnSafe(tile.kind)) return { tx: nx, ty: ny };
            }
        }
    }

    return { tx: startTx, ty: startTy };
}

/**
 * Keep old name for compatibility: "hole" == "void".
 */
export function isHoleTile(tx: number, ty: number): boolean {
    return getTile(tx, ty).kind === "VOID";
}

/** Return true if the tile is a stairs tile. */
export function isStairsTile(tx: number, ty: number): boolean {
    return getTile(tx, ty).kind === "STAIRS";
}

/**
 * Integer height level for this tile (0/1/2...).
 */
export function tileHeight(tx: number, ty: number): number {
    return getTile(tx, ty).h | 0;
}

/** Return height at a logical grid position. */
export function heightAtGrid(gx: number, gy: number, tileWorld: number): number {
    const { wx, wy } = gridToWorld(gx, gy, tileWorld);
    return heightAtWorld(wx, wy, tileWorld);
}

/** Return all authored surfaces at a tile coordinate. */
export function surfacesAtXY(tx: number, ty: number): Surface[] {
    return _compiled.surfacesAtXY(tx, ty);
}

/**
 * Highest walkable support surface at a world position.
 * Walkable order: authored/synthetic walkable tops first, then base terrain, then z=0 fallback.
 */
export function getSupportSurfaceAt(
    worldX: number,
    worldY: number,
    compiledMap: CompiledKenneyMap,
): SupportSurface {
    const tx = Math.floor(worldX / KENNEY_TILE_WORLD);
    const ty = Math.floor(worldY / KENNEY_TILE_WORLD);

    const surfaces = compiledMap.surfacesAtXY(tx, ty);
    let worldZ = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < surfaces.length; i++) {
        const s = surfaces[i];
        if (s.tile.kind === "VOID") continue;
        if (s.zBase > worldZ) worldZ = s.zBase;
    }

    if (!Number.isFinite(worldZ)) {
        const tile = compiledMap.getTile(tx, ty);
        worldZ = tile.kind === "VOID" ? 0 : (tile.h | 0);
    }

    const p = worldToScreen(worldX, worldY);
    const ELEV_PX = 16;
    return {
        worldX,
        worldY,
        worldZ,
        screenX: p.x,
        screenY: p.y - worldZ * ELEV_PX,
    };
}

/** Return top surfaces for a logical layer. */
export function topsForLayer(layer: number): Surface[] {
    return _compiled.topsByLayer.get(layer) ?? [];
}

/** Return every logical layer index that has at least one top surface. */
export function topLayers(): number[] {
    const ks = Array.from(_compiled.topsByLayer.keys());
    ks.sort((a, b) => a - b);
    return ks;
}

/** Return occluders for a logical layer. */
export function occludersForLayer(layer: number): RenderPiece[] {
    return _compiled.occludersForLayer(layer);
}

/** Return occluders within a tile-bounds view for a logical layer. */
export function occludersInViewForLayer(layer: number, view: ViewRect): RenderPiece[] {
    return _compiled.occludersInViewForLayer(layer, view);
}

/** Return non-wall face pieces for a logical layer. */
export function facePiecesForLayer(layer: number): RenderPiece[] {
    return _compiled.facePiecesForLayer(layer);
}

/** Return non-wall face pieces within a tile-bounds view for a logical layer. */
export function facePiecesInViewForLayer(layer: number, view: ViewRect): RenderPiece[] {
    return _compiled.facePiecesInViewForLayer(layer, view);
}

/** Return overlays within a tile-bounds view. */
export function overlaysInView(view: ViewRect) {
    return _compiled.overlaysInView(view);
}

/** Return semantic decal pieces within a tile-bounds view. */
export function decalsInView(view: ViewRect): DecalPiece[] {
    return _compiled.decalsInView(view);
}

/** Return every logical layer index that has at least one occluder. */
export function occluderLayers(): number[] {
    const ks = Array.from(_compiled.occludersByLayer.keys());
    ks.sort((a, b) => a - b);
    return ks;
}

/** Return every logical layer index that has at least one non-wall face piece. */
export function facePieceLayers(): number[] {
    const ks = Array.from(_compiled.facePiecesByLayer.keys());
    ks.sort((a, b) => a - b);
    return ks;
}

/** Return logical layers relevant for rendering (tops + faces + occluders). */
export function renderLayers(): number[] {
    const layerSet = new Set<number>();
    for (const h of topLayers()) layerSet.add(h);
    for (const h of facePieceLayers()) layerSet.add(h);
    for (const h of occluderLayers()) layerSet.add(h);
    const layers = Array.from(layerSet);
    layers.sort((a, b) => a - b);
    return layers;
}

/** Return true if a solid wall face exists on a tile edge at a logical layer. */
export function solidFace(tx: number, ty: number, zLogical: number, dir: "N" | "E" | "S" | "W"): boolean {
    return _compiled.solidFace(tx, ty, zLogical, dir);
}

/** Return solid faces within a tile-bounds view (for debug). */
export function solidFacesInView(view: ViewRect) {
    return _compiled.solidFacesInView(view);
}

/** Return tile-bounds view rect around a world position. */
export function viewRectFromWorldCenter(
    wx: number,
    wy: number,
    tileWorld: number,
    paddingTiles: number,
    aspect?: number,
): ViewRect {
    const cx = Math.floor(wx / tileWorld);
    const cy = Math.floor(wy / tileWorld);
    const pad = Math.max(0, Math.floor(paddingTiles));
    const a = Number.isFinite(aspect as any) && (aspect as number) > 0 ? (aspect as number) : 0;

    if (!a) {
        return {
            minTx: cx - pad,
            maxTx: cx + pad,
            minTy: cy - pad,
            maxTy: cy + pad,
        };
    }

    let halfW = pad;
    let halfH = pad;
    if (a >= 1) {
        halfW = Math.max(1, Math.round(pad * a));
        halfH = pad;
    } else {
        halfW = pad;
        halfH = Math.max(1, Math.round(pad / a));
    }

    return {
        minTx: cx - halfW,
        maxTx: cx + halfW,
        minTy: cy - halfH,
        maxTy: cy + halfH,
    };
}
type SurfaceHitOptions = {
    includeBlocked?: boolean;
    requireInside?: boolean;
};

function localPxForTile(tx: number, ty: number, wx: number, wy: number, tileWorld: number) {
    const ox = wx - (tx + 0.5) * tileWorld;
    const oy = wy - (ty + 0.5) * tileWorld;
    const d = worldDeltaToScreen(ox, oy);
    const lx = (d.dx / tileWorld) * 64 + 64;
    const ly = (d.dy / (tileWorld * 0.5)) * 32 + 32;
    return { lx, ly };
}

function logicalLayerFromZ(z: number): number {
    return Math.ceil(z - 1e-6);
}

function tileSurfaceHitAtWorld(
    surface: Surface,
    wx: number,
    wy: number,
    tileWorld: number,
    options: SurfaceHitOptions
): SurfaceHit | null {
    if (surface.kind !== "TILE_TOP") return null;
    if (surface.tile.kind === "VOID") return null;

    const includeBlocked = options.includeBlocked ?? false;
    const requireInside = options.requireInside ?? true;

    const shape = tileWalkShape(surface.tx, surface.ty);
    if (!includeBlocked && shape === "BLOCKED") return null;
    if (requireInside && shape === "BLOCKED") return null;

    if (requireInside) {
        const { lx, ly } = localPxForTile(surface.tx, surface.ty, wx, wy, tileWorld);
        const { w, h: hh } = shapeDims(shape);
        const aShape = WALK_SHAPE_ANCHOR_PX[shape] ?? { ox: 0, oy: 0 };
        const aKind = WALK_KIND_ANCHOR_PX[surface.tile.kind] ?? { ox: 0, oy: 0 };
        const ax = lx - (aShape.ox + aKind.ox);
        const ay = ly - (aShape.oy + aKind.oy);
        if (!diamondContains(ax, ay, w, hh)) return null;
    }

    const zVisual = surface.zBase;
    return {
        surface,
        zVisual,
        zLogical: surface.zLogical,
        isRamp: false,
    };
}

function rampSurfaceHitAtWorld(
    wx: number,
    wy: number,
    tileWorld: number
): SurfaceHit | null {
    const rh = rampHitAtWorld(wx, wy, tileWorld);
    if (!rh) return null;

    const { tx, ty } = worldToTile(wx, wy, tileWorld);
    const zVisual = rh.z;
    const zBase = Math.min(rh.r.z0, rh.r.z1);

    const surface: RampSurface = {
        id: rh.r.id,
        kind: "RAMP_FACE",
        tx,
        ty,
        zBase,
        ramp: rh.r,
    };

    return {
        surface,
        zVisual,
        zLogical: logicalLayerFromZ(zVisual),
        isRamp: true,
    };
}

function collectSurfaceHitsAtWorld(
    wx: number,
    wy: number,
    tileWorld: number,
    options: SurfaceHitOptions
): SurfaceHit[] {
    const hits: SurfaceHit[] = [];

    const rampHit = rampSurfaceHitAtWorld(wx, wy, tileWorld);
    if (rampHit) hits.push(rampHit);

    const { tx, ty } = worldToTile(wx, wy, tileWorld);
    const surfaces = surfacesAtXY(tx, ty);
    for (let i = 0; i < surfaces.length; i++) {
        const hit = tileSurfaceHitAtWorld(surfaces[i], wx, wy, tileWorld, options);
        if (hit) hits.push(hit);
    }

    return hits;
}

/** Return the best surface hit at a world position. */
export function surfaceHitAtWorld(
    wx: number,
    wy: number,
    tileWorld: number,
    hintZ?: number,
    options: SurfaceHitOptions = {}
): SurfaceHit | null {
    const hits = collectSurfaceHitsAtWorld(wx, wy, tileWorld, options);
    if (hits.length === 0) return null;

    if (Number.isFinite(hintZ)) {
        let best = hits[0];
        let bestDist = Math.abs(best.zVisual - (hintZ as number));
        for (let i = 1; i < hits.length; i++) {
            const h = hits[i];
            const dist = Math.abs(h.zVisual - (hintZ as number));
            if (dist < bestDist || (dist === bestDist && h.zVisual > best.zVisual)) {
                best = h;
                bestDist = dist;
            }
        }
        return best;
    }

    let best = hits[0];
    for (let i = 1; i < hits.length; i++) {
        const h = hits[i];
        if (h.zVisual > best.zVisual) best = h;
    }
    return best;
}

/** Return the surface at a world position (walkable surfaces only). */
export function surfaceAtWorld(
    wx: number,
    wy: number,
    tileWorld: number,
    hintZ?: number
): SurfaceLike | null {
    const hit = surfaceHitAtWorld(wx, wy, tileWorld, hintZ, {
        includeBlocked: false,
        requireInside: true,
    });
    return hit ? hit.surface : null;
}

/** Return the nearest surface at or below the given Z. */
export function surfaceBelow(
    wx: number,
    wy: number,
    z: number,
    tileWorld: number
): SurfaceLike | null {
    const hits = collectSurfaceHitsAtWorld(wx, wy, tileWorld, {
        includeBlocked: false,
        requireInside: true,
    });
    let best: SurfaceHit | null = null;
    for (let i = 0; i < hits.length; i++) {
        const h = hits[i];
        if (h.zVisual <= z + 1e-6 && (!best || h.zVisual > best.zVisual)) {
            best = h;
        }
    }
    return best ? best.surface : null;
}

/** Return the nearest surface at or above the given Z. */
export function surfaceAbove(
    wx: number,
    wy: number,
    z: number,
    tileWorld: number
): SurfaceLike | null {
    const hits = collectSurfaceHitsAtWorld(wx, wy, tileWorld, {
        includeBlocked: false,
        requireInside: true,
    });
    let best: SurfaceHit | null = null;
    for (let i = 0; i < hits.length; i++) {
        const h = hits[i];
        if (h.zVisual >= z - 1e-6 && (!best || h.zVisual < best.zVisual)) {
            best = h;
        }
    }
    return best ? best.surface : null;
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
function clampRange(v: number, lo: number, hi: number) {
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
/** Return interpolated height at a point on a ramp face. */
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

    const t = clampRange(dot(px, py, ax, ay) / denom, 0, 1);
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


function tileTopCornersWorld(tx: number, ty: number, tileWorld: number): Record<CornerKey, Pt> {
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


type StairTileRec = { tx: number; ty: number; h: number; dir: StairDir };

function stairDirToDelta(dir: StairDir): { dx: number; dy: number } {
    switch (dir) {
        case "N": return { dx: 0, dy: -1 };
        case "S": return { dx: 0, dy: 1 };
        case "W": return { dx: -1, dy: 0 };
        case "E": return { dx: 1, dy: 0 };
        default:  return { dx: 0, dy: -1 };
    }
}

function flipStairDir(dir: StairDir): StairDir {
    switch (dir) {
        case "N": return "S";
        case "S": return "N";
        case "E": return "W";
        case "W": return "E";
        default: return "N";
    }
}

function stairDirToWiring(dir: StairDir): keyof typeof RAMP_WIRING_PRESET {
    // Direction meaning: “up” along that dir.
    // So N means low at SOUTH edge, high at NORTH edge, etc.
    switch (dir) {
        case "N": return "S->N";
        case "S": return "N->S";
        case "E": return "W->E";
        case "W": return "E->W";
        default:  return "S->N";
    }
}

function buildStaircaseRamps(tileWorld: number): RampFace[] {
    const out: RampFace[] = [];

    // Use compiled map's actual dimensions
    const minTx = _compiled.originTx;
    const minTy = _compiled.originTy;
    const maxTx = _compiled.originTx + _compiled.width - 1;
    const maxTy = _compiled.originTy + _compiled.height - 1;

    const visited = new Set<string>();

    function key(tx: number, ty: number) {
        return `${tx},${ty}`;
    }

    function readStair(tx: number, ty: number): StairTileRec | null {
        const t = getTile(tx, ty);
        if (t.kind !== "STAIRS") return null;
        const dir = flipStairDir((t.dir ?? "N") as StairDir);
        return { tx, ty, h: (t.h | 0), dir };
    }

    for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
            const s0 = readStair(tx, ty);
            if (!s0) continue;

            // If we've already consumed this tile into a staircase, skip.
            if (visited.has(key(tx, ty))) continue;

            const dir = s0.dir;
            const { dx, dy } = stairDirToDelta(dir);

            // Walk backwards to find the "start" of this staircase run.
            // We treat a run as adjacent STAIRS with SAME dir and CONSECUTIVE heights.
            let start = s0;
            while (true) {
                const px = start.tx - dx;
                const py = start.ty - dy;
                const prev = readStair(px, py);
                if (!prev) break;
                if (prev.dir !== dir) break;

                // Require consecutive heights (prev is one step lower)
                if ((prev.h | 0) !== ((start.h | 0) - 1)) break;

                start = prev;
            }

            // Walk forward to collect the full run.
            const tiles: StairTileRec[] = [];
            let cur = start;
            while (true) {
                const k = key(cur.tx, cur.ty);
                if (visited.has(k)) break; // safety
                visited.add(k);
                tiles.push(cur);

                const nx = cur.tx + dx;
                const ny = cur.ty + dy;
                const next = readStair(nx, ny);
                if (!next) break;
                if (next.dir !== dir) break;

                // Require consecutive heights (next is one step higher)
                if ((next.h | 0) !== ((cur.h | 0) + 1)) break;

                cur = next;
            }

            if (tiles.length <= 0) continue;

            const low = tiles[0];
            const high = tiles[tiles.length - 1];

            // Ramp endpoints:
            // low tile contributes z0 at its “low edge”
            // high tile contributes z1 at its “high edge”
            const z0 = low.h | 0;
            const z1 = (high.h | 0) -1;

            const wiringKey = stairDirToWiring(dir);
            const wiring = RAMP_WIRING_PRESET[wiringKey];

            const lowCorners = tileTopCornersWorld(low.tx, low.ty, tileWorld);
            const highCorners = tileTopCornersWorld(high.tx, high.ty, tileWorld);

            const [l0, l1] = wiring.lowEdge;
            const [h0, h1] = wiring.highEdge;

            // rampHeightAt convention:
            // q0,q1 = low edge at z0
            // q3,q2 = high edge at z1
            const q0 = lowCorners[l0];
            const q1 = lowCorners[l1];
            const q3 = highCorners[h0];
            const q2 = highCorners[h1];

            const id =
                `staircase_${dir}_${low.tx}_${low.ty}_len${tiles.length}_h${z0}_to_${z1}`;

            out.push({
                id,
                tag: "staircase",
                poly: [q0, q1, q2, q3],
                z0,
                z1,
            });
        }
    }

    return out;
}

function buildSemanticRamps(tileWorld: number): RampFace[] {
    const out: RampFace[] = [];
    const rects = _compiled.roadSemanticRects ?? [];
    for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        const semantic = r.semantic?.trim().toLowerCase() ?? "";
        if (!(semantic === "ramp" || semantic.startsWith("ramp_"))) continue;
        const dir = r.dir;
        if (dir !== "N" && dir !== "E" && dir !== "S" && dir !== "W") continue;
        const w = Math.max(1, r.w | 0);
        const h = Math.max(1, r.h | 0);
        const minX = r.x | 0;
        const minY = r.y | 0;
        const maxX = minX + w - 1;
        const maxY = minY + h - 1;
        const startH = Number.isFinite(r.startHeight) ? (r.startHeight as number) : (_compiled.getTile(minX, minY).h | 0);
        const targetH = Number.isFinite(r.targetHeight) ? (r.targetHeight as number) : startH;
        const corners = {
            SW: { x: minX * tileWorld, y: (maxY + 1) * tileWorld },
            SE: { x: (maxX + 1) * tileWorld, y: (maxY + 1) * tileWorld },
            NE: { x: (maxX + 1) * tileWorld, y: minY * tileWorld },
            NW: { x: minX * tileWorld, y: minY * tileWorld },
        } as const;
        const wiringKey = stairDirToWiring(dir as StairDir);
        const wiring = RAMP_WIRING_PRESET[wiringKey];
        const [l0, l1] = wiring.lowEdge;
        const [h0, h1] = wiring.highEdge;
        const q0 = corners[l0];
        const q1 = corners[l1];
        const q3 = corners[h0];
        const q2 = corners[h1];
        out.push({
            id: `semantic_ramp_${i}_${minX}_${minY}_${w}x${h}_${dir}_${startH}_${targetH}`,
            tag: "semantic_ramp",
            poly: [q0, q1, q2, q3],
            z0: startH,
            z1: targetH,
        });
    }
    return out;
}

function buildAllRamps(tileWorld: number): RampFace[] {
    const out: RampFace[] = [];

    // 1) Semantic ramps from authored map data.
    out.push(...buildSemanticRamps(tileWorld));

    // 2) Auto staircases (one combined polygon per run)
    out.push(...buildStaircaseRamps(tileWorld));

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
/** Return ramp faces for debugging overlays and queries. */
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
 * Authoritative height at a world point.
 * NEW RULE: ramps override tiles; tiles are flat.
 */
export function heightAtWorld(
    wx: number,
    wy: number,
    tileWorld: number,
    hintZ?: number
): number {
    if (Number.isFinite(hintZ)) {
        const hit = surfaceHitAtWorld(wx, wy, tileWorld, hintZ, {
            includeBlocked: true,
            requireInside: false,
        });
        if (hit) return hit.zVisual;
    }

    // 1) Walkable geometry (ramps) wins
    const rh = rampHitAtWorld(wx, wy, tileWorld);
    if (rh) return rh.z;

    // 2) Fallback to tile top height (flat)
    const { tx, ty } = worldToTileTopLocalPx(wx, wy, tileWorld);
    const t = getTile(tx, ty);
    return (t.h | 0);
}


// ─────────────────────────────────────────────────────────────
// Phase 1 (decorative stairs): removed stairs-as-gameplay helpers.
// Connectors will replace stairs targeting in Phase 2+.
// ─────────────────────────────────────────────────────────────

/**
 * Convert world position -> tile coords + tile-local top-face pixels (lx,ly).
 *
 * NOTE:
 * - world coords are your "flat 2D" simulation coords.
 * - we use worldDeltaToScreen to derive the iso-projected offset inside the tile.
 * - then we map that projected offset into the canonical top-face box: 128x64.
 */
function worldToTileTopLocalPx(wx: number, wy: number, tileWorld: number) {
    const { tx, ty } = worldToTile(wx, wy, tileWorld);

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

function tileWalkShapeFromTile(t: IsoTile): TileWalkShape {
    switch (t.kind) {
        case "VOID":
            return "BLOCKED";
        case "FLOOR":
            return "FULL_TOP";
        case "STAIRS":
            return "BLOCKED";
        default:
            return "FULL_TOP";
    }
}

/** Return the walkable top-face shape for a tile. */
export function tileWalkShape(tx: number, ty: number): TileWalkShape {
    if (_compiled.blockedTiles?.has(`${tx},${ty}`)) return "BLOCKED";
    const t = getTile(tx, ty);
    return tileWalkShapeFromTile(t);
}

export function blockedTilesInView(view: ViewRect): Array<{ tx: number; ty: number }> {
    const out: Array<{ tx: number; ty: number }> = [];
    if (!_compiled.blockedTiles || _compiled.blockedTiles.size === 0) return out;
    for (const key of _compiled.blockedTiles) {
        const parts = key.split(",");
        const tx = Number(parts[0]);
        const ty = Number(parts[1]);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
        if (tx < view.minTx || tx > view.maxTx || ty < view.minTy || ty > view.maxTy) continue;
        out.push({ tx, ty });
    }
    return out;
}

/** Return true if the compiled semantic road area mask marks this tile as road. */
export function isRoadAreaTile(tx: number, ty: number): boolean {
    const lx = tx - _compiled.originTx;
    const ly = ty - _compiled.originTy;
    if (lx < 0 || ly < 0 || lx >= _compiled.width || ly >= _compiled.height) return false;
    const idx = ly * _compiled.width + lx;
    return _compiled.roadAreaMaskWorld[idx] === 1;
}

/** Return Stage-1 road context road mask at tile (0/1). */
export function roadContextIsRoadAt(tx: number, ty: number): number {
    const lx = tx - _compiled.originTx;
    const ly = ty - _compiled.originTy;
    if (lx < 0 || ly < 0 || lx >= _compiled.width || ly >= _compiled.height) return 0;
    const idx = ly * _compiled.width + lx;
    return _compiled.roadMarkingContext.isRoad[idx] | 0;
}

/** Return Stage-1 road context axis code (0=NONE, 1=EW, 2=NS). */
export function roadContextAxisAt(tx: number, ty: number): number {
    const lx = tx - _compiled.originTx;
    const ly = ty - _compiled.originTy;
    if (lx < 0 || ly < 0 || lx >= _compiled.width || ly >= _compiled.height) return 0;
    const idx = ly * _compiled.width + lx;
    return _compiled.roadMarkingContext.axis[idx] | 0;
}

/** Return true if tile is part of the semantic road centerline mask. */
export function isRoadCenterTile(tx: number, ty: number): boolean {
    const lx = tx - _compiled.originTx;
    const ly = ty - _compiled.originTy;
    if (lx < 0 || ly < 0 || lx >= _compiled.width || ly >= _compiled.height) return false;
    const idx = ly * _compiled.width + lx;
    return _compiled.roadCenterMaskWorld[idx] === 1;
}

/** Return semantic road width for centerline tiles (0 for non-center tiles). */
export function roadCenterWidthAt(tx: number, ty: number): number {
    const lx = tx - _compiled.originTx;
    const ly = ty - _compiled.originTy;
    if (lx < 0 || ly < 0 || lx >= _compiled.width || ly >= _compiled.height) return 0;
    const idx = ly * _compiled.width + lx;
    return _compiled.roadCenterWidthWorld[idx] | 0;
}

/** Return true if tile is part of the semantic road intersection mask. */
export function isRoadIntersectionTile(tx: number, ty: number): boolean {
    const lx = tx - _compiled.originTx;
    const ly = ty - _compiled.originTy;
    if (lx < 0 || ly < 0 || lx >= _compiled.width || ly >= _compiled.height) return false;
    const idx = ly * _compiled.width + lx;
    return _compiled.roadIntersectionMaskWorld[idx] === 1;
}

/** Return true if tile is part of the semantic road crossing-halo mask. */
export function isRoadCrossingTile(tx: number, ty: number): boolean {
    const lx = tx - _compiled.originTx;
    const ly = ty - _compiled.originTy;
    if (lx < 0 || ly < 0 || lx >= _compiled.width || ly >= _compiled.height) return false;
    const idx = ly * _compiled.width + lx;
    return (_compiled.roadCrossingMaskWorld?.[idx] ?? 0) === 1;
}

/** Return true if tile is part of the semantic road stop-bar mask. */
export function isRoadStopTile(tx: number, ty: number): boolean {
    const lx = tx - _compiled.originTx;
    const ly = ty - _compiled.originTy;
    if (lx < 0 || ly < 0 || lx >= _compiled.width || ly >= _compiled.height) return false;
    const idx = ly * _compiled.width + lx;
    return (_compiled.roadStopMaskWorld?.[idx] ?? 0) === 1;
}

/** Return crossing direction (0=NONE, 1=N, 2=E, 3=S, 4=W). */
export function roadCrossingDirAt(tx: number, ty: number): number {
    const lx = tx - _compiled.originTx;
    const ly = ty - _compiled.originTy;
    if (lx < 0 || ly < 0 || lx >= _compiled.width || ly >= _compiled.height) return 0;
    const idx = ly * _compiled.width + lx;
    return _compiled.roadCrossingDirWorld?.[idx] ?? 0;
}

/** Return stop-bar direction (0=NONE, 1=N, 2=E, 3=S, 4=W). */
export function roadStopDirAt(tx: number, ty: number): number {
    const lx = tx - _compiled.originTx;
    const ly = ty - _compiled.originTy;
    if (lx < 0 || ly < 0 || lx >= _compiled.width || ly >= _compiled.height) return 0;
    const idx = ly * _compiled.width + lx;
    return _compiled.roadStopDirWorld?.[idx] ?? 0;
}

/** Return representative intersection seeds used by compile-time intersection stamping. */
export function roadIntersectionSeedsDebug(): Array<{ tx: number; ty: number }> {
    return _compiled.roadIntersectionSeedsWorld ?? [];
}

/** Return one deterministic center tile per intersection component. */
export function roadIntersectionCentersDebug(): Array<{ tx: number; ty: number }> {
    return _compiled.roadIntersectionCenterTilesWorld ?? [];
}

/** Return intersection component bounds in world tile coordinates. */
export function roadIntersectionBoundsDebug(): Array<{ minX: number; maxX: number; minY: number; maxY: number }> {
    return _compiled.roadIntersectionBoundsWorld ?? [];
}

/** Return overlap-cluster bbox centers for intersection seeds (world-space). */
export function roadIntersectionClusterCentersDebug(): Array<{ worldX: number; worldY: number }> {
    return _compiled.roadIntersectionClusterCentersWorld ?? [];
}

/** Return semantic road width for any road area tile (0 for non-road tiles). */
export function roadAreaWidthAt(tx: number, ty: number): number {
    const lx = tx - _compiled.originTx;
    const ly = ty - _compiled.originTy;
    if (lx < 0 || ly < 0 || lx >= _compiled.width || ly >= _compiled.height) return 0;
    const idx = ly * _compiled.width + lx;
    return _compiled.roadAreaWidthWorld[idx] | 0;
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

    // Explicit Z roles
    zLogical: number;
    zVisual: number;

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
/** Return walkability and height info for a world position. */
export function walkInfo(wx: number, wy: number, tileWorld: number, hintZ?: number): WalkInfo {
    const { tx, ty, lx, ly } = worldToTileTopLocalPx(wx, wy, tileWorld);

    // 1) Ramp faces override tiles (walkable even over VOID)
    const rh = rampHitAtWorld(wx, wy, tileWorld);
    if (rh) {
        const z = rh.z;
        const floorH = logicalLayerFromZ(z);

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
            zLogical: floorH,
            zVisual: z,

            // NEW: mark as ramp surface
            isRamp: true,

            blocked: false,
            inside: true,
            walkable: true,
        };

    }

    // 2) Normal tile-top walking (flat, discrete)
    const surfaces = surfacesAtXY(tx, ty);
    let selectedSurface: Surface | null = null;
    if (surfaces.length > 0) {
        let best = surfaces[0];
        if (Number.isFinite(hintZ)) {
            let bestDist = Math.abs(best.zBase - (hintZ as number));
            for (let i = 1; i < surfaces.length; i++) {
                const s = surfaces[i];
                const dist = Math.abs(s.zBase - (hintZ as number));
                if (dist < bestDist || (dist === bestDist && s.zBase > best.zBase)) {
                    best = s;
                    bestDist = dist;
                }
            }
        } else {
            for (let i = 1; i < surfaces.length; i++) {
                const s = surfaces[i];
                if (s.zBase > best.zBase) best = s;
            }
        }
        selectedSurface = best;
    }

    const t = selectedSurface?.tile ?? getTile(tx, ty);
    const kind = t.kind;

    const shape = tileWalkShape(tx, ty);
    const blocked = shape === "BLOCKED" || kind === "VOID";

    // Integer floor level (gating)
    const floorH = selectedSurface ? selectedSurface.zBase : (t.h | 0);

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
            zLogical: floorH,
            zVisual: z,
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
        zLogical: floorH,
        zVisual: z,
        blocked: !walkable,
        inside,
        walkable,
        reason: !inside ? "OUTSIDE" : undefined,
    };

}

/** Return walkability info for a logical grid position. */
export function walkInfoGrid(gx: number, gy: number, tileWorld: number, hintZ?: number): WalkInfo {
    const { wx, wy } = gridToWorld(gx, gy, tileWorld);
    return walkInfo(wx, wy, tileWorld, hintZ);
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
// DEBUG: outline of the logical walk shape (tile-local top-face px)
// ─────────────────────────────────────────────────────────────

export type WalkOutlineLocal = {
    blocked: boolean;
    shape: TileWalkShape;
    pts: Array<{ x: number; y: number }>; // closed by renderer
};

/** Return the walk-shape outline in tile-local pixel coordinates. */
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
