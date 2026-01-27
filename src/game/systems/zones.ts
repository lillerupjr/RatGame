// src/game/systems/zones.ts
import type { World } from "../world";
import { emitEvent } from "../world";

/**
 * Generic “zone / aura / ground effect” system.
 *
 * - Updates TTL
 * - If followPlayer: keeps zone centered on player
 * - Deals tick damage to enemies inside radius
 *
 * NOTE: This is intentionally NOT tied to projectiles, so Molotov can reuse it.
 */
export function zonesSystem(w: World, dt: number) {
    for (let z = 0; z < w.zAlive.length; z++) {
        if (!w.zAlive[z]) continue;

        // TTL
        const ttl = w.zTtl[z];
        if (ttl !== Infinity) {
            w.zTtl[z] = ttl - dt;
            if (w.zTtl[z] <= 0) {
                w.zAlive[z] = false;
                continue;
            }
        }

        // Follow player if requested
        if (w.zFollowPlayer[z]) {
            w.zx[z] = w.px;
            w.zy[z] = w.py;
        }

        // Tick countdown
        w.zTickLeft[z] -= dt;
        if (w.zTickLeft[z] > 0) continue;

        // Reset tick timer (supports “catch-up” a bit if dt is large)
        const every = Math.max(0.02, w.zTickEvery[z]);
        while (w.zTickLeft[z] <= 0) w.zTickLeft[z] += every;

        const zx = w.zx[z];
        const zy = w.zy[z];
        const zr = w.zR[z];
        const dmg = w.zDamage[z];
        if (dmg <= 0 || zr <= 0) continue;

        // Apply damage to all enemies inside zone (include enemy radius for feel)
        for (let e = 0; e < w.eAlive.length; e++) {
            if (!w.eAlive[e]) continue;

            const dx = w.ex[e] - zx;
            const dy = w.ey[e] - zy;
            const rr = zr + w.eR[e];
            if (dx * dx + dy * dy > rr * rr) continue;

            w.eHp[e] -= dmg;

            emitEvent(w, {
                type: "ENEMY_HIT",
                enemyIndex: e,
                damage: dmg,
                x: w.ex[e],
                y: w.ey[e],
                source: "OTHER", // (optional upgrade later: add "AURA"/"MOLOTOV" to event union)
            });

            if (w.eHp[e] <= 0) {
                w.eAlive[e] = false;
                w.kills++;

                emitEvent(w, {
                    type: "ENEMY_KILLED",
                    enemyIndex: e,
                    x: w.ex[e],
                    y: w.ey[e],
                    xpValue: 1,
                    source: "OTHER",
                });
            }
        }
    }
}
