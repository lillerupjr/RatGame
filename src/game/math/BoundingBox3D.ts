// src/game/math/BoundingBox3D.ts
//
// 3D Axis-Aligned Bounding Box (AABB) for collision detection.
// Used by the layered 3D map system for entity-to-entity and entity-to-world collisions.

import { Vector3D, v3, v3Add, v3Sub, v3Mul, v3Min, v3Max } from "./Vector3D";

/**
 * Immutable 3D Axis-Aligned Bounding Box.
 * Defined by minimum and maximum corners.
 */
export type BoundingBox3D = {
    readonly min: Vector3D;
    readonly max: Vector3D;
};

// ─────────────────────────────────────────────────────────────
// Constructor helpers
// ─────────────────────────────────────────────────────────────

/**
 * Create a BoundingBox3D from min/max corners.
 */
export function bb3(min: Vector3D, max: Vector3D): BoundingBox3D {
    return { min, max };
}

/**
 * Create a BoundingBox3D from center and half-extents (size/2).
 */
export function bb3FromCenter(center: Vector3D, halfExtents: Vector3D): BoundingBox3D {
    return {
        min: v3Sub(center, halfExtents),
        max: v3Add(center, halfExtents),
    };
}

/**
 * Create a BoundingBox3D from center and full size.
 */
export function bb3FromCenterSize(center: Vector3D, size: Vector3D): BoundingBox3D {
    const half = v3Mul(size, 0.5);
    return {
        min: v3Sub(center, half),
        max: v3Add(center, half),
    };
}

/**
 * Create a BoundingBox3D from a point (zero-volume box).
 */
export function bb3FromPoint(point: Vector3D): BoundingBox3D {
    return { min: point, max: point };
}

/**
 * Create a BoundingBox3D from a 2D circle projected into 3D.
 * Useful for converting existing 2D collision circles.
 * 
 * @param x - Center X
 * @param y - Center Y  
 * @param radius - Circle radius (becomes width and depth)
 * @param zMin - Minimum Z (bottom of entity)
 * @param zMax - Maximum Z (top of entity)
 */
export function bb3FromCircle(
    x: number,
    y: number,
    radius: number,
    zMin: number,
    zMax: number
): BoundingBox3D {
    return {
        min: v3(x - radius, y - radius, zMin),
        max: v3(x + radius, y + radius, zMax),
    };
}

// ─────────────────────────────────────────────────────────────
// Properties
// ─────────────────────────────────────────────────────────────

/**
 * Get the center of the bounding box.
 */
export function bb3Center(box: BoundingBox3D): Vector3D {
    return v3(
        (box.min.x + box.max.x) * 0.5,
        (box.min.y + box.max.y) * 0.5,
        (box.min.z + box.max.z) * 0.5
    );
}

/**
 * Get the size (dimensions) of the bounding box.
 */
export function bb3Size(box: BoundingBox3D): Vector3D {
    return v3Sub(box.max, box.min);
}

/**
 * Get the half-extents (size / 2) of the bounding box.
 */
export function bb3HalfExtents(box: BoundingBox3D): Vector3D {
    return v3Mul(bb3Size(box), 0.5);
}

/**
 * Get the width (X dimension).
 */
export function bb3Width(box: BoundingBox3D): number {
    return box.max.x - box.min.x;
}

/**
 * Get the depth (Y dimension).
 */
export function bb3Depth(box: BoundingBox3D): number {
    return box.max.y - box.min.y;
}

/**
 * Get the height (Z dimension).
 */
export function bb3Height(box: BoundingBox3D): number {
    return box.max.z - box.min.z;
}

/**
 * Get the volume of the bounding box.
 */
export function bb3Volume(box: BoundingBox3D): number {
    const size = bb3Size(box);
    return size.x * size.y * size.z;
}

// ─────────────────────────────────────────────────────────────
// Intersection tests
// ─────────────────────────────────────────────────────────────

/**
 * Check if two bounding boxes intersect (overlap).
 */
export function bb3Intersects(a: BoundingBox3D, b: BoundingBox3D): boolean {
    return (
        a.min.x <= b.max.x && a.max.x >= b.min.x &&
        a.min.y <= b.max.y && a.max.y >= b.min.y &&
        a.min.z <= b.max.z && a.max.z >= b.min.z
    );
}

/**
 * Check if two bounding boxes intersect on the XY plane only (ignoring Z).
 */
