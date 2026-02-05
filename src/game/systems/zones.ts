import { emitEvent, type World } from "../world";
import { isEnemyInCircle } from "./hitDetection";
import {spawnZone, ZONE_KIND} from "../factories/zoneFactory";
import { queryCircle } from "../util/spatialHash";
import { onEnemyKilledForChallenge } from "./roomChallenge";
import { worldToGrid } from "../coords/grid";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";
import { getEnemyWorld, getPlayerWorld, getZoneWorld } from "../coords/worldViews";

/** Update zones, apply periodic damage, and process delayed explosions. */
export function zonesSystem(w: World, dt: number) {
    const PLAYER_R = w.playerR;
    const T = KENNEY_TILE_WORLD;
    const pw = getPlayerWorld(w, T);
    const px = pw.wx;
    const py = pw.wy;

    const syncZoneGrid = (i: number, wx: number, wy: number) => {
        const gp = worldToGrid(wx, wy, T);
        const gxi = Math.floor(gp.gx);
        const gyi = Math.floor(gp.gy);
        w.zgxi[i] = gxi;
        w.zgyi[i] = gyi;
        w.zgox[i] = gp.gx - gxi;
        w.zgoy[i] = gp.gy - gyi;
    };

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


    // Cache zone floor height so we don’t recompute every tick.
    // Stored on world as a private field to avoid touching the World type.
    const zFloorH = ((w as any)._zFloorH ??= []) as number[];

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
            syncZoneGrid(z, px, py);

            // If it follows the player, its floor height should follow too
            zFloorH[z] = w.activeFloorH | 0;
        }

        // Tick countdown
        w.zTickLeft[z] -= dt;
        if (w.zTickLeft[z] > 0) continue;

        const every = Math.max(0.02, w.zTickEvery[z]);
        while (w.zTickLeft[z] <= 0) w.zTickLeft[z] += every;

        const zp = getZoneWorld(w, z, T);
        const zx = zp.wx;
        const zy = zp.wy;
        const zr = w.zR[z];

        // Initialize cached zone floor height if missing:
        // Use player-follow height if available, otherwise infer from the CURRENT active floor.
        // (This is correct for your current Sanctuary layout because all combat happens on active floor.)
        if (zFloorH[z] === undefined) zFloorH[z] = w.activeFloorH | 0;

        const zoneFloor = zFloorH[z] | 0;

        // ---------------------------------------------------------
        // SAME-FLOOR GATING (Milestone C)
        // Zones ONLY affect entities on the same integer floor height.
        // ---------------------------------------------------------

        // Player damage (boss hazards) — only if player is on same floor
        const pdmg = w.zDamagePlayer[z] ?? 0;
        if (pdmg > 0 && zr > 0) {
            if ((w.activeFloorH | 0) === zoneFloor) {
                const dx = px - zx;
                const dy = py - zy;
                const rr = zr + PLAYER_R;
                if (dx * dx + dy * dy <= rr * rr) {
                    w.playerHp -= pdmg;
                    emitEvent(w, { type: "PLAYER_HIT", damage: pdmg, x: px, y: py });
                }
            }
        }

        // Enemy damage — only enemies on same floor
        const dmg = w.zDamage[z];
        if (dmg <= 0 || zr <= 0) continue;

        const nearbyEnemies = queryCircle(w.enemySpatialHash, zx, zy, zr + 50);
        const checkedEnemies = new Set<number>();

        for (let i = 0; i < nearbyEnemies.length; i++) {
            const e = nearbyEnemies[i];
            if (checkedEnemies.has(e)) continue;
            checkedEnemies.add(e);

            if (!w.eAlive[e]) continue;

            // Gate by floor:
            // enemies store continuous Z in (w as any).ez, and we already have the integer active floor.
            // We’ll treat an enemy as “on a floor” by rounding its z to integer.
            const ez = ((w as any).ez?.[e] ?? 0) as number;
            const enemyFloor = (ez + 0.00001) | 0; // stable int floor

            if (enemyFloor !== zoneFloor) continue;
            if (!isEnemyInCircle(w, e, zx, zy, zr)) continue;

            w.eHp[e] -= dmg;

            const ew = getEnemyWorld(w, e, T);
            emitEvent(w, {
                type: "ENEMY_HIT",
                enemyIndex: e,
                damage: dmg,
                x: ew.wx,
                y: ew.wy,
                isCrit: false,
                source: "OTHER",
            });

            if (w.eHp[e] <= 0) {
                w.eAlive[e] = false;
                w.kills++;
                onEnemyKilledForChallenge(w);

                emitEvent(w, {
                    type: "ENEMY_KILLED",
                    enemyIndex: e,
                    x: ew.wx,
                    y: ew.wy,
                    xpValue: 1,
                    source: "OTHER",
                });
            }
        }
    }

}
