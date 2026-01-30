import type { World } from "../world";
import { emitEvent } from "../world";
import { isEnemyInCircle } from "./hitDetection";
import {spawnZone, ZONE_KIND} from "../factories/zoneFactory";
import { queryCircle } from "../util/spatialHash";

export function zonesSystem(w: World, dt: number) {
    const PLAYER_R = w.playerR;

    // -----------------------------------------------------------------
// NEW: delayed explosion queue (Bazooka evolution recursive aftershocks)
// Each entry spawns one explosion, then can spawn the next wave around itself.
// -----------------------------------------------------------------
    type DelayedExplosion = {
        t: number;
        x: number;
        y: number;
        r: number;
        dmg: number;
        ttl: number;

        // recursion controls
        wave: number;        // 0 = first aftershock wave
        maxWaves: number;    // total waves (layers)
        baseN: number;       // branching base (e.g. 4)
        delay: number;       // seconds between waves
        ringR: number;       // radius used for children placement
        ringStep: number;    // optional: expand ring as it spreads
        rot: number;         // rotation offset per wave
    };

    const q = (w as any)._delayedExplosions as DelayedExplosion[] | undefined;
    if (q && q.length > 0) {
        for (let i = q.length - 1; i >= 0; i--) {
            const ex = q[i];
            ex.t -= dt;

            if (ex.t > 0) continue;

            // 1) Spawn the explosion zone now
            // 1) Spawn the explosion zone now
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

// Single-hit burst immediately
            w.zTickLeft[z] = 0;

// NEW: aftershock sound (same identity as bazooka)
            emitEvent(w, { type: "SFX", id: "EXPLOSION_BAZOOKA", vol: 0.55 });


            // Single-hit burst immediately
            w.zTickLeft[z] = 0;

            // 2) Schedule the next wave around *this* explosion
            const nextWave = ex.wave + 1;
            if (nextWave < ex.maxWaves) {
                // per your request: N, N^2, N^3 ... but now it's branching per node.
                // To keep it sane, we branch as baseN each node (true spreading).
                const count = ex.baseN; // children per explosion (branch factor)

                const baseAng = w.rng.range(0, Math.PI * 2);
                const ring = ex.ringR + nextWave * ex.ringStep;
                // Rotate each wave by 360/n (n = count) to maximize coverage
                const rotStep = (Math.PI * 2) / Math.max(1, count);
                const ang0 = baseAng + nextWave * rotStep;

                for (let k = 0; k < count; k++) {
                    const ang = ang0 + (k * Math.PI * 2) / count;
                    const x2 = ex.x + Math.cos(ang) * ring;
                    const y2 = ex.y + Math.sin(ang) * ring;

                    q.push({
                        t: ex.delay,
                        x: x2,
                        y: y2,
                        r: ex.r,
                        dmg: ex.dmg,
                        ttl: ex.ttl,

                        wave: nextWave,
                        maxWaves: ex.maxWaves,
                        baseN: ex.baseN,
                        delay: ex.delay,
                        ringR: ex.ringR,
                        ringStep: ex.ringStep,
                        rot: ex.rot,
                    });
                }
            }

            // remove processed entry
            q.splice(i, 1);
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

        // Enemy damage (existing behavior) - now using spatial hash
        const dmg = w.zDamage[z];
        if (dmg <= 0 || zr <= 0) continue;

        // Query nearby enemies from spatial hash (already populated by collisionsSystem)
        const nearbyEnemies = queryCircle(w.enemySpatialHash, zx, zy, zr + 50); // 50 = max enemy radius buffer
        const checkedEnemies = new Set<number>();

        for (let i = 0; i < nearbyEnemies.length; i++) {
            const e = nearbyEnemies[i];
            
            // Skip duplicates (enemies spanning multiple cells)
            if (checkedEnemies.has(e)) continue;
            checkedEnemies.add(e);
            
            if (!w.eAlive[e]) continue;
            if (!isEnemyInCircle(w, e, zx, zy, zr)) continue;

            w.eHp[e] -= dmg;

            emitEvent(w, {
                type: "ENEMY_HIT",
                enemyIndex: e,
                damage: dmg,
                x: w.ex[e],
                y: w.ey[e],
                isCrit: false, // Zone damage doesn't crit
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