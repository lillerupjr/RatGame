// src/game/math/Entity3D.ts
//
// 3D Entity types and utilities for the layered 3D map system.
// Provides helper functions for working with 3D entities in a SoA (Structure of Arrays) architecture.

import { Vector3D, v3, v3Add, v3Sub, v3Mul, v3Mag, v3Normalize, v3DistXY, v3DistXYSq } from "./Vector3D";
import { BoundingBox3D, bb3, bb3FromCircle, bb3Intersects, bb3Penetration } from "./BoundingBox3D";

// ─────────────────────────────────────────────────────────────
// Entity3D Types
// ─────────────────────────────────────────────────────────────

/**
 * Describes the 3D properties of an entity.
 * Used for collision detection and physics.
 */
export type Entity3DProps = {
    // Position
    x: number;
    y: number;
    z: number;
    
    // Size (collision)
    radius: number;      // XY plane collision radius
    height: number;      // Vertical height (z extent)
    
    // Velocity (optional)
    vx?: number;
    vy?: number;
    vz?: number;
};

/**
 * Result of a 3D collision check between entities.
 */
export type CollisionResult3D = {
    collided: boolean;
    penetration: Vector3D;
    normal: Vector3D;
};

// ─────────────────────────────────────────────────────────────
// Entity Bounding Box Creation
// ─────────────────────────────────────────────────────────────

/**
 * Create a 3D bounding box for an entity with circular XY footprint.
 * The Z range goes from entity.z to entity.z + entity.height.
 */
export function entity3DBounds(entity: Entity3DProps): BoundingBox3D {
    return bb3FromCircle(
        entity.x,
        entity.y,
        entity.radius,
        entity.z,
        entity.z + entity.height
    );
}

/**
 * Create a 3D bounding box from SoA entity arrays at index.
 * Requires arrays: ex, ey, ez (or uses 0), eR, eHeight (or uses default).
 */
export function entity3DBoundsFromSoA(
    x: number,
    y: number,
    z: number,
    radius: number,
    height: number = 1
): BoundingBox3D {
    return bb3FromCircle(x, y, radius, z, z + height);
}

// ─────────────────────────────────────────────────────────────
// 3D Collision Detection
// ─────────────────────────────────────────────────────────────

/**
 * Check if two 3D entities collide (cylinder-cylinder collision).
 * Uses circular collision in XY plane combined with Z range overlap.
 */
export function entities3DCollide(a: Entity3DProps, b: Entity3DProps): boolean {
    // Check XY plane distance first (cheaper)
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const distXYSq = dx * dx + dy * dy;
    const combinedRadius = a.radius + b.radius;
    
    if (distXYSq > combinedRadius * combinedRadius) {
        return false;
    }
    
    // Check Z overlap
    const aZMin = a.z;
    const aZMax = a.z + a.height;
    const bZMin = b.z;
    const bZMax = b.z + b.height;
    
    return aZMin < bZMax && aZMax > bZMin;
}

/**
 * Check if an entity collides with a point in 3D space.
 */
export function entity3DContainsPoint(entity: Entity3DProps, point: Vector3D): boolean {
    // Check Z range first
    if (point.z < entity.z || point.z > entity.z + entity.height) {
        return false;
    }
    
    // Check XY distance
    const dx = point.x - entity.x;
    const dy = point.y - entity.y;
    return dx * dx + dy * dy <= entity.radius * entity.radius;
}

/**
 * Check if an entity is on a specific floor level.
 * Floor level is determined by the entity's base Z position.
 */
export function entity3DOnFloor(entity: Entity3DProps, floorZ: number, tolerance: number = 0.5): boolean {
    return Math.abs(entity.z - floorZ) < tolerance;
}

/**
 * Check if two entities are on the same floor level.
 */
export function entities3DSameFloor(a: Entity3DProps, b: Entity3DProps, tolerance: number = 0.5): boolean {
    return Math.abs(a.z - b.z) < tolerance;
}

// ─────────────────────────────────────────────────────────────
// 3D Collision Resolution
// ─────────────────────────────────────────────────────────────

/**
 * Get the separation vector needed to push entity A out of entity B.
 * Only handles XY separation (entities slide on ground plane).
 */
export function entity3DSeparationXY(a: Entity3DProps, b: Entity3DProps): Vector3D {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const distXY = Math.sqrt(dx * dx + dy * dy);
    
    if (distXY < 1e-9) {
        // Entities at same position - push in arbitrary direction
        return v3(a.radius + b.radius, 0, 0);
    }
    
    const combinedRadius = a.radius + b.radius;
    const overlap = combinedRadius - distXY;
    
    if (overlap <= 0) {
        return v3(0, 0, 0);
    }
    
    // Normalize direction and scale by overlap
    const nx = dx / distXY;
    const ny = dy / distXY;
    
    return v3(nx * overlap, ny * overlap, 0);
}

/**
 * Full 3D collision resolution including Z.
 */
