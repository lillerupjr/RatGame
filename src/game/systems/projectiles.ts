// src/game/systems/projectiles.ts
import type { World } from "../world";
import { spawnZone, ZONE_KIND } from "../factories/zoneFactory";
import { getTile } from "../map/kenneyMap";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";

/**
 * Projectile movement + lifetime cleanup.
 *
 * Behaviors:
 * - Normal: integrates velocity
 * - Orbital: orbits player; ignores velocity
 *
 * Range limiting:
 * - If prMaxDist > 0, projectile is removed once it exceeds start->current distance.
 *
 * * Milestone C:
 *  * - Projectiles have height (prZ).
 *  *
 *  * STAIRS → CONNECTORS migration note (Phase 0: contract freeze):
 *  * - Phase 1 will REMOVE any stair-tile coupling for projectile lifetime/collision.
 *  * - Projectiles must not reference stair tiles; only compare prZ vs enemy vertical hit ranges.
 *  * See: docs/stairs-connectors-master.md)
 */
export function projectilesSystem(w: World, dt: number) {
    const moveSpeedMult = w.baseMoveSpeed > 0 ? w.pSpeed / w.baseMoveSpeed : 1;
    const T = KENNEY_TILE_WORLD;
    const STAIR_PROJECTILE_BLOCK_OFFSET = 3;

    for (let i = 0; i < w.pAlive.length; i++) {
        if (!w.pAlive[i]) continue;

        // TTL
        w.prTtl[i] -= dt;
        if (w.prTtl[i] <= 0) {
            w.pAlive[i] = false;
            continue;
        }

        // -------------------------
        // Move
        // -------------------------
        if (w.prIsOrbital[i]) {
            // Orbitals ignore prVx/prVy. They are positioned around the player each frame.
            const angVel = w.prOrbBaseAngVel[i] || 0;
            const baseR = w.prOrbBaseRadius[i] || 0;

            let a = w.prOrbAngle[i] || 0;
            a += angVel * dt;
            if (a > Math.PI * 2) a -= Math.PI * 2;
            w.prOrbAngle[i] = a;

            // Orbit radius scales with AREA (matches your other patterns)
            const areaMult = (w as any).areaMult ?? 1;
            const r = baseR * areaMult;

            // Center on player
            w.prx[i] = w.px + Math.cos(a) * r;
            w.pry[i] = w.py + Math.sin(a) * r;

            // Keep direction sane
            w.prDirX[i] = Math.cos(a);
            w.prDirY[i] = Math.sin(a);
        } else {
// Restore previous "double integration" feel (pre-fix behavior) without reintroducing the bug.
            const PROJECTILE_SPEED_MULT = 2;

            const vx = w.prvx[i] * moveSpeedMult * PROJECTILE_SPEED_MULT;
            const vy = w.prvy[i] * moveSpeedMult * PROJECTILE_SPEED_MULT;

            w.prx[i] += vx * dt;
            w.pry[i] += vy * dt;
            // Wall bounce (only for projectiles that opted-in)
            if (w.prWallBounce[i] && w.pAlive[i]) {
                const ww = (w as any).viewW ?? 800;
                const hh = (w as any).viewH ?? 600;

                // Camera is centered on player in renderSystem:
                // camX = ww*0.5 - proj(player), so world-space view bounds:
                const left = w.px - ww * 0.5;
                const right = w.px + ww * 0.5;
                const top = w.py - hh * 0.5;
                const bottom = w.py + hh * 0.5;

                const r = w.prR[i];
                let bounced = false;

                const bLeft = w.prBouncesLeft[i];

                // Left / Right
                if (w.prx[i] - r < left) {
                    if (bLeft >= 0 && bLeft <= 0) {
                        w.pAlive[i] = false;
                    } else {
                        w.prx[i] = left + r;
                        w.prvx[i] = Math.abs(w.prvx[i]);
                        bounced = true;
                    }
                } else if (w.prx[i] + r > right) {
                    if (bLeft >= 0 && bLeft <= 0) {
                        w.pAlive[i] = false;
                    } else {
                        w.prx[i] = right - r;
                        w.prvx[i] = -Math.abs(w.prvx[i]);
                        bounced = true;
                    }
                }

                // Top / Bottom
                if (w.pAlive[i]) {
                    if (w.pry[i] - r < top) {
                        if (bLeft >= 0 && bLeft <= 0) {
                            w.pAlive[i] = false;
                        } else {
                            w.pry[i] = top + r;
                            w.prvy[i] = Math.abs(w.prvy[i]);
                            bounced = true;
                        }
                    } else if (w.pry[i] + r > bottom) {
                        if (bLeft >= 0 && bLeft <= 0) {
                            w.pAlive[i] = false;
                        } else {
                            w.pry[i] = bottom - r;
                            w.prvy[i] = -Math.abs(w.prvy[i]);
                            bounced = true;
                        }
                    }
                }

                if (w.pAlive[i] && bounced) {
                    // Update direction vectors
                    const nvx = w.prvx[i];
                    const nvy = w.prvy[i];
                    const nLen = Math.hypot(nvx, nvy) || 0.0001;
                    w.prDirX[i] = nvx / nLen;
                    w.prDirY[i] = nvy / nLen;

                    // Consume a bounce
                    if (w.prBouncesLeft[i] >= 0) w.prBouncesLeft[i] -= 1;

                    // Clear ignore loop guards
                    w.prLastHitEnemy[i] = -1;
                    w.prLastHitCd[i] = 0;
                }
            }

            // -------------------------
            // Map collision: STAIRS step-up
            // -------------------------
            const tx = Math.floor(w.prx[i] / KENNEY_TILE_WORLD);
            const ty = Math.floor(w.pry[i] / KENNEY_TILE_WORLD);
            const t = getTile(tx, ty);

            if (t.kind === "STAIRS") {
                const stairBaseH = (t.h ?? 0) | 0;
                const projZ = w.prZ?.[i] ?? 0;
                const projH = Math.floor(projZ);

                // stairTopH = stairBaseH + 1
                // kill when stairTopH == projH + STAIR_PROJECTILE_BLOCK_OFFSET
                if (stairBaseH + 1 === projH + STAIR_PROJECTILE_BLOCK_OFFSET) {
                    w.pAlive[i] = false;
                    continue;
                }
            }
        }

        // -------------------------
        // Explode-on-target (bazooka)
        // -------------------------
        if (w.prHasTarget[i]) {
            const tx = w.prTargetX[i];
            const ty = w.prTargetY[i];

            const dx = tx - w.prx[i];
            const dy = ty - w.pry[i];

            const thresh = Math.max(8, w.prR[i] || 0);
            if (dx * dx + dy * dy <= thresh * thresh) {
                // Snap to target for clean visuals
                w.prx[i] = tx;
                w.pry[i] = ty;

                const blastR = Math.max(0, w.prExplodeR[i] ?? 0);
                if (blastR > 0) {
                    const z = spawnZone(w, {
                        kind: ZONE_KIND.EXPLOSION,
                        x: tx,
                        y: ty,
                        radius: blastR,
                        damage: w.prDamage[i],
                        tickEvery: 0.05,
                        ttl: 0.12,
                        followPlayer: false,
                    });

                    // Apply first tick immediately (instant explosion feel)
                    w.zTickLeft[z] = 0;
                }

                // Rocket is consumed by the explosion
                w.pAlive[i] = false;
                continue;
            }
        }

        // -------------------------
        // Range limit
        // -------------------------
        const maxDist = w.prMaxDist[i] ?? 0;
        if (maxDist > 0) {
            const dx = w.prx[i] - (w.prStartX[i] ?? w.prx[i]);
            const dy = w.pry[i] - (w.prStartY[i] ?? w.pry[i]);
            if (dx * dx + dy * dy > maxDist * maxDist) {
                w.pAlive[i] = false;
            }
        }

        if (w.prLastHitCd[i] > 0) w.prLastHitCd[i] = Math.max(0, w.prLastHitCd[i] - dt);
    }
}
