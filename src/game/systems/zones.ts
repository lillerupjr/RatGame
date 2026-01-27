import type { World } from "../world";
import { emitEvent } from "../world";
import { isEnemyInCircle } from "./hitDetection";

export function zonesSystem(w: World, dt: number) {
    const PLAYER_R = 14;

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

        // Follow player
        if (w.zFollowPlayer[z]) {
            w.zx[z] = w.px;
            w.zy[z] = w.py;
        }

        // Tick countdown
        w.zTickLeft[z] -= dt;
        if (w.zTickLeft[z] > 0) continue;

        const every = Math.max(0.02, w.zTickEvery[z]);
        while (w.zTickLeft[z] <= 0) w.zTickLeft[z] += every;

        const zx = w.zx[z];
        const zy = w.zy[z];
        const zr = w.zR[z];

        // NEW: player damage (boss hazards)
        const pdmg = w.zDamagePlayer[z] ?? 0;
        if (pdmg > 0 && zr > 0) {
            const dx = w.px - zx;
            const dy = w.py - zy;
            const rr = zr + PLAYER_R;
            if (dx * dx + dy * dy <= rr * rr) {
                w.playerHp -= pdmg;
                emitEvent(w, { type: "PLAYER_HIT", damage: pdmg, x: w.px, y: w.py });
            }
        }

        // Enemy damage (existing behavior)
        const dmg = w.zDamage[z];
        if (dmg <= 0 || zr <= 0) continue;

        for (let e = 0; e < w.eAlive.length; e++) {
            if (!w.eAlive[e]) continue;
            if (!isEnemyInCircle(w, e, zx, zy, zr)) continue;

            w.eHp[e] -= dmg;

            emitEvent(w, {
                type: "ENEMY_HIT",
                enemyIndex: e,
                damage: dmg,
                x: w.ex[e],
                y: w.ey[e],
                source: "OTHER",
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