export function entity3DCollisionResolve(a: Entity3DProps, b: Entity3DProps): CollisionResult3D {
    if (!entities3DCollide(a, b)) {
        return {
            collided: false,
            penetration: v3(0, 0, 0),
            normal: v3(0, 0, 0),
        };
    }
    
    // Get XY separation
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const distXY = Math.sqrt(dx * dx + dy * dy);
    
    const combinedRadius = a.radius + b.radius;
    const xyOverlap = combinedRadius - distXY;
    
    // Get Z separation
    const aZMin = a.z;
    const aZMax = a.z + a.height;
    const bZMin = b.z;
    const bZMax = b.z + b.height;
    
    const zOverlapBottom = aZMax - bZMin;
    const zOverlapTop = bZMax - aZMin;
    const zOverlap = Math.min(zOverlapBottom, zOverlapTop);
    
    // Choose smallest overlap axis
    if (xyOverlap < zOverlap) {
        // Separate in XY
        if (distXY < 1e-9) {
            return {
                collided: true,
                penetration: v3(combinedRadius, 0, 0),
                normal: v3(1, 0, 0),
            };
        }
        
        const nx = dx / distXY;
        const ny = dy / distXY;
        
        return {
            collided: true,
            penetration: v3(nx * xyOverlap, ny * xyOverlap, 0),
            normal: v3(nx, ny, 0),
        };
    } else {
        // Separate in Z
        const nz = a.z < b.z ? -1 : 1;
        
        return {
            collided: true,
            penetration: v3(0, 0, nz * zOverlap),
            normal: v3(0, 0, nz),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// Physics Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Apply gravity to an entity's velocity.
 * Returns the new vz value.
 */
export function applyGravity(vz: number, dt: number, gravity: number = 9.81): number {
    return vz - gravity * dt;
}

/**
 * Check if an entity is grounded (on a surface).
 */
export function isGrounded(entity: Entity3DProps, groundZ: number, tolerance: number = 0.1): boolean {
    return Math.abs(entity.z - groundZ) < tolerance;
}

/**
 * Clamp entity Z to ground level.
 */
export function clampToGround(entity: Entity3DProps, groundZ: number): Entity3DProps {
    if (entity.z < groundZ) {
        return { ...entity, z: groundZ, vz: 0 };
    }
    return entity;
}

// ─────────────────────────────────────────────────────────────
// Targeting and Distance
// ─────────────────────────────────────────────────────────────

/**
 * Get the horizontal (XY) distance between two entities.
 */
export function entity3DDistXY(a: Entity3DProps, b: Entity3DProps): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get the full 3D distance between two entities (center to center).
 */
export function entity3DDist(a: Entity3DProps, b: Entity3DProps): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z + a.height * 0.5) - (b.z + b.height * 0.5);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Get the direction from entity A to entity B (XY plane only).
 */
export function entity3DDirectionXY(from: Entity3DProps, to: Entity3DProps): { x: number; y: number } {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 1e-9) {
        return { x: 0, y: 0 };
    }
    
    return { x: dx / dist, y: dy / dist };
}

/**
 * Get the full 3D direction from entity A to entity B.
 */
export function entity3DDirection(from: Entity3DProps, to: Entity3DProps): Vector3D {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = (to.z + to.height * 0.5) - (from.z + from.height * 0.5);
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (dist < 1e-9) {
        return v3(0, 0, 0);
    }
    
    return v3(dx / dist, dy / dist, dz / dist);
}

// ─────────────────────────────────────────────────────────────
// SoA Helpers (for integration with existing World structure)
// ─────────────────────────────────────────────────────────────

/**
 * Extract Entity3DProps from SoA arrays at a given index.
 * Handles optional Z arrays gracefully.
 */
export function extractEntity3D(
    x: number[],
    y: number[],
    r: number[],
    index: number,
    z?: number[],
    height: number = 1
): Entity3DProps {
    return {
        x: x[index],
        y: y[index],
        z: z ? z[index] : 0,
        radius: r[index],
        height,
    };
}

/**
 * Check collision between two SoA entities.
 * Returns true if they collide in 3D space.
 */
export function checkSoACollision3D(
    ax: number, ay: number, az: number, ar: number, aHeight: number,
    bx: number, by: number, bz: number, br: number, bHeight: number
): boolean {
    // Check XY plane first
    const dx = ax - bx;
    const dy = ay - by;
    const distXYSq = dx * dx + dy * dy;
    const combinedRadius = ar + br;
    
    if (distXYSq > combinedRadius * combinedRadius) {
        return false;
    }
    
    // Check Z overlap
    const aZMin = az;
    const aZMax = az + aHeight;
    const bZMin = bz;
    const bZMax = bz + bHeight;
    
    return aZMin < bZMax && aZMax > bZMin;
}

/**
 * Check if entity is within a 3D radius of a point.
 * Useful for range checks that consider height.
 */
export function inRange3D(
    entityX: number, entityY: number, entityZ: number,
    pointX: number, pointY: number, pointZ: number,
    range: number
): boolean {
    const dx = entityX - pointX;
    const dy = entityY - pointY;
    const dz = entityZ - pointZ;
    return dx * dx + dy * dy + dz * dz <= range * range;
}

/**
 * Check if entity is within an XY radius of a point (ignoring Z).
 * Useful for ground-plane range checks.
 */
export function inRangeXY(
    entityX: number, entityY: number,
    pointX: number, pointY: number,
    range: number
): boolean {
    const dx = entityX - pointX;
    const dy = entityY - pointY;
    return dx * dx + dy * dy <= range * range;
}
