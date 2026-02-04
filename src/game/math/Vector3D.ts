// src/game/math/Vector3D.ts
//
// 3D Vector mathematics for the layered 3D map system.
// Provides a unified 3D coordinate type to replace the current (x, y) + height approach.

/**
 * Immutable 3D vector type.
 * Uses Z-up convention (X/Y are ground plane, Z is vertical height).
 */
export type Vector3D = {
    readonly x: number;
    readonly y: number;
    readonly z: number;
};

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const V3_ZERO: Vector3D = { x: 0, y: 0, z: 0 };
export const V3_ONE: Vector3D = { x: 1, y: 1, z: 1 };
export const V3_UP: Vector3D = { x: 0, y: 0, z: 1 };
export const V3_DOWN: Vector3D = { x: 0, y: 0, z: -1 };
export const V3_FORWARD: Vector3D = { x: 0, y: 1, z: 0 };
export const V3_BACK: Vector3D = { x: 0, y: -1, z: 0 };
export const V3_RIGHT: Vector3D = { x: 1, y: 0, z: 0 };
export const V3_LEFT: Vector3D = { x: -1, y: 0, z: 0 };

// ─────────────────────────────────────────────────────────────
// Constructor helpers
// ─────────────────────────────────────────────────────────────

/**
 * Create a new Vector3D.
 */
export function v3(x: number, y: number, z: number): Vector3D {
    return { x, y, z };
}

/**
 * Create a Vector3D from a 2D position with optional Z.
 * Useful for converting existing (x, y) + height to Vector3D.
 */
export function v3From2D(x: number, y: number, z: number = 0): Vector3D {
    return { x, y, z };
}

/**
 * Create a Vector3D from an existing Vector3D (copy).
 */
export function v3Copy(v: Vector3D): Vector3D {
    return { x: v.x, y: v.y, z: v.z };
}

// ─────────────────────────────────────────────────────────────
// Basic arithmetic
// ─────────────────────────────────────────────────────────────

/**
 * Add two vectors.
 */
export function v3Add(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/**
 * Subtract vector b from vector a.
 */
export function v3Sub(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/**
 * Multiply vector by scalar.
 */
export function v3Mul(v: Vector3D, s: number): Vector3D {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
}

/**
 * Divide vector by scalar.
 */
export function v3Div(v: Vector3D, s: number): Vector3D {
    return { x: v.x / s, y: v.y / s, z: v.z / s };
}

/**
 * Negate vector.
 */
export function v3Neg(v: Vector3D): Vector3D {
    return { x: -v.x, y: -v.y, z: -v.z };
}

/**
 * Component-wise multiply.
 */
export function v3MulComp(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z };
}

/**
 * Component-wise divide.
 */
export function v3DivComp(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x / b.x, y: a.y / b.y, z: a.z / b.z };
}

// ─────────────────────────────────────────────────────────────
// Vector operations
// ─────────────────────────────────────────────────────────────

/**
 * Dot product.
 */
export function v3Dot(a: Vector3D, b: Vector3D): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Cross product.
 */
export function v3Cross(a: Vector3D, b: Vector3D): Vector3D {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
    };
}

/**
 * Magnitude (length) of vector.
 */
export function v3Mag(v: Vector3D): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Squared magnitude (avoids sqrt for comparisons).
 */
export function v3MagSq(v: Vector3D): number {
    return v.x * v.x + v.y * v.y + v.z * v.z;
}

/**
 * Normalize vector to unit length.
 */
export function v3Normalize(v: Vector3D): Vector3D {
    const mag = v3Mag(v);
    if (mag < 1e-9) return V3_ZERO;
    return v3Div(v, mag);
}

/**
 * Distance between two points.
 */
export function v3Dist(a: Vector3D, b: Vector3D): number {
    return v3Mag(v3Sub(a, b));
}

/**
 * Squared distance between two points.
 */
export function v3DistSq(a: Vector3D, b: Vector3D): number {
    return v3MagSq(v3Sub(a, b));
}

/**
 * Horizontal (XY plane) distance between two points.
 * Ignores Z component - useful for ground-plane calculations.
 */
