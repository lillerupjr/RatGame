// src/game/math/math3D.test.ts
//
// Tests for 3D math types (Vector3D, BoundingBox3D, Entity3D)

import { describe, it, expect } from "vitest";
import {
    v3,
    v3Add,
    v3Sub,
    v3Mul,
    v3Div,
    v3Dot,
    v3Cross,
    v3Mag,
    v3MagSq,
    v3Normalize,
    v3Dist,
    v3DistXY,
    v3Lerp,
    v3Approx,
    V3_ZERO,
    V3_UP,
} from "../../../game/math/Vector3D";

import {
    bb3,
    bb3FromCenter,
    bb3FromCircle,
    bb3Center,
    bb3Size,
    bb3Intersects,
    bb3IntersectsXY,
    bb3ContainsPoint,
    bb3Penetration,
    bb3Expand,
    bb3RayIntersect,
} from "../../../game/math/BoundingBox3D";

import {
    entities3DCollide,
    entity3DSeparationXY,
    entity3DOnFloor,
    checkSoACollision3D,
} from "../../../game/math/Entity3D";

// ─────────────────────────────────────────────────────────────
// Vector3D Tests
// ─────────────────────────────────────────────────────────────

describe("Vector3D", () => {
    describe("constructor", () => {
        it("creates a vector with correct values", () => {
            const v = v3(1, 2, 3);
            expect(v.x).toBe(1);
            expect(v.y).toBe(2);
            expect(v.z).toBe(3);
        });
    });

    describe("arithmetic", () => {
        it("adds two vectors", () => {
            const a = v3(1, 2, 3);
            const b = v3(4, 5, 6);
            const result = v3Add(a, b);
            expect(result).toEqual(v3(5, 7, 9));
        });

        it("subtracts two vectors", () => {
            const a = v3(4, 5, 6);
            const b = v3(1, 2, 3);
            const result = v3Sub(a, b);
            expect(result).toEqual(v3(3, 3, 3));
        });

        it("multiplies vector by scalar", () => {
            const v = v3(1, 2, 3);
            const result = v3Mul(v, 2);
            expect(result).toEqual(v3(2, 4, 6));
        });

        it("divides vector by scalar", () => {
            const v = v3(2, 4, 6);
            const result = v3Div(v, 2);
            expect(result).toEqual(v3(1, 2, 3));
        });
    });

    describe("dot product", () => {
        it("calculates dot product correctly", () => {
            const a = v3(1, 0, 0);
            const b = v3(0, 1, 0);
            expect(v3Dot(a, b)).toBe(0);

            const c = v3(1, 2, 3);
            const d = v3(4, 5, 6);
            expect(v3Dot(c, d)).toBe(32); // 1*4 + 2*5 + 3*6 = 32
        });
    });

    describe("cross product", () => {
        it("calculates cross product correctly", () => {
            const x = v3(1, 0, 0);
            const y = v3(0, 1, 0);
            const result = v3Cross(x, y);
            expect(result).toEqual(v3(0, 0, 1));
        });
    });

    describe("magnitude", () => {
        it("calculates magnitude correctly", () => {
            const v = v3(3, 4, 0);
            expect(v3Mag(v)).toBe(5);
        });

        it("calculates squared magnitude correctly", () => {
            const v = v3(3, 4, 0);
            expect(v3MagSq(v)).toBe(25);
        });
    });

    describe("normalize", () => {
        it("normalizes a vector", () => {
            const v = v3(3, 0, 0);
            const result = v3Normalize(v);
            expect(v3Approx(result, v3(1, 0, 0))).toBe(true);
        });

        it("returns zero for zero vector", () => {
            const result = v3Normalize(V3_ZERO);
            expect(result).toEqual(V3_ZERO);
        });
    });

    describe("distance", () => {
        it("calculates 3D distance", () => {
            const a = v3(0, 0, 0);
            const b = v3(3, 4, 0);
            expect(v3Dist(a, b)).toBe(5);
        });

        it("calculates XY distance (ignores Z)", () => {
            const a = v3(0, 0, 0);
            const b = v3(3, 4, 100);
            expect(v3DistXY(a, b)).toBe(5);
        });
    });

    describe("interpolation", () => {
        it("lerps between vectors", () => {
            const a = v3(0, 0, 0);
            const b = v3(10, 20, 30);
            
            const mid = v3Lerp(a, b, 0.5);
            expect(mid).toEqual(v3(5, 10, 15));

            const start = v3Lerp(a, b, 0);
            expect(start).toEqual(a);

            const end = v3Lerp(a, b, 1);
            expect(end).toEqual(b);
        });

        it("clamps t to [0, 1]", () => {
            const a = v3(0, 0, 0);
            const b = v3(10, 10, 10);
            
            expect(v3Lerp(a, b, -1)).toEqual(a);
            expect(v3Lerp(a, b, 2)).toEqual(b);
        });
    });
});

