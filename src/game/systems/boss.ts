// src/game/systems/boss.ts

import { type World } from "../world";
import { ENEMY_TYPE } from "../content/enemies";
import { spawnZone, ZONE_KIND } from "../factories/zoneFactory";
import { getEnemyWorld, getPlayerWorld } from "../coords/worldViews";

type BossId = "DOCKS_BOMBARD" | "SEWERS_PUDDLES" | "CHINATOWN_DASH";

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
    if (floorIndex === 1) return "SEWERS_PUDDLES";
    return "CHINATOWN_DASH";
}

function ensureCtx(w: World): BossCtx {
    const key = "_bossCtx";
    const existing = (w as any)[key] as BossCtx | undefined;

    // Tie boss behavior to FLOOR (not stage timeline), so it always matches floor visuals/mobs.
    const want = bossIdForFloor(w.floorIndex ?? 0);

    // Reset state when changing floor or restarting boss encounter
    if (existing && existing.id === want) return existing;

    const ctx: BossCtx = {
        id: want,
        t: 0,
        delayed: [],
        dashPhase: "IDLE",
        dashT: 0,
    };
    (w as any)[key] = ctx;

    // Clear any dash mark cooldown from the previous boss
    (w as any)._dashMarkCd = 0;

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
    const pw = getPlayerWorld(w);
    const px = pw.wx;
    const py = pw.wy;

    // -------------------------
    // Boss difficulty scaling
    // -------------------------
    const floor = (w.floorIndex ?? 0) | 0;

    // Later floors are harder (even though each boss is on a specific floor,
    // this keeps the knobs in one place and future-proofs variants).
    const DIFF = 1 + floor * 0.55;          // 1.00 / 1.55 / 2.10
    const CAD = 1 / (1 + floor * 0.18);     // cadence multiplier (smaller => faster attacks)
    const HAZ = 1 + floor * 0.35;           // hazard damage multiplier
    const COVER = 1 + floor * 0.22;         // hazard coverage multiplier

    const hpMax = w.eHpMax[boss] || 1;
    const hpPct = (w.eHp[boss] || 0) / hpMax;

    // Enrage below 40% HP
    const ENRAGE = hpPct < 0.4 ? 1.35 : 1.0;

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
        const cadence = 2.15 * CAD / ENRAGE; // was 2.8
        if (ctx.t >= cadence) {
            ctx.t = 0;

            const n = Math.max(6, Math.round(8 * COVER)); // was 6
            for (let k = 0; k < n; k++) {
                const a = w.rng.range(0, Math.PI * 2);
                const rr = w.rng.range(120, 280); // slightly tighter => more relevant pressure
                const x = px + Math.cos(a) * rr;
                const y = py + Math.sin(a) * rr;

                const teleT = 0.52; // faster warning than before (0.9), but still readable
                const teleR = 34 * COVER;
                const blastR = 46 * COVER;

                telegraphCircle(w, x, y, teleR, teleT);
                ctx.delayed!.push({
                    t: teleT,
                    x,
                    y,
                    r: blastR,
                    dmg: 10 * HAZ * ENRAGE, // was 12 (but now scales + enrages)
                });
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
            const idleCadence = 2.55 * CAD / ENRAGE; // was 3.2
            if (ctx.t >= idleCadence) {
                ctx.t = 0;
                ctx.dashPhase = "TELEGRAPH";
                ctx.dashT = 0.58; // was 0.65
            }
            return;
        }

        if (ctx.dashPhase === "TELEGRAPH") {
            ctx.dashT = Math.max(0, (ctx.dashT ?? 0) - dt);

            const ew = getEnemyWorld(w, boss);
            const dx = px - ew.wx;
            const dy = py - ew.wy;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len;
            const uy = dy / len;

            // sprinkle telegraph markers along lane
            const markCd = ((w as any)._dashMarkCd ?? 0) as number;
            (w as any)._dashMarkCd = Math.max(0, markCd - dt);

            if ((w as any)._dashMarkCd <= 0) {
                (w as any)._dashMarkCd = 0.085; // was 0.10 (denser lane telegraph)
                const sx = ew.wx;
                const sy = ew.wy;

                const marks = 8; // was 7
                for (let j = 1; j <= marks; j++) {
                    telegraphCircle(w, sx + ux * j * 54, sy + uy * j * 54, 22 * COVER, 0.30);
                }
            }

            if ((ctx.dashT ?? 0) <= 0) {
                ctx.dashPhase = "DASH";
                ctx.dashT = 0.55;

                const dashSpeed = 900 * (0.95 + 0.05 * DIFF); // was 820
                (w as any)._bossForcedVel = {
                    enemyIndex: boss,
                    vx: ux * dashSpeed,
                    vy: uy * dashSpeed,
                    tLeft: 0.55,
                };

                // trail blasts (telegraph quick then explode) — now bigger + hurts
                const steps = 9; // was 8
                for (let j = 1; j <= steps; j++) {
                    const x = ew.wx + ux * j * 58;
                    const y = ew.wy + uy * j * 58;

                    const teleT = 0.26;
                    telegraphCircle(w, x, y, 26 * COVER, teleT);

                    ctx.delayed!.push({
                        t: teleT,
                        x,
                        y,
                        r: 36 * COVER,                // was 30
                        dmg: 12 * HAZ * ENRAGE,        // was 9
                    });
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
        const cadence = 1.18 * CAD / ENRAGE; // was 1.55
        if (ctx.t >= cadence) {
            ctx.t = 0;

            const a = w.rng.range(0, Math.PI * 2);
            const rr = w.rng.range(80, 220); // slightly tighter + sometimes closer
            const x = px + Math.cos(a) * rr;
            const y = py + Math.sin(a) * rr;

            // Main puddle: bigger + longer + more dmg
            hazardPuddle(
                w,
                x,
                y,
                72 * COVER,                 // was 64
                7 * HAZ * ENRAGE,           // was 5
                0.22,                       // was 0.25
                6.2                         // was 4.8
            );

            // Extra denial puddles (more common + optionally multiple)
            const extraChance = Math.min(0.65, 0.35 + 0.10 * floor); // was 0.25
            if (w.rng.next() < extraChance) {
                const extras = 1 + (w.rng.next() < 0.25 ? 1 : 0); // 1–2
                for (let j = 0; j < extras; j++) {
                    const a2 = a + w.rng.range(-1.1, 1.1);
                    const rr2 = w.rng.range(140, 340);

                    hazardPuddle(
                        w,
                        px + Math.cos(a2) * rr2,
                        py + Math.sin(a2) * rr2,
                        58 * COVER,             // was 52
                        6 * HAZ * ENRAGE,       // was 4
                        0.22,                   // was 0.22
                        5.0                     // was 3.6
                    );
                }
            }
        }
    }
}
