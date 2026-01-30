// src/game/visual/iso.ts
// Phase 1 isometric projection helpers (Diablo-ish).
// World coordinates remain your existing "flat 2D" units.
// Rendering projects world -> screen using a 45° rotate + vertical squash.
//
// Tweak ISO_X / ISO_Y to taste:
// - ISO_Y = 0.5 gives the classic 2:1 iso feel.

export const ISO_X = 1.0;
export const ISO_Y = 0.5;

export function worldToScreen(x: number, y: number) {
    return {
        x: (x - y) * ISO_X,
        y: (x + y) * ISO_Y,
    };
}

export function worldDeltaToScreen(dx: number, dy: number) {
    return {
        dx: (dx - dy) * ISO_X,
        dy: (dx + dy) * ISO_Y,
    };
}

// Optional (handy later for mouse picking)
export function screenToWorld(sx: number, sy: number) {
    const a = sx / ISO_X;
    const b = sy / ISO_Y;
    return {
        x: (a + b) * 0.5,
        y: (b - a) * 0.5,
    };
}

// Sort key for grounded sprites (back to front)
export function depthKey(x: number, y: number) {
    return x + y;
}
