// src/game/systems/collision3D.ts
//
// 3D Collision Detection System
// 
// Handles collision detection between entities in 3D space using the layered map system.
// Supports cylinder-cylinder collision (entities), cylinder-box collision (tiles),
// and efficient spatial queries.

import { World } from "../../../engine/world/world";
import { Vector3D, v3, v3Add, v3Sub, v3Normalize, v3Mag, v3MagSq } from "../../math/Vector3D";
import { BoundingBox3D, bb3, bb3FromCircle, bb3Intersects, bb3Penetration, bb3ClosestPoint } from "../../math/BoundingBox3D";
import { 
    Entity3DProps, 
    entities3DCollide, 
    entity3DSeparationXY,
    checkSoACollision3D 
} from "../../math/Entity3D";
import { 
    LayeredTileMap3D, 
    Tile3D, 
    getActiveLayeredMap,
    MAX_STEP_HEIGHT 
} from "../../map/compile/LayeredTileMap3D";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of a 3D collision resolution.
 */
export type CollisionResolution3D = {
    resolved: boolean;
    newX: number;
    newY: number;
    newZ: number;
    hitWall: boolean;
    hitCeiling: boolean;
    hitFloor: boolean;
};

/**
 * Configuration for 3D collision checks.
 */
export type Collision3DConfig = {
    entityRadius: number;
    entityHeight: number;
    maxStepHeight: number;
    gravity: number;
    slideAlongWalls: boolean;
};

const DEFAULT_CONFIG: Collision3DConfig = {
    entityRadius: 18,
    entityHeight: 1.5,
    maxStepHeight: MAX_STEP_HEIGHT,
    gravity: 9.81,
    slideAlongWalls: true,
};

// ─────────────────────────────────────────────────────────────
// Entity-Entity Collision (SoA compatible)
// ─────────────────────────────────────────────────────────────

/**
 * Check collision between two entities using SoA arrays.
 * Uses cylinder collision model with Z height consideration.
 * 
 * @param ax First entity X
 * @param ay First entity Y
 * @param az First entity Z (base)
 * @param ar First entity radius
 * @param ah First entity height
 * @param bx Second entity X
 * @param by Second entity Y
 * @param bz Second entity Z (base)
 * @param br Second entity radius
 * @param bh Second entity height
 * @returns true if entities collide
 */
/** Return true if two 3D entities overlap. */
export function entitiesCollide3D(
    ax: number, ay: number, az: number, ar: number, ah: number,
    bx: number, by: number, bz: number, br: number, bh: number
): boolean {
    // Check XY distance first (cheaper)
    const dx = ax - bx;
    const dy = ay - by;
    const distXYSq = dx * dx + dy * dy;
    const combinedRadius = ar + br;
    
    if (distXYSq > combinedRadius * combinedRadius) {
        return false;
    }
    
    // Check Z overlap (cylinder height check)
    const aZMax = az + ah;
    const bZMax = bz + bh;
    
    return az < bZMax && aZMax > bz;
}

/**
 * Get the separation vector to push entity A out of entity B (XY only).
 * Returns { dx, dy } representing the push direction and magnitude.
 */
/** Return separation vector to resolve a 3D overlap. */
export function getSeparation3D(
    ax: number, ay: number, az: number, ar: number, ah: number,
    bx: number, by: number, bz: number, br: number, bh: number
): { dx: number; dy: number; dz: number } {
    // Check Z overlap first
    const aZMax = az + ah;
    const bZMax = bz + bh;
    
    if (az >= bZMax || aZMax <= bz) {
        return { dx: 0, dy: 0, dz: 0 };
    }
    
    // Calculate XY separation
    const dx = ax - bx;
    const dy = ay - by;
    const distXY = Math.sqrt(dx * dx + dy * dy);
    
    if (distXY < 1e-9) {
        // Entities at same position - push in arbitrary direction
        return { dx: ar + br, dy: 0, dz: 0 };
    }
    
    const combinedRadius = ar + br;
    const overlap = combinedRadius - distXY;
    
    if (overlap <= 0) {
        return { dx: 0, dy: 0, dz: 0 };
    }
    
    // Normalize and scale
    const nx = dx / distXY;
    const ny = dy / distXY;
    
    return {
        dx: nx * overlap,
        dy: ny * overlap,
        dz: 0,
    };
}

