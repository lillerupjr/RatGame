// src/game/systems/projectiles.ts
import type { World } from "../world";

/**
 * Projectile movement + lifetime cleanup.
 *
 * Behaviors:
 * - Normal: integrates velocity
 * - Orbital: orbits player; ignores velocity
 *
 * Range limiting:
 * - If prMaxDist > 0, projectile is removed once it exceeds start->current distance.
 */
export function projectilesSystem(w: World, dt: number) {
    const moveSpeedMult = w.baseMoveSpeed > 0 ? w.pSpeed / w.baseMoveSpeed : 1;

    for (let i = 0; i < w.pAlive.length; i++) {
        if (!w.pAlive[i]) continue;

        // TTL
        w.prTtl[i] -= dt;
        if (w.prTtl[i] <= 0) {
            w.pAlive[i] = false;
            continue;
        }

        // Orbital projectiles
        if (!w.prIsOrbital[i]) {
            const vx = w.prvx[i] * moveSpeedMult;
            const vy = w.prvy[i] * moveSpeedMult;

            w.prx[i] += vx * dt;
            w.pry[i] += vy * dt;

            // Wall bounce (only for projectiles that opted-in)
            if (w.prWallBounce[i] && w.pAlive[i]) {
                const ww = (w as any).viewW ?? 800;
                const hh = (w as any).viewH ?? 600;

                // Camera is centered on player in renderSystem:
                // cx = ww*0.5 - w.px, so world-space view bounds:
                const left = w.px - ww * 0.5;
                const right = w.px + ww * 0.5;
                const top = w.py - hh * 0.5;
                const bottom = w.py + hh * 0.5;

                const r = w.prR[i];
                let bounced = false;

                // If this projectile uses bounce rules, wall bounce consumes bounces too.
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
                    // Update direction vectors (some systems rely on prDirX/Y being sane)
                    const nvx = w.prvx[i];
                    const nvy = w.prvy[i];
                    const nLen = Math.hypot(nvx, nvy) || 0.0001;
                    w.prDirX[i] = nvx / nLen;
                    w.prDirY[i] = nvy / nLen;

                    // Consume a bounce if this projectile is a bouncer
                    if (w.prBouncesLeft[i] >= 0) {
                        w.prBouncesLeft[i] -= 1;
                    }

                    // Also clear "last hit" so it doesn't get stuck in an ignore loop after wall bounce
                    w.prLastHitEnemy[i] = -1;
                    w.prLastHitCd[i] = 0;
                }
            }
        } if (w.prIsOrbital[i]) {
            // Orbitals ignore prVx/prVy. They are positioned around the player each frame.
            const angVel = w.prOrbBaseAngVel[i] || 0;
            const baseR = w.prOrbBaseRadius[i] || 0;

            // Advance angle
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

            // Keep direction sane (optional, but prevents NaNs in any render that uses prDir)
            w.prDirX[i] = Math.cos(a);
            w.prDirY[i] = Math.sin(a);
        }

        // Normal projectiles: integrate velocity
        w.prx[i] += w.prvx[i] * dt;
        w.pry[i] += w.prvy[i] * dt;

        // Range limit (if enabled)
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
