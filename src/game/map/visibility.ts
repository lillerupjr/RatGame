// src/game/map/visibility.ts
//
// Generic “visibility / occlusion” queries built on top of the map's occlusion height.
//
// Why this exists:
// - Projectiles currently call heightAtWorldOcclusion directly.
// - Future systems (LOS, connectors, enemy vision, shadow/decal placement)
//   should all consume ONE shared visibility primitive instead of re-implementing
//   sampling, epsilon rules, and stepping.
//
// Contract:
// - Occlusion is a *ceiling/top-face* concept (integer heights + apron extension).
// - Stairs ramps do not create ceilings; the occlusion height model already enforces this.

import { heightAtWorldOcclusion } from "./kenneyMap";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";

// How far below occlusion ceiling counts as "under"
// Smaller = hides/blocks sooner, larger = later
export let VISIBILITY_BELOW_CEILING_EPS = 0.02;

// Sampling controls for segment queries (LOS etc.)
export let VISIBILITY_SEGMENT_SPAN_FRAC = 0.10; // ~10 samples per tile traveled
export let VISIBILITY_SEGMENT_MAX_STEPS = 32;
export let VISIBILITY_SEGMENT_BASE_STEPS = 1;

/** Convenience wrapper so call sites don't need to know which map fn provides occlusion. */
export function occlusionHeightAtWorld(wx: number, wy: number, tileWorld: number = KENNEY_TILE_WORLD): number {
    return heightAtWorldOcclusion(wx, wy, tileWorld);
}

/**
 * Returns true if a point at absolute height `pzAbs` is visually "under" an occluding ceiling.
 * This is the *generic* predicate that future systems should share.
 */
export function isUnderOcclusionCeiling(
    wx: number,
    wy: number,
    pzAbs: number,
    tileWorld: number = KENNEY_TILE_WORLD,
    eps: number = VISIBILITY_BELOW_CEILING_EPS
): boolean {
    const occZ = occlusionHeightAtWorld(wx, wy, tileWorld);
    return pzAbs < occZ - eps;
}

/**
 * Generic occlusion test along a segment in world space.
 *
 * Use-cases:
 * - Line-of-sight: enemy -> player
 * - “Can I see/shoot this?” gating
 * - Shadow/decal projection constraints
 *
 * Notes:
 * - This is *ceiling-based* occlusion, not “wall” collision.
 * - We sample in world space using distance-adaptive stepping, consistent with projectile sampling.
 */
/** Return true if any sample along the segment is under occlusion. */
export function isOccludedAlongSegment(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    tileWorld: number = KENNEY_TILE_WORLD,
    eps: number = VISIBILITY_BELOW_CEILING_EPS
): boolean {
    const dx = bx - ax;
    const dy = by - ay;

    const dist = Math.hypot(dx, dy);
    if (dist <= 1e-6) {
        // Degenerate: treat as a single point test
        return isUnderOcclusionCeiling(ax, ay, az, tileWorld, eps);
    }

    // baseline minimum
    const baseSteps = Math.max(1, VISIBILITY_SEGMENT_BASE_STEPS | 0);

    // adaptive: aim for ~1 sample every (tile * spanFrac)
    const spanFrac = Math.max(1e-4, VISIBILITY_SEGMENT_SPAN_FRAC);
    const wantSteps = Math.ceil(dist / (tileWorld * spanFrac));

    // clamp for perf
    const maxSteps = Math.max(1, VISIBILITY_SEGMENT_MAX_STEPS | 0);
    const steps = Math.min(maxSteps, Math.max(baseSteps, wantSteps));

    for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const sx = ax + dx * t;
        const sy = ay + dy * t;

        // Linear interpolate Z along the segment
        const sz = az + (bz - az) * t;

        if (isUnderOcclusionCeiling(sx, sy, sz, tileWorld, eps)) return true;
    }

    return false;
}