// ─────────────────────────────────────────────────────────────
// Entity-World Collision (with layered map)
// ─────────────────────────────────────────────────────────────

/**
 * Resolve entity movement against the layered 3D map.
 * Handles wall collision, floor/ceiling checks, and stepping.
 */
/** Resolve collisions between an entity and the map geometry. */
export function resolveMapCollision3D(
    currentX: number, currentY: number, currentZ: number,
    targetX: number, targetY: number,
    radius: number,
    height: number,
    map: LayeredTileMap3D | null = getActiveLayeredMap()
): CollisionResolution3D {
    if (!map) {
        // No 3D map available - just allow the move
        return {
            resolved: true,
            newX: targetX,
            newY: targetY,
            newZ: currentZ,
            hitWall: false,
            hitCeiling: false,
            hitFloor: false,
        };
    }
    
    const tileSize = map.config.tileSize;
    let newX = targetX;
    let newY = targetY;
    let newZ = currentZ;
    let hitWall = false;
    let hitCeiling = false;
    let hitFloor = false;
    
    // Check movement query
    const moveQuery = map.canMove(currentX, currentY, currentZ, targetX, targetY, height);
    
    if (moveQuery.canMove) {
        // Movement is allowed
        newZ = moveQuery.groundZ;
        
        if (moveQuery.stepUp || moveQuery.stepDown) {
            // We stepped up or down
            hitFloor = true;
        }
    } else {
        // Movement blocked - try sliding along walls
        hitWall = true;
        
        // Try X-only movement
        const moveX = map.canMove(currentX, currentY, currentZ, targetX, currentY, height);
        if (moveX.canMove) {
            newX = targetX;
            newY = currentY;
            newZ = moveX.groundZ;
        } else {
            // Try Y-only movement
            const moveY = map.canMove(currentX, currentY, currentZ, currentX, targetY, height);
            if (moveY.canMove) {
                newX = currentX;
                newY = targetY;
                newZ = moveY.groundZ;
            } else {
                // Can't move at all
                newX = currentX;
                newY = currentY;
            }
        }
    }
    
    // Clamp to ground
    const ground = map.getGroundAt(newX, newY, newZ + MAX_STEP_HEIGHT);
    if (ground.walkable) {
        if (newZ < ground.z) {
            newZ = ground.z;
            hitFloor = true;
        }
    }
    
    // Check ceiling
    const ceiling = map.getCeilingAt(newX, newY, newZ);
    if (ceiling - newZ < height) {
        // Would hit ceiling - block movement or push down
        hitCeiling = true;
        newZ = ceiling - height;
    }
    
    return {
        resolved: true,
        newX,
        newY,
        newZ,
        hitWall,
        hitCeiling,
        hitFloor,
    };
}

// ─────────────────────────────────────────────────────────────
// Projectile Collision
// ─────────────────────────────────────────────────────────────

/**
 * Check if a projectile at position (px, py, pz) with radius pr hits an enemy.
 * Uses cylinder collision for the enemy and sphere/cylinder for the projectile.
 */
/** Test whether a projectile hits an entity in 3D. */
export function projectileHitsEntity3D(
    px: number, py: number, pz: number, pr: number,
    ex: number, ey: number, ez: number, er: number, eh: number
): boolean {
    // XY distance check first
    const dx = px - ex;
    const dy = py - ey;
    const distXYSq = dx * dx + dy * dy;
    const combinedRadius = pr + er;
    
    if (distXYSq > combinedRadius * combinedRadius) {
        return false;
    }
    
    // Z check - projectile center must be within enemy's Z range
    // (treating projectile as a point in Z for simplicity)
    return pz >= ez && pz <= ez + eh;
}

/**
 * Check if a projectile hits any solid tile in the layered map.
 * Returns true if the projectile should be blocked/destroyed.
 */
