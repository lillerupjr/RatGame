// src/game/systems/projectiles.ts
import type { World } from "../world";
import { playerWorldPos, projectileWorldPos } from "../world";
import { spawnZone, ZONE_KIND } from "../factories/zoneFactory";
import {heightAtWorld, queryVisibilityAtWorld, WalkInfo, walkInfo} from "../map/kenneyMap";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";
import { worldToGrid } from "../coords/grid";
import {
    isUnderOcclusionCeiling,
    VISIBILITY_BELOW_CEILING_EPS,
} from "../map/visibility";

// Phase 2: projectile vs stairs collision
// Tune this to make stairs “thicker/thinner” for projectile blocking.
export let PROJECTILE_STAIRS_Z_TOL = 0.35;
// How far below occlusion ceiling counts as "under" for projectile hiding.
// NOTE: unified with generic visibility epsilon. Keep this as a projectile-facing
// alias so existing tuning workflows still work.
export let PROJECTILE_BELOW_GROUND_EPS = VISIBILITY_BELOW_CEILING_EPS;

// --- Movement substepping (prevents "one whole tile per frame") ---
export let PROJECTILE_MAX_MOVE_FRAC_PER_STEP = 0.5;   // fraction of tile per move substep
export let PROJECTILE_MAX_MOVE_STEPS = 12;            // hard cap for perf

