// src/game/systems/onKillExplode.ts
import type { World } from "../world";
import { emitEvent } from "../world";
import { spawnZone, ZONE_KIND } from "../factories/zoneFactory";

/**
 * Explode-on-kill (poison-gated):
 * - Triggers on ANY ENEMY_KILLED while enabled
 * - BUT only if the killed enemy was poisoned at death
 * - Damage is % of the killed enemy's MAX HP
 * - Scales with dmgMult (damage) and areaMult (radius)
 * - Allows chains by processing newly-added kill events in the same frame
 * - Per-frame safety cap prevents runaway loops
 *
 * Evolved behavior:
 * - Explosions can apply poison (seed chains)
 */
export function onKillExplodeSystem(w: World, _dt: number) {
    const cfg =
        (w as any)._explodeOnKill as
            | {
            enabled: boolean;
            pct: number;        // e.g. 0.20 = 20% of killed enemy max HP
            baseRadius: number; // base radius before areaMult
            maxPerFrame?: number;

            // Evolved: explosions apply poison
            applyPoison?: boolean;
            poisonDur?: number; // seconds
            poisonDps?: number; // damage per second (not scaled here; scale upstream if desired)
        }
            | undefined;

    if (!cfg?.enabled) return;

    const pct = Math.max(0, cfg.pct ?? 0);
    const baseRadius = Math.max(0, cfg.baseRadius ?? 0);
    const maxPerFrame = Math.max(1, cfg.maxPerFrame ?? 80);

    let pops = 0;

    // Process kill events, including those created by explosions this frame (chains).
    // We intentionally do NOT clear events here; game.ts clears them after consumers.
    for (let ei = 0; ei < w.events.length; ei++) {
        const ev = w.events[ei];
        if (ev.type !== "ENEMY_KILLED") continue;

        if (pops >= maxPerFrame) break;

        const killed = ev.enemyIndex;

        // NEW: must have been poisoned at death (snapshotted)
        if (!w.ePoisonedOnDeath[killed]) continue;


        const maxHp = w.eHpMax[killed];
        if (!(maxHp > 0)) continue;

        const radius = baseRadius * (w.areaMult ?? 1);
        if (!(radius > 0)) continue;

        const r2 = radius * radius;

        // Base: % of killed enemy max HP. Then scale by player's dmg multiplier.
        const dmg = maxHp * pct * (w.dmgMult ?? 1);
        if (!(dmg > 0)) continue;

        pops++;


        const cx = ev.x;
        const cy = ev.y;

        // --- Visual-only explosion ring ---
        spawnZone(w, {
            kind: ZONE_KIND.EXPLOSION,
            x: cx,
            y: cy,
            radius,
            damage: 0,          // visual only
            tickEvery: 1,       // irrelevant
            ttl: 0.35,          // very short-lived
            followPlayer: false,
        });


        // Deal AoE damage to nearby ALIVE enemies.
        for (let e = 0; e < w.eAlive.length; e++) {
            if (!w.eAlive[e]) continue;

            const dx = w.ex[e] - cx;
            const dy = w.ey[e] - cy;
            if (dx * dx + dy * dy > r2) continue;

            // Optional evolved behavior: apply poison to enemies hit by the explosion
            if (cfg.applyPoison) {
                const dur = Math.max(0, cfg.poisonDur ?? 0);
                const dps = Math.max(0, cfg.poisonDps ?? 0);

                if (dur > 0 && dps > 0) {
                    // Simple stacking model: add DPS, refresh duration to max
                    w.ePoisonDps[e] += dps;
                    w.ePoisonT[e] = Math.max(w.ePoisonT[e], dur);
                }
            }

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

                // snapshot poison-at-death for chain logic
                w.ePoisonedOnDeath[e] = (w.ePoisonT[e] > 0);

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