/** Test whether a projectile hits the map in 3D. */
export function projectileHitsMap3D(
    px: number, py: number, pz: number, pr: number,
    map: LayeredTileMap3D | null = getActiveLayeredMap()
): boolean {
    if (!map) return false;
    
    // Create a small bounding box around the projectile
    const projectileBounds = bb3FromCircle(px, py, pr, pz - pr, pz + pr);
    
    // Check for solid tiles
    const solidTiles = map.getSolidTilesInBounds(projectileBounds);
    
    return solidTiles.length > 0;
}

// ─────────────────────────────────────────────────────────────
// Zone/Area Effects
// ─────────────────────────────────────────────────────────────

/**
 * Check if an entity is within a 3D zone (cylinder).
 * Zones are typically cylindrical areas with a center (zx, zy, zz), radius zr, and height zh.
 */
/** Return true if an entity overlaps a 3D zone volume. */
export function entityInZone3D(
    ex: number, ey: number, ez: number, er: number, eh: number,
    zx: number, zy: number, zz: number, zr: number, zh: number
): boolean {
    // XY check - circle-circle overlap
    const dx = ex - zx;
    const dy = ey - zy;
    const distXYSq = dx * dx + dy * dy;
    const combinedRadius = er + zr;
    
    if (distXYSq > combinedRadius * combinedRadius) {
        return false;
    }
    
    // Z range overlap
    const eZMax = ez + eh;
    const zZMax = zz + zh;
    
    return ez < zZMax && eZMax > zz;
}

/**
 * Get all entities within a 3D spherical radius.
 * Returns indices of matching entities from SoA arrays.
 */
/** Collect entities within a 3D radius. */
export function getEntitiesInRadius3D(
    centerX: number, centerY: number, centerZ: number,
    radius: number,
    entityX: number[], entityY: number[], entityZ: number[] | null,
    entityAlive: boolean[],
    entityRadius: number[] | null = null,
    entityHeight: number = 1
): number[] {
    const results: number[] = [];
    const radiusSq = radius * radius;
    
    for (let i = 0; i < entityAlive.length; i++) {
        if (!entityAlive[i]) continue;
        
        const ex = entityX[i];
        const ey = entityY[i];
        const ez = entityZ ? entityZ[i] : 0;
        const er = entityRadius ? entityRadius[i] : 0;
        
        // Distance check (using entity center)
        const dx = ex - centerX;
        const dy = ey - centerY;
        const dz = (ez + entityHeight * 0.5) - centerZ;
        
        const distSq = dx * dx + dy * dy + dz * dz;
        
        // Include if within radius (accounting for entity radius if provided)
        const effectiveRadius = radius + er;
        if (distSq <= effectiveRadius * effectiveRadius) {
            results.push(i);
        }
    }
    
    return results;
}

/**
 * Get all entities within a 3D cylindrical area (XY radius + Z range).
 * More common for game mechanics than spherical.
 */
/** Collect entities within a 3D cylinder volume. */
export function getEntitiesInCylinder3D(
    centerX: number, centerY: number,
    zMin: number, zMax: number,
    radius: number,
    entityX: number[], entityY: number[], entityZ: number[] | null,
    entityAlive: boolean[],
    entityRadius: number[] | null = null,
    entityHeight: number = 1
): number[] {
    const results: number[] = [];
    const radiusSq = radius * radius;
    
    for (let i = 0; i < entityAlive.length; i++) {
        if (!entityAlive[i]) continue;
        
        const ex = entityX[i];
        const ey = entityY[i];
        const ez = entityZ ? entityZ[i] : 0;
        const er = entityRadius ? entityRadius[i] : 0;
        const eZMax = ez + entityHeight;
        
        // Z range check
        if (ez >= zMax || eZMax <= zMin) continue;
        
        // XY distance check
        const dx = ex - centerX;
        const dy = ey - centerY;
        const distXYSq = dx * dx + dy * dy;
        
        const effectiveRadius = radius + er;
        if (distXYSq <= effectiveRadius * effectiveRadius) {
            results.push(i);
        }
    }
    
    return results;
}

// ─────────────────────────────────────────────────────────────
// Floor-Based Collision (backward compatibility)
// ─────────────────────────────────────────────────────────────