export function bb3IntersectsXY(a: BoundingBox3D, b: BoundingBox3D): boolean {
    return (
        a.min.x <= b.max.x && a.max.x >= b.min.x &&
        a.min.y <= b.max.y && a.max.y >= b.min.y
    );
}

/**
 * Check if bounding box contains a point.
 */
export function bb3ContainsPoint(box: BoundingBox3D, point: Vector3D): boolean {
    return (
        point.x >= box.min.x && point.x <= box.max.x &&
        point.y >= box.min.y && point.y <= box.max.y &&
        point.z >= box.min.z && point.z <= box.max.z
    );
}

/**
 * Check if bounding box fully contains another bounding box.
 */
export function bb3ContainsBox(outer: BoundingBox3D, inner: BoundingBox3D): boolean {
    return (
        outer.min.x <= inner.min.x && outer.max.x >= inner.max.x &&
        outer.min.y <= inner.min.y && outer.max.y >= inner.max.y &&
        outer.min.z <= inner.min.z && outer.max.z >= inner.max.z
    );
}

// ─────────────────────────────────────────────────────────────
// Collision resolution
// ─────────────────────────────────────────────────────────────

/**
 * Calculate the penetration depth between two intersecting boxes.
 * Returns the minimum translation vector to separate them (or zero if not intersecting).
 */
export function bb3Penetration(a: BoundingBox3D, b: BoundingBox3D): Vector3D {
    if (!bb3Intersects(a, b)) {
        return { x: 0, y: 0, z: 0 };
    }

    // Calculate overlap on each axis
    const overlapX = Math.min(a.max.x - b.min.x, b.max.x - a.min.x);
    const overlapY = Math.min(a.max.y - b.min.y, b.max.y - a.min.y);
    const overlapZ = Math.min(a.max.z - b.min.z, b.max.z - a.min.z);

    // Find axis with minimum penetration
    const centerA = bb3Center(a);
    const centerB = bb3Center(b);

    if (overlapX <= overlapY && overlapX <= overlapZ) {
        const sign = centerA.x < centerB.x ? -1 : 1;
        return v3(overlapX * sign, 0, 0);
    } else if (overlapY <= overlapX && overlapY <= overlapZ) {
        const sign = centerA.y < centerB.y ? -1 : 1;
        return v3(0, overlapY * sign, 0);
    } else {
        const sign = centerA.z < centerB.z ? -1 : 1;
        return v3(0, 0, overlapZ * sign);
    }
}

/**
 * Get the closest point on a bounding box to an external point.
 */
export function bb3ClosestPoint(box: BoundingBox3D, point: Vector3D): Vector3D {
    return v3(
        Math.max(box.min.x, Math.min(box.max.x, point.x)),
        Math.max(box.min.y, Math.min(box.max.y, point.y)),
        Math.max(box.min.z, Math.min(box.max.z, point.z))
    );
}

/**
 * Calculate the signed distance from a point to the surface of a bounding box.
 * Negative = inside, Positive = outside.
 */
export function bb3SignedDistance(box: BoundingBox3D, point: Vector3D): number {
    const center = bb3Center(box);
    const halfExtents = bb3HalfExtents(box);
    
    // Get absolute offset from center
    const dx = Math.abs(point.x - center.x) - halfExtents.x;
    const dy = Math.abs(point.y - center.y) - halfExtents.y;
    const dz = Math.abs(point.z - center.z) - halfExtents.z;

    // If all are negative, we're inside
    const inside = dx <= 0 && dy <= 0 && dz <= 0;
    
    if (inside) {
        // Return negative distance to nearest face
        return Math.max(dx, dy, dz);
    }
    
    // We're outside - return distance to nearest point
    const ox = Math.max(0, dx);
    const oy = Math.max(0, dy);
    const oz = Math.max(0, dz);
    return Math.sqrt(ox * ox + oy * oy + oz * oz);
}

// ─────────────────────────────────────────────────────────────
// Transformations
// ─────────────────────────────────────────────────────────────

/**
 * Translate (move) a bounding box.
 */
export function bb3Translate(box: BoundingBox3D, offset: Vector3D): BoundingBox3D {
    return {
        min: v3Add(box.min, offset),
        max: v3Add(box.max, offset),
    };
}

/**
 * Scale a bounding box from its center.
 */
export function bb3Scale(box: BoundingBox3D, scale: number): BoundingBox3D {
    const center = bb3Center(box);
    const halfExtents = v3Mul(bb3HalfExtents(box), scale);
    return bb3FromCenter(center, halfExtents);
}

