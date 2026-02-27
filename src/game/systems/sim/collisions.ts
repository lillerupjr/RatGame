// src/game/systems/collisions.ts
import { World, emitEvent } from "../../../engine/world/world";
import {isEnemyHit, isPlayerHit, isPlayerProjectileHit} from "./hitDetection";
import { walkInfo } from "../../map/compile/kenneyMap";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { registry } from "../../content/registry";
import { spawnZone, ZONE_KIND } from "../../factories/zoneFactory";
import { clearSpatialHash, insertEntity, queryCircle } from "../../util/spatialHash";
import type { ProjectileSource } from "../../factories/projectileFactory";
import { onEnemyKilledForChallenge } from "../progression/roomChallenge";
import { anchorFromWorld, writeAnchor } from "../../coords/anchor";
import { enqueueDelayedExplosion } from "./delayedExplosions";
import { resolveProjectileDamagePacket } from "../../combat_mods/runtime/critDamagePacket";
import { assertValidCrit, assertValidDamageBundle } from "../../combat_mods/debug/combatRuntimeAssert";
import { applyAilmentsFromHit, ensureEnemyAilmentsAt } from "../../combat_mods/ailments/applyAilmentsFromHit";
import { createDpsMetrics, recordDamage } from "../../balance/dpsMetrics";
import { getUserSettings } from "../../../userSettings";
import { resolveCritRoll01 } from "../../combat_mods/runtime/critDamagePacket";
import { normalizeRelicIdList } from "../../content/relics";
import { getRelicMods } from "../progression/relics";
import { applyPlayerIncomingDamage } from "./playerArmor";
import {
  addMomentumFromDamage,
  addMomentumOnKill,
  breakMomentumOnLifeDamage,
  relicTriggerMomentumDamageMultiplier,
} from "./momentum";
import {
  getEnemyWorld,
  getPlayerWorld,
  getProjectileWorld,
} from "../../coords/worldViews";

// Weapon type -> damage text color mapping
const WEAPON_COLORS: Record<ProjectileSource, string> = {
  KNIFE: "#ffffff",    // white
  PISTOL: "#9fff9f",   // green
  SWORD: "#ff9f9f",    // red
  KNUCKLES: "#ffcc66", // orange
  SYRINGE: "#7df7ff",  // cyan
  BOUNCER: "#ffdcdc",  // pink
  OTHER: "#cccccc",    // gray
};

/**
 * Spawn floating combat text at position (x, y).
 */
function spawnFloatText(
  w: World,
  x: number,
  y: number,
  value: number,
  source: ProjectileSource,
  isCrit: boolean
) {
  const color = WEAPON_COLORS[source] ?? "#ffffff";
  
  // Add slight random offset so numbers don't stack perfectly
  const offsetX = w.rng.range(-8, 8);
  const offsetY = w.rng.range(-4, 4);

  w.floatTextX.push(x + offsetX);
  w.floatTextY.push(y + offsetY);
  w.floatTextValue.push(value);
  w.floatTextColor.push(color);
  w.floatTextTtl.push(0.8); // float for 0.8 seconds
  w.floatTextIsCrit.push(isCrit);
}


/**
 * Handles:
 * - projectile ↔ enemy collisions
 * - player ↔ enemy contact damage (with i-frames)
 *
 * Emits events instead of spawning XP or doing other cross-system side effects.
 * 
 * Uses spatial hashing for O(n+m) collision detection instead of O(n*m) brute force.
 */