// ─────────────────────────────────────────────────────────────
// BoundingBox3D Tests
// ─────────────────────────────────────────────────────────────

describe("BoundingBox3D", () => {
    describe("constructor", () => {
        it("creates box from min/max", () => {
            const box = bb3(v3(0, 0, 0), v3(10, 10, 10));
            expect(box.min).toEqual(v3(0, 0, 0));
            expect(box.max).toEqual(v3(10, 10, 10));
        });

        it("creates box from center and half-extents", () => {
            const box = bb3FromCenter(v3(5, 5, 5), v3(5, 5, 5));
            expect(box.min).toEqual(v3(0, 0, 0));
            expect(box.max).toEqual(v3(10, 10, 10));
        });

        it("creates box from circle (2D)", () => {
            const box = bb3FromCircle(5, 5, 2, 0, 3);
            expect(box.min).toEqual(v3(3, 3, 0));
            expect(box.max).toEqual(v3(7, 7, 3));
        });
    });

    describe("properties", () => {
        it("calculates center", () => {
            const box = bb3(v3(0, 0, 0), v3(10, 10, 10));
            expect(bb3Center(box)).toEqual(v3(5, 5, 5));
        });

        it("calculates size", () => {
            const box = bb3(v3(0, 0, 0), v3(10, 20, 30));
            expect(bb3Size(box)).toEqual(v3(10, 20, 30));
        });
    });

    describe("intersection", () => {
        it("detects intersecting boxes", () => {
            const a = bb3(v3(0, 0, 0), v3(10, 10, 10));
            const b = bb3(v3(5, 5, 5), v3(15, 15, 15));
            expect(bb3Intersects(a, b)).toBe(true);
        });

        it("detects non-intersecting boxes", () => {
            const a = bb3(v3(0, 0, 0), v3(10, 10, 10));
            const b = bb3(v3(20, 20, 20), v3(30, 30, 30));
            expect(bb3Intersects(a, b)).toBe(false);
        });

        it("detects XY-only intersection", () => {
            const a = bb3(v3(0, 0, 0), v3(10, 10, 10));
            const b = bb3(v3(5, 5, 100), v3(15, 15, 110)); // Different Z
            expect(bb3IntersectsXY(a, b)).toBe(true);
            expect(bb3Intersects(a, b)).toBe(false);
        });
    });

    describe("containment", () => {
        it("detects point inside box", () => {
            const box = bb3(v3(0, 0, 0), v3(10, 10, 10));
            expect(bb3ContainsPoint(box, v3(5, 5, 5))).toBe(true);
        });

        it("detects point outside box", () => {
            const box = bb3(v3(0, 0, 0), v3(10, 10, 10));
            expect(bb3ContainsPoint(box, v3(15, 5, 5))).toBe(false);
        });
    });

    describe("penetration", () => {
        it("calculates penetration depth", () => {
            const a = bb3(v3(0, 0, 0), v3(10, 10, 10));
            const b = bb3(v3(8, 0, 0), v3(18, 10, 10)); // Overlaps by 2 in X
            const pen = bb3Penetration(a, b);
            expect(pen.x).toBe(-2); // Push a left
            expect(pen.y).toBe(0);
            expect(pen.z).toBe(0);
        });

        it("returns zero for non-intersecting boxes", () => {
            const a = bb3(v3(0, 0, 0), v3(10, 10, 10));
            const b = bb3(v3(20, 0, 0), v3(30, 10, 10));
            const pen = bb3Penetration(a, b);
            expect(pen).toEqual(v3(0, 0, 0));
        });
    });

    describe("expansion", () => {
        it("expands box uniformly", () => {
            const box = bb3(v3(5, 5, 5), v3(10, 10, 10));
            const expanded = bb3Expand(box, 2);
            expect(expanded.min).toEqual(v3(3, 3, 3));
            expect(expanded.max).toEqual(v3(12, 12, 12));
        });
    });

    describe("raycasting", () => {
        it("detects ray hitting box", () => {
            const box = bb3(v3(5, -5, -5), v3(15, 5, 5));
            const origin = v3(0, 0, 0);
            const direction = v3(1, 0, 0);
            const t = bb3RayIntersect(origin, direction, box);
            expect(t).toBe(5);
        });

        it("returns null for ray missing box", () => {
            const box = bb3(v3(5, 5, 5), v3(15, 15, 15));
            const origin = v3(0, 0, 0);
            const direction = v3(0, -1, 0); // Wrong direction
            const t = bb3RayIntersect(origin, direction, box);
            expect(t).toBe(null);
        });
    });
});