// --- Ground / occlusion sampling ---
export let PROJECTILE_GROUND_SAMPLE_SPAN_FRAC = 0.10; // ~10 samples per tile traveled
export let PROJECTILE_GROUND_SAMPLE_MAX_STEPS = 32;
export let PROJECTILE_GROUND_SAMPLE_STEPS = 1;
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
    const pw = playerWorldPos(w, T);
    const px = pw.wx;
    const py = pw.wy;
    // Phase 1: no stair/projectile coupling

    const syncProjectileGrid = (i: number, wx: number, wy: number) => {
        const gp = worldToGrid(wx, wy, T);
        const gxi = Math.floor(gp.gx);
        const gyi = Math.floor(gp.gy);
        w.prgxi[i] = gxi;
        w.prgyi[i] = gyi;
        w.prgox[i] = gp.gx - gxi;
        w.prgoy[i] = gp.gy - gyi;
    };

    for (let i = 0; i < w.pAlive.length; i++) {
        if (!w.pAlive[i]) continue;
        const wp0 = projectileWorldPos(w, i, T);
        let ox = wp0.wx;
        let oy = wp0.wy;

        // TTL
        w.prTtl[i] -= dt;
        if (w.prTtl[i] <= 0) {
            w.pAlive[i] = false;
            continue;
        }

        // Phase 3: render-only hide should be evaluated continuously (not sticky)
        w.prHidden[i] = false;

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
            ox = px + Math.cos(a) * r;
            oy = py + Math.sin(a) * r;
            syncProjectileGrid(i, ox, oy);

            // Keep direction sane
            w.prDirX[i] = Math.cos(a);
            w.prDirY[i] = Math.sin(a);
        } else {
            // Restore previous "double integration" feel (pre-fix behavior) without reintroducing the bug.
            const PROJECTILE_SPEED_MULT = 2;

            const vx = w.prvx[i] * moveSpeedMult * PROJECTILE_SPEED_MULT;
            const vy = w.prvy[i] * moveSpeedMult * PROJECTILE_SPEED_MULT;

            // ox/oy already set from grid



            const maxStepDist = Math.max(1e-6, T * Math.max(0.05, PROJECTILE_MAX_MOVE_FRAC_PER_STEP));
            const totalDist = Math.hypot(vx * dt, vy * dt);
            const moveSteps = Math.min(PROJECTILE_MAX_MOVE_STEPS, Math.max(1, Math.ceil(totalDist / maxStepDist)));

            let hitGround = false;

            for (let m = 0; m < moveSteps; m++) {
                const subDt = dt / moveSteps;

                const nx = ox + vx * subDt;
                const ny = oy + vy * subDt;

                // Ground-under sampling inside THIS small move (adaptive to distance)
                const segDx = nx - ox;
                const segDy = ny - oy;
                const segDist = Math.hypot(segDx, segDy);

// baseline minimum
                const baseSteps = Math.max(1, PROJECTILE_GROUND_SAMPLE_STEPS | 0);

// adaptive: aim for ~1 sample every (tile * spanFrac)
                const spanFrac = Math.max(1e-4, PROJECTILE_GROUND_SAMPLE_SPAN_FRAC);
                const wantSteps = Math.ceil(segDist / (T * spanFrac));

// clamp for perf
                const maxSteps = Math.max(1, PROJECTILE_GROUND_SAMPLE_MAX_STEPS | 0);
                const steps = Math.min(maxSteps, Math.max(baseSteps, wantSteps));

                for (let s = 1; s <= steps; s++) {
                    const tt = s / steps;
                    const sx = ox + segDx * tt;
                    const sy = oy + segDy * tt;

                    const pzAbs = (w.prZ?.[i] ?? 0);

                    // Open-stairs rule:
                    // - Stairs do NOT visually hide projectiles
                    // - But stairs DO block projectiles if they collide at the stair surface height
                    const wi = walkInfo(sx, sy, T);
                    if (wi.walkable && wi.kind === "STAIRS") {
                        const dz = Math.abs(pzAbs - wi.z);
                        if (dz <= PROJECTILE_STAIRS_Z_TOL) {
                            w.pAlive[i] = false;
                            hitGround = true; // stop further work this frame
                            break;
                        }
                        // If we're not colliding, we also don't treat stairs as occluders.
                        continue;
                    }

                    // Non-stairs: keep the existing occlusion-based “underground / under-platform” behavior
                    const vis = queryVisibilityAtWorld(sx, sy, pzAbs, T, PROJECTILE_BELOW_GROUND_EPS);
                    if (vis.occluded) {
                        hitGround = true;
                        break;
                    }
                }


                // Commit the substep move
                ox = nx;
                oy = ny;

                if (hitGround) break;
            }

            if (hitGround) {
                w.prHidden[i] = true;
                continue;
            }

            // Wall bounce (only for projectiles that opted-in)
                if (w.prWallBounce[i] && w.pAlive[i]) {
                    const ww = (w as any).viewW ?? 800;
                    const hh = (w as any).viewH ?? 600;

                // Camera is centered on player in renderSystem:
                // camX = ww*0.5 - proj(player), so world-space view bounds:
                const left = px - ww * 0.5;
                const right = px + ww * 0.5;
                const top = py - hh * 0.5;
                const bottom = py + hh * 0.5;

                const r = w.prR[i];
                let bounced = false;

                const bLeft = w.prBouncesLeft[i];

                // Left / Right
                if (ox - r < left) {
                    if (bLeft >= 0 && bLeft <= 0) {
                        w.pAlive[i] = false;
                    } else {
                        ox = left + r;
                        w.prvx[i] = Math.abs(w.prvx[i]);
                        bounced = true;
                    }
                } else if (ox + r > right) {
                    if (bLeft >= 0 && bLeft <= 0) {
                        w.pAlive[i] = false;
                    } else {
                        ox = right - r;
                        w.prvx[i] = -Math.abs(w.prvx[i]);
                        bounced = true;
                    }
                }

                // Top / Bottom
                if (w.pAlive[i]) {
                    if (oy - r < top) {
                        if (bLeft >= 0 && bLeft <= 0) {
                            w.pAlive[i] = false;
                        } else {
                            oy = top + r;
                            w.prvy[i] = Math.abs(w.prvy[i]);
                            bounced = true;
                        }
                    } else if (oy + r > bottom) {
                        if (bLeft >= 0 && bLeft <= 0) {
                            w.pAlive[i] = false;
                        } else {
                            oy = bottom - r;
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

            if (w.pAlive[i]) {
                const info: WalkInfo = walkInfo(ox, oy, T);
                if (info.kind === "STAIRS" && info.walkable) {
                    const stairZ = heightAtWorld(ox, oy, T);
                    const dz = Math.abs((w.prZ[i] ?? 0) - stairZ);
                    if (dz <= PROJECTILE_STAIRS_Z_TOL) {
                        w.pAlive[i] = false;
                    }
                }
            }
        }

        // -------------------------
        // Explode-on-target (bazooka)
        // -------------------------
        if (w.prHasTarget[i]) {
            const tx = w.prTargetX[i];
            const ty = w.prTargetY[i];

            const dx = tx - ox;
            const dy = ty - oy;

            const thresh = Math.max(8, w.prR[i] || 0);
            if (dx * dx + dy * dy <= thresh * thresh) {
                // Snap to target for clean visuals
                ox = tx;
                oy = ty;

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
            const dx = ox - (w.prStartX[i] ?? ox);
            const dy = oy - (w.prStartY[i] ?? oy);
            if (dx * dx + dy * dy > maxDist * maxDist) {
                w.pAlive[i] = false;
            }
        }

        if (w.prLastHitCd[i] > 0) w.prLastHitCd[i] = Math.max(0, w.prLastHitCd[i] - dt);

        if (w.pAlive[i]) {
            syncProjectileGrid(i, ox, oy);
        }
    }
}
