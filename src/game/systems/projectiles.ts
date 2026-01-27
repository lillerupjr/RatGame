// src/game/systems/projectiles.ts
import type { World } from "../world";

/**
 * Projectile movement + lifetime cleanup.
 *
 * Behaviors:
 * - Normal: integrates velocity
 * - Orbital: orbits player; ignores velocity
 *
 * Range limiting:
 * - If prMaxDist > 0, projectile is removed once it exceeds start->current distance.
 */
export function projectilesSystem(w: World, dt: number) {
    const moveSpeedMult = w.baseMoveSpeed > 0 ? w.pSpeed / w.baseMoveSpeed : 1;

    for (let i = 0; i < w.pAlive.length; i++) {
        if (!w.pAlive[i]) continue;

        // TTL
        w.prTtl[i] -= dt;
        if (w.prTtl[i] <= 0) {
            w.pAlive[i] = false;
            continue;
        }

        // Orbital projectiles
        if (w.prIsOrbital[i]) {
            // Radius scales with AREA (dynamic)
            const r = (w.prOrbBaseRadius[i] ?? 0) * w.areaMult;

            // Rotational speed scales with MOVE_SPEED (dynamic)
            const angVel = (w.prOrbBaseAngVel[i] ?? 0) * moveSpeedMult;

            let ang = (w.prOrbAngle[i] ?? 0) + angVel * dt;
            // keep bounded
            if (ang > Math.PI * 2) ang -= Math.PI * 2;
            if (ang < 0) ang += Math.PI * 2;

            w.prOrbAngle[i] = ang;

            // Orbit around player
            w.prx[i] = w.px + Math.cos(ang) * r;
            w.pry[i] = w.py + Math.sin(ang) * r;

            // no range limit for orbitals (optional). If you *do* want it, enable below:
            // const maxDist = w.prMaxDist[i] ?? 0;
            // if (maxDist > 0) { ... }

            continue;
        }

        // Normal projectiles: integrate velocity
        w.prx[i] += w.prvx[i] * dt;
        w.pry[i] += w.prvy[i] * dt;

        // Range limit (if enabled)
        const maxDist = w.prMaxDist[i] ?? 0;
        if (maxDist > 0) {
            const dx = w.prx[i] - (w.prStartX[i] ?? w.prx[i]);
            const dy = w.pry[i] - (w.prStartY[i] ?? w.pry[i]);
            if (dx * dx + dy * dy > maxDist * maxDist) {
                w.pAlive[i] = false;
            }
        }
        if (w.prLastHitCd[i] > 0) w.prLastHitCd[i] = Math.max(0, w.prLastHitCd[i] - dt);
    }
}