// ─────────────────────────────────────────────────────────────
// Entity3D Tests
// ─────────────────────────────────────────────────────────────

describe("Entity3D", () => {
    describe("collision detection", () => {
        it("detects colliding entities", () => {
            const a = { x: 0, y: 0, z: 0, radius: 5, height: 2 };
            const b = { x: 3, y: 0, z: 0, radius: 5, height: 2 };
            expect(entities3DCollide(a, b)).toBe(true);
        });

        it("detects non-colliding entities (XY)", () => {
            const a = { x: 0, y: 0, z: 0, radius: 5, height: 2 };
            const b = { x: 15, y: 0, z: 0, radius: 5, height: 2 }; // Too far in X
            expect(entities3DCollide(a, b)).toBe(false);
        });

        it("detects non-colliding entities (Z)", () => {
            const a = { x: 0, y: 0, z: 0, radius: 5, height: 2 };
            const b = { x: 0, y: 0, z: 10, radius: 5, height: 2 }; // Different floor
            expect(entities3DCollide(a, b)).toBe(false);
        });

        it("detects Z overlap at boundary", () => {
            const a = { x: 0, y: 0, z: 0, radius: 5, height: 2 };
            const b = { x: 0, y: 0, z: 1.5, radius: 5, height: 2 }; // Overlaps at top
            expect(entities3DCollide(a, b)).toBe(true);
        });
    });

    describe("separation", () => {
        it("calculates separation vector", () => {
            const a = { x: 0, y: 0, z: 0, radius: 5, height: 2 };
            const b = { x: 8, y: 0, z: 0, radius: 5, height: 2 }; // 2 units overlap
            const sep = entity3DSeparationXY(a, b);
            
            // Should push A away from B (negative X)
            expect(sep.x).toBeLessThan(0);
            expect(Math.abs(sep.x)).toBeCloseTo(2, 1);
        });
    });

    describe("floor checks", () => {
        it("detects entity on floor", () => {
            const entity = { x: 0, y: 0, z: 2.1, radius: 5, height: 2 };
            expect(entity3DOnFloor(entity, 2, 0.5)).toBe(true);
        });

        it("detects entity not on floor", () => {
            const entity = { x: 0, y: 0, z: 5, radius: 5, height: 2 };
            expect(entity3DOnFloor(entity, 2, 0.5)).toBe(false);
        });
    });

    describe("SoA collision", () => {
        it("checks collision with raw values", () => {
            const result = checkSoACollision3D(
                0, 0, 0, 5, 2, // Entity A
                3, 0, 0, 5, 2  // Entity B
            );
            expect(result).toBe(true);
        });

        it("returns false for non-colliding", () => {
            const result = checkSoACollision3D(
                0, 0, 0, 5, 2,   // Entity A
                0, 0, 10, 5, 2  // Entity B (different Z)
            );
            expect(result).toBe(false);
        });
    });
});
