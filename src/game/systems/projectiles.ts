import type { World } from "../world";

/**
 * Projectile movement + lifetime cleanup.
 * IMPORTANT: This system NEVER changes projectile velocity after spawn.
 * That is what guarantees "no homing".
 */
export function projectilesSystem(w: World, dt: number) {
    for (let i = 0; i < w.pAlive.length; i++) {
        if (!w.pAlive[i]) continue;

        // Move with fixed velocity
        w.prx[i] += w.prvx[i] * dt;
        w.pry[i] += w.prvy[i] * dt;

        // Lifetime (time-based)
        w.prTtl[i] -= dt;
        if (w.prTtl[i] <= 0) {
            w.pAlive[i] = false;
            continue;
        }

        // Safety bounds (distance-based), keeps arrays from exploding if TTL is large
        if (Math.abs(w.prx[i] - w.px) > 1600 || Math.abs(w.pry[i] - w.py) > 1600) {
            w.pAlive[i] = false;
        }
        const md = w.prMaxDist[i];
        if (md > 0) {
            const dx = w.prx[i] - w.prStartX[i];
            const dy = w.pry[i] - w.prStartY[i];
            if (dx * dx + dy * dy >= md * md) {
                w.pAlive[i] = false;
                continue;
            }
        }
    }
}
