import type { World } from "../world";
import { emitEvent } from "../world";
import { isEnemyInCircle } from "./hitDetection";
import {spawnZone, ZONE_KIND} from "../factories/zoneFactory";

export function zonesSystem(w: World, dt: number) {
    const PLAYER_R = 14;

    type DelayedExplosion = { t: number; x: number; y: number; r: number; dmg: number; ttl: number };

    const q = (w as any)._delayedExplosions as DelayedExplosion[] | undefined;
    if (q && q.length > 0) {
        for (let i = q.length - 1; i >= 0; i--) {
            q[i].t -= dt;
            if (q[i].t <= 0) {
                const ex = q[i];

                const z = spawnZone(w, {
                    kind: ZONE_KIND.EXPLOSION,
                    x: ex.x,
                    y: ex.y,
                    radius: ex.r,
                    damage: ex.dmg,
                    tickEvery: 0.2,
                    ttl: ex.ttl,
                    followPlayer: false,
                });

                // single-hit burst immediately
                w.zTickLeft[z] = 0;

                q.splice(i, 1);
            }
        }
    }

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