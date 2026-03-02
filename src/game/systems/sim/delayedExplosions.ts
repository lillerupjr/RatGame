import { emitEvent, type World } from "../../../engine/world/world";
import { spawnZone, ZONE_KIND } from "../../factories/zoneFactory";

export type DelayedExplosion = {
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

export function enqueueDelayedExplosion(w: World, def: DelayedExplosion): void {
    const q = ((w as any)._delayedExplosions ??= []) as DelayedExplosion[];
    q.push(def);
}

export function tickDelayedExplosions(w: World, dt: number): void {
    const q = (w as any)._delayedExplosions as DelayedExplosion[] | undefined;
    if (!q || q.length === 0) return;

    for (let i = q.length - 1; i >= 0; i--) {
        const ex = q[i];
        ex.t -= dt;

        if (ex.t > 0) continue;

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

        emitEvent(w, { type: "VFX", id: "EXPLOSION", x: ex.x, y: ex.y, radius: ex.r });

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