/**
 * Check if two entities are on the same floor level.
 * Used for floor-gated collision (enemies can only hit player on same floor).
 */
/** Return true if two entities are on the same integer floor. */
export function onSameFloor(
    az: number, aHeight: number,
    bz: number, bHeight: number,
    tolerance: number = 0.5
): boolean {
    // Floor is determined by base Z
    const aFloor = Math.floor(az);
    const bFloor = Math.floor(bz);
    
    return Math.abs(aFloor - bFloor) <= tolerance;
}

/**
 * Get the floor level for a Z position.
 */
/** Convert a Z value to its integer floor level. */
export function getFloorLevel(z: number): number {
    return Math.floor(z);
}

// ─────────────────────────────────────────────────────────────
// Raycast (for projectiles, line of sight)
// ─────────────────────────────────────────────────────────────

/**
 * Raycast result.
 */
export type RaycastResult3D = {
    hit: boolean;
    hitPoint: Vector3D | null;
    hitDistance: number;
    hitType: "NONE" | "TILE" | "ENTITY";
    hitIndex: number;  // Entity index if hit entity
};

/**
 * Cast a ray in 3D space, checking against the map and optionally entities.
 */
/** Raycast against 3D map geometry and entities. */
export function raycast3D(
    originX: number, originY: number, originZ: number,
    dirX: number, dirY: number, dirZ: number,
    maxDistance: number,
    map: LayeredTileMap3D | null = getActiveLayeredMap(),
    checkEntities: boolean = false,
    entityX?: number[], entityY?: number[], entityZ?: number[] | null,
    entityAlive?: boolean[], entityRadius?: number[], entityHeight?: number
): RaycastResult3D {
    const stepSize = 1;
    const steps = Math.ceil(maxDistance / stepSize);
    
    let closestHit: RaycastResult3D = {
        hit: false,
        hitPoint: null,
        hitDistance: Infinity,
        hitType: "NONE",
        hitIndex: -1,
    };
    
    for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * maxDistance;
        const px = originX + dirX * t;
        const py = originY + dirY * t;
        const pz = originZ + dirZ * t;
        
        // Check map collision
        if (map && projectileHitsMap3D(px, py, pz, 1, map)) {
            if (t < closestHit.hitDistance) {
                closestHit = {
                    hit: true,
                    hitPoint: v3(px, py, pz),
                    hitDistance: t,
                    hitType: "TILE",
                    hitIndex: -1,
                };
            }
            break; // Stop at first map hit
        }
        
        // Check entity collision
        if (checkEntities && entityX && entityY && entityAlive && entityRadius) {
            const eh = entityHeight ?? 1;
            for (let e = 0; e < entityAlive.length; e++) {
                if (!entityAlive[e]) continue;
                
                const ez = entityZ ? entityZ[e] : 0;
                if (projectileHitsEntity3D(px, py, pz, 1, entityX[e], entityY[e], ez, entityRadius[e], eh)) {
                    if (t < closestHit.hitDistance) {
                        closestHit = {
                            hit: true,
                            hitPoint: v3(px, py, pz),
                            hitDistance: t,
                            hitType: "ENTITY",
                            hitIndex: e,
                        };
                    }
                }
            }
        }
    }
    
    return closestHit;
}

// ─────────────────────────────────────────────────────────────
// Integration Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Apply 3D collision resolution to an entity movement.
 * Call this from movement system to handle all collision types.
 */
/** Apply map collision response and update velocities. */
export function applyCollision3D(
    world: World,
    entityIndex: number,
    newX: number, newY: number,
    entityX: number[], entityY: number[], entityZ: number[],
    entityRadius: number[],
    entityHeight: number = 1
): { x: number; y: number; z: number } {
    const currentX = entityX[entityIndex];
    const currentY = entityY[entityIndex];
    const currentZ = entityZ ? entityZ[entityIndex] : 0;
    const radius = entityRadius[entityIndex];
    
    // Resolve map collision first
    const mapResult = resolveMapCollision3D(
        currentX, currentY, currentZ,
        newX, newY,
        radius, entityHeight
    );
    
    return {
        x: mapResult.newX,
        y: mapResult.newY,
        z: mapResult.newZ,
    };
}