/** Handle projectile/enemy and player/enemy collision resolution. */
export function collisionsSystem(w: World, dt: number) {
  const debugSettings = getUserSettings().debug;
  const godMode = !!debugSettings.godMode;
  const debugRelicLogs = import.meta.env.DEV && !!debugSettings.triggers;
  const normalizedRelics = normalizeRelicIdList(w.relics);
  if (normalizedRelics.length !== w.relics.length || normalizedRelics.some((id, i) => id !== w.relics[i])) {
    w.relics = normalizedRelics;
  }
  const hasDamageToPoison = w.relics.includes("PASS_DAMAGE_TO_POISON_ALL");
  const poisonConversionFactor = 0.2;
  const critRolls = getRelicMods(w).critRolls ?? 1;
  const pWorld = getPlayerWorld(w, KENNEY_TILE_WORLD);
  let px = pWorld.wx;
  let py = pWorld.wy;

  const setPlayerAnchorFromWorld = (wx: number, wy: number) => {
    const anchor = anchorFromWorld(wx, wy, KENNEY_TILE_WORLD);
    w.pgxi = anchor.gxi;
    w.pgyi = anchor.gyi;
    w.pgox = anchor.gox;
    w.pgoy = anchor.goy;
    const wp = getPlayerWorld(w, KENNEY_TILE_WORLD);
    px = wp.wx;
    py = wp.wy;
  };

  const setEnemyAnchorFromWorld = (i: number, wx: number, wy: number) => {
    const anchor = anchorFromWorld(wx, wy, KENNEY_TILE_WORLD);
    writeAnchor({ gxi: w.egxi, gyi: w.egyi, gox: w.egox, goy: w.egoy }, i, anchor);
  };

  const setProjectileAnchorFromWorld = (i: number, wx: number, wy: number) => {
    const anchor = anchorFromWorld(wx, wy, KENNEY_TILE_WORLD);
    writeAnchor({ gxi: w.prgxi, gyi: w.prgyi, gox: w.prgox, goy: w.prgoy }, i, anchor);
  };

  const tryPlayerDisplace = (dx: number, dy: number) => {
    let curInfo = walkInfo(px, py, KENNEY_TILE_WORLD, w.pz);
    const MAX_STEP_Z = 1.05;

    const tryMove = (wx: number, wy: number) => {
      const nextInfo = walkInfo(wx, wy, KENNEY_TILE_WORLD, curInfo.z);
      if (!nextInfo.walkable) return false;

      const stairsInvolved =
          curInfo.kind === "STAIRS" ||
          nextInfo.kind === "STAIRS" ||
          (curInfo as any).isRamp ||
          (nextInfo as any).isRamp;

      if (!stairsInvolved) {
        if (nextInfo.floorH !== curInfo.floorH) return false;
      } else {
        const dz = Math.abs(nextInfo.z - curInfo.z);
        if (dz > MAX_STEP_Z) return false;
      }

      setPlayerAnchorFromWorld(wx, wy);
      w.pz = nextInfo.z;
      w.pzVisual = nextInfo.zVisual;
      w.pzLogical = nextInfo.zLogical;
      w.activeFloorH =
          nextInfo.kind === "STAIRS" ? (Math.floor(nextInfo.z + 0.5) | 0) : (nextInfo.floorH | 0);
      curInfo = nextInfo;
      return true;
    };

    const nx = px + dx;
    const ny = py + dy;
    const movedDiag = tryMove(nx, ny);
    if (!movedDiag) {
      tryMove(nx, py);
      tryMove(px, ny);
    }
  };
  // -------------------------
  // Build spatial hash of enemies (once per frame)
  // -------------------------
  const hash = w.enemySpatialHash;
  clearSpatialHash(hash);
  
  for (let e = 0; e < w.eAlive.length; e++) {
    if (!w.eAlive[e]) continue;
    const ew = getEnemyWorld(w, e, KENNEY_TILE_WORLD);
    insertEntity(hash, e, ew.wx, ew.wy, w.eR[e]);
  }

  // -------------------------
  // Projectiles vs Enemies (using spatial hash)
  // -------------------------
  for (let p = 0; p < w.pAlive.length; p++) {
    if (!w.pAlive[p]) continue;

    // NEW: Bazooka rockets (and other special projectiles) can opt out of collisions
    if (w.prNoCollide[p]) continue;


    const pp = getProjectileWorld(w, p, KENNEY_TILE_WORLD);
    const px = pp.wx;
    const py = pp.wy;
    const pr = w.prR[p];

    // Track whether this projectile hit something this frame (kept for future use)
    let hitSomething = false;

    // Query only nearby enemies from spatial hash
    // Use a generous query radius to account for enemy radii
    const maxEnemyRadius = 40; // Assume max enemy radius; could be tracked if needed
    const queryRadius = pr + maxEnemyRadius;
    const nearbyEnemies = queryCircle(hash, px, py, queryRadius);
    
    // Track which enemies we've already checked this frame to avoid duplicate checks
    // (enemies can appear in multiple cells if they span cell boundaries)
    const checkedThisFrame = new Set<number>();

    for (let i = 0; i < nearbyEnemies.length; i++) {
      const e = nearbyEnemies[i];
      
      // Skip if already checked (entity appears in multiple cells)
      if (checkedThisFrame.has(e)) continue;
      checkedThisFrame.add(e);
      
      // Double-check alive (enemy may have died from another projectile this frame)
      if (!w.eAlive[e]) continue;

      const ew = getEnemyWorld(w, e, KENNEY_TILE_WORLD);
      const dx = ew.wx - px;
      const dy = ew.wy - py;
      const rr = w.eR[e] + pr;

      if (!isEnemyHit(w, p, e, dx, dy, rr)) continue;

      // Prevent the same piercing projectile from repeatedly hitting the same enemy every frame
      if (w.prLastHitEnemy[p] === e && w.prLastHitCd[p] > 0) { // TODO: Fix this to handle multiple hits properly + duration
        continue; // skip this hit entirely (no dmg, no poison, no pierce consume)
      }

      // HIT
      hitSomething = true;

      const source = registry.projectileSourceFromKind(w.prjKind[p]);
      const physBefore = w.prDmgPhys[p] ?? 0;
      const fireBefore = w.prDmgFire[p] ?? 0;
      const chaosBefore = w.prDmgChaos[p] ?? 0;
      const critChance = w.prCritChance[p] ?? 0;
      const critMulti = w.prCritMulti[p] ?? 1;

      // Phase B.5 verification layer: typed bundle safety + crit parameter bounds.
      // Phase B mitigation is identity, so before/after bundle should match exactly.
      assertValidDamageBundle(
        physBefore,
        fireBefore,
        chaosBefore,
        physBefore,
        fireBefore,
        chaosBefore
      );
      assertValidCrit(critChance, critMulti);

      const critRoll = resolveCritRoll01(
        critChance,
        () => w.rng.range(0, 1),
        critRolls
      );
      if (critRoll.secondUsed && debugRelicLogs) {
        console.debug("[Relic] Lucky Crit second roll used");
      }
      const resolvedDamage = resolveProjectileDamagePacket(
        {
          physical: physBefore,
          fire: fireBefore,
          chaos: chaosBefore,
          critChance,
          critMulti,
        },
        critRoll.roll01
      );
      let finalPhysDealt = resolvedDamage.physical;
      let finalFireDealt = resolvedDamage.fire;
      let finalChaosDealt = resolvedDamage.chaos;
      const isCrit = resolvedDamage.isCrit;
      if (source === "OTHER") {
        const procMult = relicTriggerMomentumDamageMultiplier(w);
        if (procMult !== 1) {
          finalPhysDealt *= procMult;
          finalFireDealt *= procMult;
          finalChaosDealt *= procMult;
        }
      }
      const dmg = finalPhysDealt + finalFireDealt + finalChaosDealt;

      if (!w.eAilments) w.eAilments = [];
      const ailmentState = ensureEnemyAilmentsAt(w.eAilments, e);
      applyAilmentsFromHit(
        ailmentState,
        { physical: finalPhysDealt, fire: finalFireDealt, chaos: finalChaosDealt },
        {
          bleed: w.prChanceBleed[p] ?? 0,
          ignite: w.prChanceIgnite[p] ?? 0,
          poison: w.prChancePoison[p] ?? 0,
        },
        {
          bleed: w.rng.range(0, 1),
          ignite: w.rng.range(0, 1),
          poison: w.rng.range(0, 1),
        },
        {
          poisonFromDamage: hasDamageToPoison ? dmg * poisonConversionFactor : 0,
        }
      );
      if (hasDamageToPoison && dmg > 0 && debugRelicLogs) {
        console.debug("[Relic] Applied poison from damage conversion");
      }
      
      w.eHp[e] -= dmg;
      if (!(w as any).metrics) (w as any).metrics = {};
      if (!(w as any).metrics.dps) (w as any).metrics.dps = createDpsMetrics();
      recordDamage((w as any).metrics.dps, (w as any).timeSec ?? (w as any).time ?? 0, dmg);

      // Track damage for DPS meter
      if (w.dpsEnabled) {
        w.dpsTotalDamage += dmg;
        w.dpsRecentDamage.push(dmg);
        w.dpsRecentTimes.push(w.time);
      }

      // Spawn floating combat text
      if (source !== "OTHER") {
        addMomentumFromDamage(w, dmg, w.eHpMax[e] ?? 1, w.timeSec ?? w.time ?? 0);
      }
      spawnFloatText(w, ew.wx, ew.wy, Math.round(dmg), source, isCrit);

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
        dmgPhys: finalPhysDealt,
        dmgFire: finalFireDealt,
        dmgChaos: finalChaosDealt,
        x: ew.wx,
        y: ew.wy,
        isCrit,
        source,
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
          const ex = ew.wx;
          const ey = ew.wy;

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
          const px1 = ex + nx * pushOut;
          const py1 = ey + ny * pushOut;
          setProjectileAnchorFromWorld(p, px1, py1);

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
        const zx = px;
        const zy = py;

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

// NEW: bazooka explosion sound
        emitEvent(w, { type: "SFX", id: "EXPLOSION_BAZOOKA", vol: 0.65 });


        // Force immediate tick this frame so it *feels* like an explosion
        w.zTickLeft[z] = 0;

        // NEW: Bazooka evolution aftershocks (delayed ring)


        const baseN = (w as any).prAftershockN?.[p] ?? 0;
        const delay = (w as any).prAftershockDelay?.[p] ?? 0;
        const ringR = (w as any).prAftershockRingR?.[p] ?? 0;
        const maxWaves = (w as any).prAftershockWaves?.[p] ?? 0;
        const ringStep = (w as any).prAftershockRingStep?.[p] ?? 0;

        if (baseN > 0 && delay > 0 && ringR > 0 && maxWaves > 0) {
          const baseAng = w.rng.range(0, Math.PI * 2);
          const rot = w.rng.range(0.15, 0.55);

          // wave 0 around the impact point (zx, zy)
          for (let k = 0; k < baseN; k++) {
            const ang = baseAng + (k * Math.PI * 2) / baseN;
            enqueueDelayedExplosion(w, {
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
        if (source !== "OTHER") {
          addMomentumOnKill(w, w.timeSec ?? w.time ?? 0);
        }
        onEnemyKilledForChallenge(w);

        // snapshot poison-at-death BEFORE any cleanup
        w.ePoisonedOnDeath[e] = (w.ePoisonT[e] > 0);

        emitEvent(w, {
          type: "ENEMY_KILLED",
          enemyIndex: e,
          x: ew.wx,
          y: ew.wy,
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
  // Player vs Enemies (using spatial hash)
  // -------------------------
  const PLAYER_R = w.playerR;

  // Simple "i-frames" cooldown so player doesn't get deleted in 1 frame.
  // Stored on world as a private field to avoid touching the World type.
  const IFRAME_SECS = 0.6;
  let hitCd = (w as any)._playerHitCd ?? 0;
  hitCd = Math.max(0, hitCd - dt);

  // -------------------------
  // Projectiles -> Player (height-aware, gated by prHitsPlayer)
  // Shares the same i-frame window as contact hits.
  // -------------------------
  if (hitCd <= 0) {
    for (let p = 0; p < w.pAlive.length; p++) {
      if (!w.pAlive[p]) continue;

      // only enemy/boss projectiles should set this
      if (!w.prHitsPlayer?.[p]) continue;

      if (!isPlayerProjectileHit(w, p, PLAYER_R)) continue;

      const dmg = w.prDamage[p] || 1;
      const lifeDamage = godMode ? 0 : applyPlayerIncomingDamage(w, dmg);
      if (!godMode) w.playerHp -= lifeDamage;
      if (lifeDamage > 0) {
        breakMomentumOnLifeDamage(w, w.timeSec ?? w.time ?? 0);
      }

      emitEvent(w, {
        type: "PLAYER_HIT",
        damage: lifeDamage,
        x: px,
        y: py,
      });

      // usually enemy bullets should be consumed on hit
      w.pAlive[p] = false;

      hitCd = IFRAME_SECS;
      break;
    }
  }

  // -------------------------
  // Player vs Enemies (using spatial hash)
  // -------------------------
  if (hitCd <= 0) {
    // Query enemies near the player using spatial hash
    const nearbyToPlayer = queryCircle(hash, px, py, PLAYER_R + 50); // 50 = generous max enemy radius

    for (let i = 0; i < nearbyToPlayer.length; i++) {
      const e = nearbyToPlayer[i];
      if (!w.eAlive[e]) continue;

      const ew = getEnemyWorld(w, e, KENNEY_TILE_WORLD);
      const dx = ew.wx - px;
      const dy = ew.wy - py;
      const rr = w.eR[e] + PLAYER_R;

      if (!isPlayerHit(w, e, PLAYER_R)) continue;

      // CONTACT HIT
      const dmg = w.eDamage[e] || 1;
      const lifeDamage = godMode ? 0 : applyPlayerIncomingDamage(w, dmg);
      if (!godMode) w.playerHp -= lifeDamage;
      if (lifeDamage > 0) {
        breakMomentumOnLifeDamage(w, w.timeSec ?? w.time ?? 0);
      }

      emitEvent(w, {
        type: "PLAYER_HIT",
        damage: lifeDamage,
        x: px,
        y: py,
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
        tryPlayerDisplace(-ux * push * 0.6, -uy * push * 0.6);
        // Move enemy away from player a bit too
        const ex2 = ew.wx + ux * push * 0.4;
        const ey2 = ew.wy + uy * push * 0.4;
        setEnemyAnchorFromWorld(e, ex2, ey2);
      }

      hitCd = IFRAME_SECS;
      break; // only one hit per i-frame window
    }
  }

  (w as any)._playerHitCd = hitCd;

  // -------------------------
  // Update DPS tracking
  // -------------------------
  if (w.dpsEnabled) {
    updateDPSTracking(w);
  }

  // -------------------------
  // Update floating combat text
  // -------------------------
  updateFloatText(w, dt);
}

/**
 * Update DPS tracking - keep only recent damage samples (last 3 seconds)
 */
function updateDPSTracking(w: World) {
  const currentTime = w.time;
  const windowSize = 3.0; // Track last 3 seconds

  // Initialize start time if needed
  if (w.dpsStartTime === 0) {
    w.dpsStartTime = currentTime;
  }

  // Remove old samples outside the window
  while (w.dpsRecentTimes.length > 0 && currentTime - w.dpsRecentTimes[0] > windowSize) {
    w.dpsRecentTimes.shift();
    w.dpsRecentDamage.shift();
  }
}

/**
 * Update floating text TTLs and remove expired entries.
 */
function updateFloatText(w: World, dt: number) {
  // Tick down TTL for all floating text
  for (let i = 0; i < w.floatTextTtl.length; i++) {
    w.floatTextTtl[i] -= dt;
  }

  // Compact: remove dead entries (could do this less often for perf, but it's fine)
  for (let i = w.floatTextTtl.length - 1; i >= 0; i--) {
    if (w.floatTextTtl[i] <= 0) {
      // Swap-remove from all parallel arrays
      const last = w.floatTextTtl.length - 1;
      if (i !== last) {
        w.floatTextX[i] = w.floatTextX[last];
        w.floatTextY[i] = w.floatTextY[last];
        w.floatTextValue[i] = w.floatTextValue[last];
        w.floatTextColor[i] = w.floatTextColor[last];
        w.floatTextTtl[i] = w.floatTextTtl[last];
        w.floatTextIsCrit[i] = w.floatTextIsCrit[last];
      }
      w.floatTextX.pop();
      w.floatTextY.pop();
      w.floatTextValue.pop();
      w.floatTextColor.pop();
      w.floatTextTtl.pop();
      w.floatTextIsCrit.pop();
    }
  }
}
