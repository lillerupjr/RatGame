// src/game/systems/collisions.ts
import { World, emitEvent } from "../world";
import { isEnemyHit, isPlayerHit } from "./hitDetection";
import { registry } from "../content/registry";
import { spawnZone, ZONE_KIND } from "../factories/zoneFactory";


/**
 * Handles:
 * - projectile ↔ enemy collisions
 * - player ↔ enemy contact damage (with i-frames)
 *
 * Emits events instead of spawning XP or doing other cross-system side effects.
 */
export function collisionsSystem(w: World, dt: number) {
  // -------------------------
  // Projectiles vs Enemies
  // -------------------------
  for (let p = 0; p < w.pAlive.length; p++) {
    if (!w.pAlive[p]) continue;

    // NEW: Bazooka rockets (and other special projectiles) can opt out of collisions
    if (w.prNoCollide[p]) continue;


    const px = w.prx[p];
    const py = w.pry[p];
    const pr = w.prR[p];

    // Track whether this projectile hit something this frame (kept for future use)
    let hitSomething = false;

    for (let e = 0; e < w.eAlive.length; e++) {
      if (!w.eAlive[e]) continue;

      const dx = w.ex[e] - px;
      const dy = w.ey[e] - py;
      const rr = w.eR[e] + pr;

      if (!isEnemyHit(w, p, e, dx, dy, rr)) continue;

      // Prevent the same piercing projectile from repeatedly hitting the same enemy every frame
      if (w.prLastHitEnemy[p] === e && w.prLastHitCd[p] > 0) {
        continue; // skip this hit entirely (no dmg, no poison, no pierce consume)
      }

      // HIT
      hitSomething = true;

      const dmg = w.prDamage[p];
      w.eHp[e] -= dmg;

      // Poison payload (applied once per hit)
      const pdps = w.prPoisonDps[p];
      const pdur = w.prPoisonDur[p];
      if (pdur > 0 && pdps > 0) {
        w.ePoisonDps[e] += pdps;
        w.ePoisonT[e] = Math.max(w.ePoisonT[e], pdur);
      }

      // Lock out re-hitting this same enemy for a short time
      w.prLastHitEnemy[p] = e;
      w.prLastHitCd[p] = 0.12; // tune: 0.08–0.16

      emitEvent(w, {
        type: "ENEMY_HIT",
        enemyIndex: e,
        damage: dmg,
        x: w.ex[e],
        y: w.ey[e],
        source: registry.projectileSourceFromKind(w.prjKind[p]),
      });

      // Bounce / pierce handling
      // If prBouncesLeft[p] >= 0 => this projectile uses ricochet rules.
      // Otherwise, use normal pierce rules.
      const bLeft = w.prBouncesLeft[p];

      if (bLeft >= 0) {
        // If no bounces left, it dies on this hit (after dealing damage).
        if (bLeft <= 0) {
          w.pAlive[p] = false;
        } else {
          // Pool-style ricochet: reflect velocity about the collision normal.
          // Normal points from enemy center -> projectile center.
          const ex = w.ex[e];
          const ey = w.ey[e];

          let nx = px - ex;
          let ny = py - ey;

          const nLen = Math.hypot(nx, ny) || 0.0001;
          nx /= nLen;
          ny /= nLen;

          const vx = w.prvx[p];
          const vy = w.prvy[p];

          // Reflect: v' = v - 2*(v·n)*n
          const dot = vx * nx + vy * ny;
          const rvx = vx - 2 * dot * nx;
          const rvy = vy - 2 * dot * ny;

          w.prvx[p] = rvx;
          w.prvy[p] = rvy;

          // Keep direction arrays in sync (used by some mechanics/render assumptions)
          const vLen = Math.hypot(rvx, rvy) || 0.0001;
          w.prDirX[p] = rvx / vLen;
          w.prDirY[p] = rvy / vLen;

          // Push the projectile just outside the enemy so it doesn't instantly re-collide
          // rr is already (enemy radius + projectile radius).
          const pushOut = rr + 0.6;
          w.prx[p] = ex + nx * pushOut;
          w.pry[p] = ey + ny * pushOut;

          // Consume one bounce
          w.prBouncesLeft[p] = bLeft - 1;
        }
      } else {
        // Normal pierce behavior for non-bouncing projectiles
        if (w.prPierce[p] > 0) {
          w.prPierce[p] -= 1;
        } else {
          w.pAlive[p] = false;
        }
      }

      // -------------------------
      // Explode-on-hit (Bazooka etc.)
      // -------------------------
      const exR = (w as any).prExplodeR?.[p] ?? 0;
      const exDmg = (w as any).prExplodeDmg?.[p] ?? 0;
      const exTtl = (w as any).prExplodeTtl?.[p] ?? 0.25;

      if (exR > 0 && exDmg > 0) {
        const zx = w.prx[p];
        const zy = w.pry[p];

        const z = spawnZone(w, {
          kind: ZONE_KIND.EXPLOSION,
          x: zx,
          y: zy,
          radius: exR,
          damage: exDmg,
          tickEvery: 0.2,      // doesn't matter; we force the first tick immediately
          ttl: exTtl,
          followPlayer: false,
        });

        // Force immediate tick this frame so it *feels* like an explosion
        w.zTickLeft[z] = 0;

        // NEW: Bazooka evolution aftershocks (delayed ring)


        const baseN = (w as any).prAftershockN?.[p] ?? 0;
        const delay = (w as any).prAftershockDelay?.[p] ?? 0;
        const ringR = (w as any).prAftershockRingR?.[p] ?? 0;
        const maxWaves = (w as any).prAftershockWaves?.[p] ?? 0;
        const ringStep = (w as any).prAftershockRingStep?.[p] ?? 0;

        if (baseN > 0 && delay > 0 && ringR > 0 && maxWaves > 0) {
          const q = ((w as any)._delayedExplosions ??= []);
          const baseAng = w.rng.range(0, Math.PI * 2);
          const rot = w.rng.range(0.15, 0.55);

          // wave 0 around the impact point (zx, zy)
          for (let k = 0; k < baseN; k++) {
            const ang = baseAng + (k * Math.PI * 2) / baseN;
            q.push({
              t: delay,
              x: zx + Math.cos(ang) * ringR,
              y: zy + Math.sin(ang) * ringR,
              r: exR,
              dmg: exDmg,
              ttl: exTtl,

              wave: 0,
              maxWaves,
              baseN,
              delay,
              ringR,
              ringStep,
              rot,
            });
          }
        }
        w.pAlive[p] = false;
      }


      // Death handling
      if (w.eHp[e] <= 0) {
        w.eAlive[e] = false;
        w.kills++;

        // snapshot poison-at-death BEFORE any cleanup
        w.ePoisonedOnDeath[e] = (w.ePoisonT[e] > 0);

        emitEvent(w, {
          type: "ENEMY_KILLED",
          enemyIndex: e,
          x: w.ex[e],
          y: w.ey[e],
          xpValue: 1,
          source: registry.projectileSourceFromKind(w.prjKind[p]),
        });
      }

      if (!w.pAlive[p]) break;

    }

    // Optional: if you want projectiles to despawn when they don't hit anything after some time,
    // that should be handled in projectile movement / lifetime system, not here.
    void hitSomething;
  }

  // -------------------------
  // Player vs Enemies
  // -------------------------
  // Player is rendered with radius 14 in render.ts, so keep it consistent here.
  const PLAYER_R = 14;

  // Simple "i-frames" cooldown so player doesn't get deleted in 1 frame.
  // Stored on world as a private field to avoid touching the World type.
  const IFRAME_SECS = 0.6;

  let hitCd = (w as any)._playerHitCd ?? 0;
  hitCd = Math.max(0, hitCd - dt);

  if (hitCd <= 0) {
    for (let e = 0; e < w.eAlive.length; e++) {
      if (!w.eAlive[e]) continue;

      const dx = w.ex[e] - w.px;
      const dy = w.ey[e] - w.py;
      const rr = w.eR[e] + PLAYER_R;

      if (!isPlayerHit(w, e, PLAYER_R)) continue;

      // CONTACT HIT
      const dmg = w.eDamage[e] || 1;

      w.playerHp -= dmg;

      emitEvent(w, {
        type: "PLAYER_HIT",
        damage: dmg,
        x: w.px,
        y: w.py,
      });

      // Push-out so the player isn't stuck inside the enemy.
      // Split correction between player and enemy to reduce jitter.
      const dist = Math.hypot(dx, dy) || 0.0001;
      const ux = dx / dist;
      const uy = dy / dist;

      const penetration = rr - dist;
      if (penetration > 0) {
        const push = penetration + 0.5;
        // Move player away from enemy
        w.px -= ux * push * 0.6;
        w.py -= uy * push * 0.6;
        // Move enemy away from player a bit too
        w.ex[e] += ux * push * 0.4;
        w.ey[e] += uy * push * 0.4;
      }

      hitCd = IFRAME_SECS;
      break; // only one contact hit per i-frame window
    }
  }

  (w as any)._playerHitCd = hitCd;
}