export function v3DistXY(a: Vector3D, b: Vector3D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Horizontal (XY plane) squared distance.
 */
export function v3DistXYSq(a: Vector3D, b: Vector3D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}

// ─────────────────────────────────────────────────────────────
// Interpolation
// ─────────────────────────────────────────────────────────────

/**
 * Linear interpolation between two vectors.
 */
export function v3Lerp(a: Vector3D, b: Vector3D, t: number): Vector3D {
    const clampedT = Math.max(0, Math.min(1, t));
    return {
        x: a.x + (b.x - a.x) * clampedT,
        y: a.y + (b.y - a.y) * clampedT,
        z: a.z + (b.z - a.z) * clampedT,
    };
}

/**
 * Move towards target by maxDelta distance.
 */
export function v3MoveTowards(current: Vector3D, target: Vector3D, maxDelta: number): Vector3D {
    const diff = v3Sub(target, current);
    const dist = v3Mag(diff);
    if (dist <= maxDelta || dist < 1e-9) return target;
    return v3Add(current, v3Mul(v3Div(diff, dist), maxDelta));
}

// ─────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────

/**
 * Clamp each component between min and max.
 */
export function v3Clamp(v: Vector3D, min: Vector3D, max: Vector3D): Vector3D {
    return {
        x: Math.max(min.x, Math.min(max.x, v.x)),
        y: Math.max(min.y, Math.min(max.y, v.y)),
        z: Math.max(min.z, Math.min(max.z, v.z)),
    };
}

/**
 * Get the 2D (XY) components as a simple object.
 */
export function v3ToXY(v: Vector3D): { x: number; y: number } {
    return { x: v.x, y: v.y };
}

/**
 * Check if two vectors are approximately equal.
 */
export function v3Approx(a: Vector3D, b: Vector3D, epsilon: number = 1e-6): boolean {
    return (
        Math.abs(a.x - b.x) < epsilon &&
        Math.abs(a.y - b.y) < epsilon &&
        Math.abs(a.z - b.z) < epsilon
    );
}

/**
 * Format vector as string for debugging.
 */
export function v3ToString(v: Vector3D, decimals: number = 2): string {
    return `(${v.x.toFixed(decimals)}, ${v.y.toFixed(decimals)}, ${v.z.toFixed(decimals)})`;
}

// ─────────────────────────────────────────────────────────────
// Rotation (basic, around Z axis for ground plane)
// ─────────────────────────────────────────────────────────────

/**
 * Rotate vector around Z axis by angle (radians).
 */
export function v3RotateZ(v: Vector3D, angle: number): Vector3D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: v.x * cos - v.y * sin,
        y: v.x * sin + v.y * cos,
        z: v.z,
    };
}

/**
 * Get the angle (radians) in XY plane from origin to point.
 */
export function v3AngleXY(v: Vector3D): number {
    return Math.atan2(v.y, v.x);
}

// ─────────────────────────────────────────────────────────────
// Min/Max
// ─────────────────────────────────────────────────────────────

/**
 * Component-wise minimum.
 */
export function v3Min(a: Vector3D, b: Vector3D): Vector3D {
    return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        z: Math.min(a.z, b.z),
    };
}

/**
 * Component-wise maximum.
 */
export function v3Max(a: Vector3D, b: Vector3D): Vector3D {
    return {
        x: Math.max(a.x, b.x),
        y: Math.max(a.y, b.y),
        z: Math.max(a.z, b.z),
    };
}

/**
 * Absolute value of each component.
 */
export function v3Abs(v: Vector3D): Vector3D {
    return {
        x: Math.abs(v.x),
        y: Math.abs(v.y),
        z: Math.abs(v.z),
    };
}

/**
 * Floor each component.
 */
export function v3Floor(v: Vector3D): Vector3D {
    return {
        x: Math.floor(v.x),
        y: Math.floor(v.y),
        z: Math.floor(v.z),
    };
}

/**
 * Ceil each component.
 */
export function v3Ceil(v: Vector3D): Vector3D {
    return {
        x: Math.ceil(v.x),
        y: Math.ceil(v.y),
        z: Math.ceil(v.z),
    };
}

/**
 * Round each component.
 */
export function v3Round(v: Vector3D): Vector3D {
    return {
        x: Math.round(v.x),
        y: Math.round(v.y),
        z: Math.round(v.z),
    };
}
