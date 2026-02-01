// src/game/map/walkableGeometry.ts

export type Vec2 = { x: number; y: number };

export type RampFace = {
    id: string;

    // Convex quad in WORLD space (clockwise)
    poly: [Vec2, Vec2, Vec2, Vec2];

    // Height range
    z0: number;
    z1: number;

    // Directional axis for interpolation (0..1)
    // Implemented as a projection from world position
    dir: Vec2;
};

export const RAMP_FACES: RampFace[] = [];

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

export function pointInQuad(p: Vec2, q: RampFace["poly"]): boolean {
    // Standard convex quad test via cross products
    function sign(a: Vec2, b: Vec2, c: Vec2) {
        return (a.x - c.x) * (b.y - c.y) - (b.x - c.x) * (a.y - c.y);
    }

    const b1 = sign(p, q[0], q[1]) < 0;
    const b2 = sign(p, q[1], q[2]) < 0;
    const b3 = sign(p, q[2], q[3]) < 0;
    const b4 = sign(p, q[3], q[0]) < 0;

    return b1 === b2 && b2 === b3 && b3 === b4;
}

export function rampHeightAt(r: RampFace, p: Vec2): number {
    const dx = p.x - r.poly[0].x;
    const dy = p.y - r.poly[0].y;

    const dot = dx * r.dir.x + dy * r.dir.y;
    const len = Math.hypot(r.dir.x, r.dir.y) || 1;

    const t = Math.max(0, Math.min(1, dot / len));
    return r.z0 + (r.z1 - r.z0) * t;
}
