// src/game/systems/onKillExplode.ts
import { emitEvent, type World } from "../world";
import { isEnemyInCircle } from "./hitDetection";
import { spawnZone, ZONE_KIND } from "../factories/zoneFactory";
import { queryCircle } from "../util/spatialHash";
import { onEnemyKilledForChallenge } from "./roomChallenge";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";
import { getEnemyWorld } from "../coords/worldViews";

/**
 * Explode-on-kill (poison-gated):
 * - Triggers on ANY ENEMY_KILLED while enabled
 * - Only if the killed enemy was poisoned at death
 * - Damage is % of the killed enemy's MAX HP
 * - Scales with dmgMult (damage) and areaMult (radius)
 * - Allows chains by processing newly-added kill events in the same frame
 */
export function onKillExplodeSystem(w: World, _dt: number) {
    const cfg =
        (w as any)._explodeOnKill as
            | {
            enabled: boolean;
            pct: number;
            baseRadius: number;
            maxPerFrame?: number;

            // Evolved: explosions apply poison (seed chains)
            applyPoison?: boolean;
            poisonDur?: number;
            poisonDps?: number;

            // Optional visuals
            spawnVfx?: boolean;
        }
            | undefined;

    if (!cfg?.enabled) return;

    const pct = Math.max(0, cfg.pct ?? 0);
    const baseRadius = Math.max(0, cfg.baseRadius ?? 0);
    const maxPerFrame = Math.max(1, cfg.maxPerFrame ?? 80);

    const hasPoisonedOnDeath = Array.isArray((w as any).ePoisonedOnDeath);

    let pops = 0;

    // Process kill events, including those created by explosions this frame (chains).
    for (let ei = 0; ei < w.events.length; ei++) {
        const ev = w.events[ei];
        if (ev.type !== "ENEMY_KILLED") continue;
        if (pops >= maxPerFrame) break;

        const killed = ev.enemyIndex;

        // Gate: must have been poisoned at death
        const poisonedAtDeath = hasPoisonedOnDeath
            ? !!(w as any).ePoisonedOnDeath[killed]
            : (w.ePoisonT?.[killed] ?? 0) > 0;

        if (!poisonedAtDeath) continue;

        const maxHp = w.eHpMax[killed];
        if (!(maxHp > 0)) continue;

        const radius = baseRadius * (w.areaMult ?? 1);
        if (!(radius > 0)) continue;

        const dmg = maxHp * pct * (w.dmgMult ?? 1);
        if (!(dmg > 0)) continue;

        pops++;

        const cx = ev.x;
        const cy = ev.y;

        if (cfg.spawnVfx !== false) {
            // Requires ZONE_KIND.EXPLOSION in zoneFactory + render handling
            spawnZone(w, {
                kind: ZONE_KIND.EXPLOSION,
                x: cx,
                y: cy,
                radius,
                damage: 0,
                tickEvery: 999,
                ttl: 0.35,
                followPlayer: false,
            });
        }

// NEW: syringe explosion sound (distinct from bazooka)
        emitEvent(w, { type: "SFX", id: "EXPLOSION_SYRINGE", vol: 0.55 });

        // AoE damage application - using spatial hash for efficiency
        const nearbyEnemies = queryCircle(w.enemySpatialHash, cx, cy, radius + 50); // 50 = max enemy radius buffer
        const checkedEnemies = new Set<number>();

        for (let i = 0; i < nearbyEnemies.length; i++) {
            const e = nearbyEnemies[i];
            
            // Skip duplicates (enemies spanning multiple cells)
            if (checkedEnemies.has(e)) continue;
            checkedEnemies.add(e);
            
            if (!w.eAlive[e]) continue;
            if (!isEnemyInCircle(w, e, cx, cy, radius)) continue;

            // IMPORTANT: apply poison BEFORE damage so explosion-kills count as poisoned
            if (cfg.applyPoison) {
                const dur = Math.max(0, cfg.poisonDur ?? 0);
                const dps = Math.max(0, cfg.poisonDps ?? 0);
                if (dur > 0 && dps > 0) {
                    w.ePoisonDps[e] += dps;
                    w.ePoisonT[e] = Math.max(w.ePoisonT[e], dur);
                }
            }

            w.eHp[e] -= dmg;

            const ew = getEnemyWorld(w, e, KENNEY_TILE_WORLD);
            emitEvent(w, {
                type: "ENEMY_HIT",
                enemyIndex: e,
                damage: dmg,
                x: ew.wx,
                y: ew.wy,
                isCrit: false, // Explosion damage doesn't crit
                source: "OTHER",
            });

            if (w.eHp[e] <= 0) {
                w.eAlive[e] = false;
                w.kills++;
                onEnemyKilledForChallenge(w);

                // Snapshot poison-at-death for chain gating (if you have the array)
                if (hasPoisonedOnDeath) {
                    (w as any).ePoisonedOnDeath[e] = (w.ePoisonT[e] > 0);
                }

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
