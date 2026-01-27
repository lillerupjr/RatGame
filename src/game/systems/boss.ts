import type { World } from "../world";
import { ENEMY_TYPE } from "../content/enemies";
import { spawnZone, ZONE_KIND } from "../factories/zoneFactory";

type BossId = "DOCKS_BOMBARD" | "CHINATOWN_DASH" | "SEWERS_PUDDLES";

type BossCtx = {
    id: BossId;
    t: number;

    // dash boss state
    dashPhase?: "IDLE" | "TELEGRAPH" | "DASH";
    dashT?: number;

    // delayed blasts
    delayed?: Array<{ t: number; x: number; y: number; r: number; dmg: number }>;
};

function findBossIndex(w: World): number {
    for (let i = 0; i < w.eAlive.length; i++) {
        if (w.eAlive[i] && w.eType[i] === ENEMY_TYPE.BOSS) return i;
    }
    return -1;
}

function bossIdForFloor(floorIndex: number): BossId {
    if (floorIndex === 0) return "DOCKS_BOMBARD";
    if (floorIndex === 1) return "CHINATOWN_DASH";
    return "SEWERS_PUDDLES";
}

function ensureCtx(w: World): BossCtx {
    const key = "_bossCtx";
    const existing = (w as any)[key] as BossCtx | undefined;
    const want = bossIdForFloor(w.floorIndex ?? 0);

    if (existing && existing.id === want) return existing;

    const ctx: BossCtx = { id: want, t: 0, delayed: [], dashPhase: "IDLE", dashT: 0 };
    (w as any)[key] = ctx;
    return ctx;
}

function telegraphCircle(w: World, x: number, y: number, r: number, ttl: number) {
    spawnZone(w, {
        kind: ZONE_KIND.TELEGRAPH,
        x,
        y,
        radius: r,
        damage: 0,
        damagePlayer: 0,
        tickEvery: 0.2,
        ttl,
        followPlayer: false,
    });
}

function hazardBlast(w: World, x: number, y: number, r: number, dmg: number, ttl = 0.35) {
    spawnZone(w, {
        kind: ZONE_KIND.HAZARD,
        x,
        y,
        radius: r,
        damage: 0,
        damagePlayer: dmg,
        tickEvery: 0.12,
        ttl,
        followPlayer: false,
    });
}

function hazardPuddle(w: World, x: number, y: number, r: number, dmg: number, tickEvery: number, ttl: number) {
    spawnZone(w, {
        kind: ZONE_KIND.HAZARD,
        x,
        y,
        radius: r,
        damage: 0,
        damagePlayer: dmg,
        tickEvery,
        ttl,
        followPlayer: false,
    });
}

export function bossSystem(w: World, dt: number) {
    if (w.runState !== "BOSS") return;

    const boss = findBossIndex(w);
    if (boss === -1) return;

    const ctx = ensureCtx(w);
    ctx.t += dt;

    // Process delayed blasts
    if (ctx.delayed && ctx.delayed.length > 0) {
        for (let i = ctx.delayed.length - 1; i >= 0; i--) {
            ctx.delayed[i].t -= dt;
            if (ctx.delayed[i].t <= 0) {
                const ex = ctx.delayed[i];
                hazardBlast(w, ex.x, ex.y, ex.r, ex.dmg);
                ctx.delayed.splice(i, 1);
            }
        }
    }

    // -------------------------
    // BOSS 1: Docks — Anchor Bombardment
    // -------------------------
    if (ctx.id === "DOCKS_BOMBARD") {
        const cadence = 2.8;
        if (ctx.t >= cadence) {
            ctx.t = 0;

            const n = 6;
            for (let k = 0; k < n; k++) {
                const a = w.rng.range(0, Math.PI * 2);
                const rr = w.rng.range(140, 260);
                const x = w.px + Math.cos(a) * rr;
                const y = w.py + Math.sin(a) * rr;

                telegraphCircle(w, x, y, 44, 0.9);
                ctx.delayed!.push({ t: 0.9, x, y, r: 52, dmg: 12 });
            }
        }
        return;
    }

    // -------------------------
    // BOSS 2: Chinatown — Redline Dash (telegraph lane -> dash -> trail blasts)
    // Uses movementSystem forced vel hook: (w as any)._bossForcedVel
    // -------------------------
    if (ctx.id === "CHINATOWN_DASH") {
        ctx.dashPhase = ctx.dashPhase ?? "IDLE";

        if (ctx.dashPhase === "IDLE") {
            if (ctx.t >= 3.2) {
                ctx.t = 0;
                ctx.dashPhase = "TELEGRAPH";
                ctx.dashT = 0.65;
            }
            return;
        }

        if (ctx.dashPhase === "TELEGRAPH") {
            ctx.dashT = Math.max(0, (ctx.dashT ?? 0) - dt);

            const dx = w.px - w.ex[boss];
            const dy = w.py - w.ey[boss];
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len;
            const uy = dy / len;

            // sprinkle telegraph markers along lane
            const markCd = ((w as any)._dashMarkCd ?? 0) as number;
            (w as any)._dashMarkCd = Math.max(0, markCd - dt);

            if ((w as any)._dashMarkCd <= 0) {
                (w as any)._dashMarkCd = 0.10;

                const sx = w.ex[boss];
                const sy = w.ey[boss];

                for (let j = 1; j <= 7; j++) {
                    telegraphCircle(w, sx + ux * j * 56, sy + uy * j * 56, 22, 0.35);
                }
            }

            if ((ctx.dashT ?? 0) <= 0) {
                ctx.dashPhase = "DASH";
                ctx.dashT = 0.55;

                const dashSpeed = 820;
                (w as any)._bossForcedVel = { enemyIndex: boss, vx: ux * dashSpeed, vy: uy * dashSpeed, tLeft: 0.55 };

                // trail blasts (telegraph quick then explode)
                for (let j = 1; j <= 8; j++) {
                    const x = w.ex[boss] + ux * j * 58;
                    const y = w.ey[boss] + uy * j * 58;
                    telegraphCircle(w, x, y, 26, 0.25);
                    ctx.delayed!.push({ t: 0.25, x, y, r: 30, dmg: 9 });
                }
            }
            return;
        }

        // DASH
        ctx.dashT = Math.max(0, (ctx.dashT ?? 0) - dt);
        if ((ctx.dashT ?? 0) <= 0) {
            ctx.dashPhase = "IDLE";
            (w as any)._bossForcedVel = undefined;
        }
        return;
    }

    // -------------------------
    // BOSS 3: Sewers — Chem Puddles (persistent hazards)
    // -------------------------
    {
        const cadence = 1.55;
        if (ctx.t >= cadence) {
            ctx.t = 0;

            const a = w.rng.range(0, Math.PI * 2);
            const rr = w.rng.range(90, 220);
            const x = w.px + Math.cos(a) * rr;
            const y = w.py + Math.sin(a) * rr;

            hazardPuddle(w, x, y, 64, 5, 0.25, 4.8);

            if (w.rng.next() < 0.25) {
                const a2 = a + w.rng.range(-0.9, 0.9);
                const rr2 = w.rng.range(120, 280);
                hazardPuddle(w, w.px + Math.cos(a2) * rr2, w.py + Math.sin(a2) * rr2, 52, 4, 0.22, 3.6);
            }
        }
    }
}