/**
 * Expand bounding box by a uniform amount in all directions.
 */
export function bb3Expand(box: BoundingBox3D, amount: number): BoundingBox3D {
    const expansion = v3(amount, amount, amount);
    return {
        min: v3Sub(box.min, expansion),
        max: v3Add(box.max, expansion),
    };
}

/**
 * Expand bounding box by different amounts per axis.
 */
export function bb3ExpandV(box: BoundingBox3D, expansion: Vector3D): BoundingBox3D {
    return {
        min: v3Sub(box.min, expansion),
        max: v3Add(box.max, expansion),
    };
}

/**
 * Create a bounding box that encompasses both input boxes.
 */
export function bb3Union(a: BoundingBox3D, b: BoundingBox3D): BoundingBox3D {
    return {
        min: v3Min(a.min, b.min),
        max: v3Max(a.max, b.max),
    };
}

/**
 * Create a bounding box that is the intersection of both input boxes.
 * Returns null if boxes don't intersect.
 */
export function bb3Intersection(a: BoundingBox3D, b: BoundingBox3D): BoundingBox3D | null {
    if (!bb3Intersects(a, b)) return null;
    
    return {
        min: v3Max(a.min, b.min),
        max: v3Min(a.max, b.max),
    };
}

// ─────────────────────────────────────────────────────────────
// Ray casting
// ─────────────────────────────────────────────────────────────

/**
 * Ray-box intersection test.
 * Returns the t value along the ray where intersection occurs, or null if no hit.
 * 
 * @param origin - Ray origin point
 * @param direction - Ray direction (normalized)
 * @param box - Target bounding box
 * @param maxDistance - Maximum ray distance
 */
export function bb3RayIntersect(
    origin: Vector3D,
    direction: Vector3D,
    box: BoundingBox3D,
    maxDistance: number = Infinity
): number | null {
    // Avoid division by zero
    const invDirX = direction.x !== 0 ? 1 / direction.x : Infinity;
    const invDirY = direction.y !== 0 ? 1 / direction.y : Infinity;
    const invDirZ = direction.z !== 0 ? 1 / direction.z : Infinity;

    const t1 = (box.min.x - origin.x) * invDirX;
    const t2 = (box.max.x - origin.x) * invDirX;
    const t3 = (box.min.y - origin.y) * invDirY;
    const t4 = (box.max.y - origin.y) * invDirY;
    const t5 = (box.min.z - origin.z) * invDirZ;
    const t6 = (box.max.z - origin.z) * invDirZ;

    const tmin = Math.max(
        Math.min(t1, t2),
        Math.min(t3, t4),
        Math.min(t5, t6)
    );
    const tmax = Math.min(
        Math.max(t1, t2),
        Math.max(t3, t4),
        Math.max(t5, t6)
    );

    // No intersection
    if (tmax < 0 || tmin > tmax || tmin > maxDistance) {
        return null;
    }

    // Return closest positive intersection
    return tmin >= 0 ? tmin : tmax;
}

// ─────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────

/**
 * Check if bounding box is valid (min <= max on all axes).
 */
export function bb3IsValid(box: BoundingBox3D): boolean {
    return (
        box.min.x <= box.max.x &&
        box.min.y <= box.max.y &&
        box.min.z <= box.max.z
    );
}

/**
 * Get the 8 corner vertices of the bounding box.
 */
export function bb3Corners(box: BoundingBox3D): Vector3D[] {
    return [
        v3(box.min.x, box.min.y, box.min.z),
        v3(box.max.x, box.min.y, box.min.z),
        v3(box.min.x, box.max.y, box.min.z),
        v3(box.max.x, box.max.y, box.min.z),
        v3(box.min.x, box.min.y, box.max.z),
        v3(box.max.x, box.min.y, box.max.z),
        v3(box.min.x, box.max.y, box.max.z),
        v3(box.max.x, box.max.y, box.max.z),
    ];
}

/**
 * Format bounding box as string for debugging.
 */
export function bb3ToString(box: BoundingBox3D, decimals: number = 2): string {
    const min = `(${box.min.x.toFixed(decimals)}, ${box.min.y.toFixed(decimals)}, ${box.min.z.toFixed(decimals)})`;
    const max = `(${box.max.x.toFixed(decimals)}, ${box.max.y.toFixed(decimals)}, ${box.max.z.toFixed(decimals)})`;
    return `BB3D[${min} -> ${max}]`;
}
