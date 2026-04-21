// src/game/systems/collisions.ts
import { World, emitEvent } from "../../../engine/world/world";
import {isEnemyHit, isPlayerHit, isPlayerProjectileHit} from "./hitDetection";
import { walkInfo } from "../../map/compile/kenneyMap";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getBossDefinitionForEntity, isBossEncounterDormant } from "../../bosses/bossRuntime";
import { registry } from "../../content/registry";
import { spawnZone, ZONE_KIND } from "../../factories/zoneFactory";
import { clearSpatialHash, insertEntity, queryCircle } from "../../util/spatialHash";
import { anchorFromWorld, writeAnchor } from "../../coords/anchor";
import { enqueueDelayedExplosion } from "./delayedExplosions";
import { resolveProjectileDamagePacket } from "../../combat_mods/runtime/critDamagePacket";
import { assertValidCrit, assertValidDamageBundle } from "../../combat_mods/debug/combatRuntimeAssert";
import { applyAilmentsFromHit, ensureEnemyAilmentsAt } from "../../combat_mods/ailments/applyAilmentsFromHit";
import { addPoison } from "../../combat_mods/ailments/enemyAilments";
import { AILMENT_DURATIONS } from "../../combat_mods/ailments/ailmentTypes";
import { createDpsMetrics, recordDamage } from "../../balance/dpsMetrics";
import { getUserSettings } from "../../../userSettings";
import { resolveCritRoll01 } from "../../combat_mods/runtime/critDamagePacket";
import { isLootGoblinEnemy } from "../neutral/lootGoblin";
import { resolveDotStats } from "../../combat_mods/stats/combatStatsResolver";
import { collectWorldStatMods } from "../../progression/effects/worldEffects";
import { applyPlayerIncomingDamage } from "./playerArmor";
import { isPoeEnemyDormant } from "../../objectives/poeMapObjectiveSystem";
import { breakMomentumOnLifeDamage } from "./momentum";
import {
  getEnemyWorld,
  getPlayerWorld,
  getProjectileWorld,
} from "../../coords/worldViews";
import { getEnemyAimWorld } from "../../combat/aimPoints";
import {
  isProcDamage,
  makeEnemyHitMeta,
  makeUnknownDamageMeta,
  makeWeaponHitMeta,
} from "../../combat/damageMeta";
import { despawnProjectile } from "./projectileLifecycle";
import { finalizeEnemyDeath } from "../enemies/finalize";
const DMG_COLOR_PHYSICAL = "#ffffff";
const DMG_COLOR_FIRE = "#ff9f3a";
const DMG_COLOR_CHAOS = "#b57bff";
const DMG_COLOR_POISON = "#6fe36f";
const DMG_COLOR_PLAYER = "#ff4b4b";

type EnemyHitEvent = Extract<import("../../events").GameEvent, { type: "ENEMY_HIT" }>;
type PlayerHitEvent = Extract<import("../../events").GameEvent, { type: "PLAYER_HIT" }>;

function projectileExplosionVfxId(): string {
  return "EXPLOSION";
}

function nextFloatJitter(seed: number): { nextSeed: number; offsetX: number; offsetY: number } {
  let s = (seed + 0x9e3779b9) | 0;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  const u1 = (s >>> 0);
  const x = ((u1 % 17) - 8);
  s = (s + 0x85ebca6b) | 0;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  const u2 = (s >>> 0);
  const y = ((u2 % 9) - 4);
  return { nextSeed: s | 0, offsetX: x, offsetY: y };
}

function baseSizeFromMagnitude(value: number): number {
  const mag = Math.max(1, Math.abs(value));
  const tier = Math.max(0, Math.min(6, Math.floor(Math.log10(mag))));
  return 12 + tier * 2;
}

function pushFloatText(
  w: World,
  x: number,
  y: number,
  value: number,
  color: string,
  size: number,
  isCrit: boolean,
  isPlayer: boolean,
): void {
  w.floatTextX.push(x);
  w.floatTextY.push(y);
  w.floatTextValue.push(value);
  w.floatTextColor.push(color);
  w.floatTextSize.push(size);
  w.floatTextTtl.push(0.8);
  w.floatTextIsCrit.push(isCrit);
  w.floatTextIsPlayer.push(isPlayer);
}

function spawnEnemyDamageTextSplit(w: World, ev: EnemyHitEvent): void {
  const phys = Number.isFinite(ev.dmgPhys) ? Math.max(0, ev.dmgPhys as number) : 0;
  const fire = Number.isFinite(ev.dmgFire) ? Math.max(0, ev.dmgFire as number) : 0;
  const chaos = Number.isFinite(ev.dmgChaos) ? Math.max(0, ev.dmgChaos as number) : 0;
  const isPoisonLike = ev.damageMeta.cause.kind === "AILMENT" && ev.damageMeta.cause.ailment === "POISON";

  const entries: Array<{ value: number; color: string }> = [];
  const physRounded = Math.round(phys);
  const fireRounded = Math.round(fire);
  const chaosRounded = Math.round(chaos);
  if (physRounded > 0) entries.push({ value: physRounded, color: DMG_COLOR_PHYSICAL });
  if (fireRounded > 0) entries.push({ value: fireRounded, color: DMG_COLOR_FIRE });
  if (chaosRounded > 0) entries.push({ value: chaosRounded, color: isPoisonLike ? DMG_COLOR_POISON : DMG_COLOR_CHAOS });
  if (entries.length === 0) return;

  const isCrit = !!ev.isCrit;
  const critMulti = Math.max(
    1,
    Number.isFinite((ev as any).critMult)
      ? ((ev as any).critMult as number)
      : (Number.isFinite(w.critMultiplier) ? w.critMultiplier : 2),
  );
  const critScale = isCrit ? Math.pow(critMulti, 0.35) : 1;

  const baseJitter = nextFloatJitter(w.uiFloatTextSeed | 0);
  w.uiFloatTextSeed = baseJitter.nextSeed;
  const spacing = 10;
  const mid = (entries.length - 1) * 0.5;

  for (let i = 0; i < entries.length; i++) {
    const ent = entries[i];
    let size = baseSizeFromMagnitude(ent.value);
    size = Math.round(size * critScale);
    size = Math.max(12, Math.min(32, size));
    const yOffset = (i - mid) * spacing;
    pushFloatText(
      w,
      ev.x + baseJitter.offsetX,
      ev.y + baseJitter.offsetY + yOffset,
      ent.value,
      ent.color,
      size,
      isCrit,
      false,
    );
  }
}

function spawnDamageTextFromEvent(w: World, ev: EnemyHitEvent | PlayerHitEvent): void {
  if (ev.type === "ENEMY_HIT") {
    spawnEnemyDamageTextSplit(w, ev);
    return;
  }
  const value = Math.max(1, Math.round(ev.damage ?? 0));
  if (!(value > 0)) return;
  let size = baseSizeFromMagnitude(value);
  size = Math.max(12, Math.min(32, size));
  const jitter = nextFloatJitter(w.uiFloatTextSeed | 0);
  w.uiFloatTextSeed = jitter.nextSeed;
  pushFloatText(w, ev.x + jitter.offsetX, ev.y + jitter.offsetY, value, DMG_COLOR_PLAYER, size, false, true);
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
  const critRolls = 1;
  const allDamageContributesToPoison = false;
  const dotStats = resolveDotStats({ statMods: collectWorldStatMods(w) });
  const poisonDamageMult = Math.max(0, dotStats.poisonDamageMult);
  const igniteDamageMult = Math.max(0, dotStats.igniteDamageMult);
  const poisonDurationMult = Math.max(0, dotStats.dotDurationMult);
  const igniteDurationMult = Math.max(0, dotStats.dotDurationMult);
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
    const playerHintZ = Number.isFinite(w.pzVisual as any)
      ? (w.pzVisual as number)
      : (Number.isFinite(w.pz as any) ? (w.pz as number) : undefined);
    let curInfo = walkInfo(px, py, KENNEY_TILE_WORLD, playerHintZ);
    const MAX_STEP_Z = 1.05;

    const tryMove = (wx: number, wy: number) => {
      let nextInfo = walkInfo(wx, wy, KENNEY_TILE_WORLD, curInfo.z);
      if (
        nextInfo.walkable &&
        !(curInfo as any).isRamp &&
        !(nextInfo as any).isRamp &&
        nextInfo.floorH === curInfo.floorH
      ) {
        const climbInfo = walkInfo(wx, wy, KENNEY_TILE_WORLD, curInfo.z + MAX_STEP_Z);
        const climbDz = Math.abs(climbInfo.z - curInfo.z);
        if (climbInfo.walkable && ((climbInfo as any).isRamp || climbInfo.floorH > curInfo.floorH) && climbDz <= MAX_STEP_Z) {
          nextInfo = climbInfo;
        }
      }
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
    const maxEnemyRadius = 120; // Includes tallest sprite aim offsets from feet anchors.
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

      const enemyAim = getEnemyAimWorld(w, e);
      const dx = enemyAim.x - px;
      const dy = enemyAim.y - py;
      const rr = w.eR[e] + pr;

      if (!isEnemyHit(w, p, e, dx, dy, rr)) continue;

      // Prevent the same piercing projectile from repeatedly hitting the same enemy every frame
      if (w.prLastHitEnemy[p] === e && w.prLastHitCd[p] > 0) { // TODO: Fix this to handle multiple hits properly + duration
        continue; // skip this hit entirely (no dmg, no poison, no pierce consume)
      }

      // HIT
      hitSomething = true;

      const source = registry.projectileSourceFromKind(w.prjKind[p]);
      const projectileDamageMeta =
        w.prDamageMeta?.[p]
        ?? (source !== "OTHER"
          ? makeWeaponHitMeta(source, { category: "HIT", instigatorId: "player" })
          : makeUnknownDamageMeta("PROJECTILE_DAMAGE_META_MISSING"));
      const projectileIsProc = isProcDamage(projectileDamageMeta);
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

      const ailmentAtEnemy = w.eAilments?.[e] as any;
      const poisonStacks = Array.isArray(ailmentAtEnemy?.poison)
        ? ailmentAtEnemy.poison.length
        : (ailmentAtEnemy?.poison ? 1 : 0);
      const igniteStacks = Array.isArray(ailmentAtEnemy?.ignite)
        ? ailmentAtEnemy.ignite.length
        : (ailmentAtEnemy?.ignite ? 1 : 0);
      const enemyPoisoned = poisonStacks > 0;
      const enemyBurning = igniteStacks > 0;

      const bLeft = w.prBouncesLeft[p];
      const contaminatedPierceHit =
        bLeft < 0
        && false
        && enemyPoisoned
        && !projectileIsProc;
      const isPiercingHit = bLeft < 0 && (w.prPierce[p] > 0 || contaminatedPierceHit);
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
          poisonDamageMult,
          igniteDamageMult,
          poisonDurationMult,
          igniteDurationMult,
          allDamageContributesToPoison,
        }
      );
      
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

      // Poison payload (applied once per hit)
      const pdps = w.prPoisonDps[p];
      const pdur = w.prPoisonDur[p];
      if (pdur > 0 && pdps > 0) {
        const payloadDurationMult = pdur / AILMENT_DURATIONS.poison;
        const payloadDamageBudget = pdps * pdur;
        addPoison(ailmentState, payloadDamageBudget, { durationMult: payloadDurationMult });
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
        x: enemyAim.x,
        y: enemyAim.y,
        isCrit,
        critMult: critMulti,
        source,
        damageMeta: projectileDamageMeta,
      });

      let shouldDespawnProjectile = false;

      // Bounce / pierce handling
      // If prBouncesLeft[p] >= 0 => this projectile uses ricochet rules.
      // Otherwise, use normal pierce rules.
      if (bLeft >= 0) {
        // If no bounces left, it dies on this hit (after dealing damage).
        if (bLeft <= 0) {
          shouldDespawnProjectile = true;
        } else {
          // Pool-style ricochet: reflect velocity about the collision normal.
          // Normal points from enemy center -> projectile center.
          const ex = enemyAim.x;
          const ey = enemyAim.y;

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
        } else if (contaminatedPierceHit) {
          // Starter Contaminated Rounds: poisoned targets are always pierced.
        } else {
          shouldDespawnProjectile = true;
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
          enemyDamageMeta: { ...projectileDamageMeta, category: "HIT" },
        });

// Force immediate tick this frame so it *feels* like an explosion
        w.zTickLeft[z] = 0;

        emitEvent(w, { type: "VFX", id: projectileExplosionVfxId(), x: zx, y: zy, radius: exR });

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
              damageMeta: { ...projectileDamageMeta, category: "HIT" },

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
        shouldDespawnProjectile = true;
      }


      // Death handling
      if (w.eHp[e] <= 0) {
        // Snapshot poison-at-death from ailment authority in mods mode before finalization.
        const poisonAlive = Array.isArray(ailmentState.poison) && ailmentState.poison.length > 0;
        w.ePoisonedOnDeath[e] = poisonAlive;
        finalizeEnemyDeath(w, e, {
          damageMeta: projectileDamageMeta,
          source,
          x: enemyAim.x,
          y: enemyAim.y,
          awardMomentum: !projectileIsProc,
          recordPoisonedOnDeath: false,
        });
      }

      if (shouldDespawnProjectile) {
        despawnProjectile(w, p, { x: enemyAim.x, y: enemyAim.y });
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
      const projectileDamageMeta = w.prDamageMeta?.[p] ?? makeUnknownDamageMeta("PLAYER_PROJECTILE_HIT_UNATTRIBUTED");

      emitEvent(w, {
        type: "PLAYER_HIT",
        damage: lifeDamage,
        x: px,
        y: py,
        damageMeta: projectileDamageMeta,
      });

      // usually enemy bullets should be consumed on hit
      despawnProjectile(w, p, { x: px, y: py });

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
      if (isLootGoblinEnemy(w, e)) continue;
      if (isPoeEnemyDormant(w, e)) continue;
      if (isBossEncounterDormant(w, e)) continue;

      const ew = getEnemyWorld(w, e, KENNEY_TILE_WORLD);
      const dx = ew.wx - px;
      const dy = ew.wy - py;
      const rr = w.eR[e] + PLAYER_R;

      if (!isPlayerHit(w, e, PLAYER_R)) continue;
      const contactDamage = Math.max(
        0,
        Number.isFinite(w.eDamage[e])
          ? (w.eDamage[e] as number)
          : getBossDefinitionForEntity(w, e)?.stats.contactDamage
            ?? registry.enemy(w.eType[e] as any).stats.contactDamage,
      );
      if (!(contactDamage > 0)) continue;

      // CONTACT HIT
      const lifeDamage = godMode ? 0 : applyPlayerIncomingDamage(w, contactDamage);
      if (!godMode) w.playerHp -= lifeDamage;
      if (lifeDamage > 0) {
        breakMomentumOnLifeDamage(w, w.timeSec ?? w.time ?? 0);
      }
      const enemyContactMeta = makeEnemyHitMeta(
        String(w.eType[e] ?? "UNKNOWN"),
        "CONTACT_BODY",
        { category: "HIT", mode: "INTRINSIC", instigatorId: String(e) },
      );

      emitEvent(w, {
        type: "PLAYER_HIT",
        damage: lifeDamage,
        x: px,
        y: py,
        damageMeta: enemyContactMeta,
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

  // Floating combat text is spawned from events once per tick in processCombatTextFromEvents().
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
        w.floatTextSize[i] = w.floatTextSize[last];
        w.floatTextTtl[i] = w.floatTextTtl[last];
        w.floatTextIsCrit[i] = w.floatTextIsCrit[last];
        w.floatTextIsPlayer[i] = w.floatTextIsPlayer[last];
      }
      w.floatTextX.pop();
      w.floatTextY.pop();
      w.floatTextValue.pop();
      w.floatTextColor.pop();
      w.floatTextSize.pop();
      w.floatTextTtl.pop();
      w.floatTextIsCrit.pop();
      w.floatTextIsPlayer.pop();
    }
  }
}

export function processCombatTextFromEvents(w: World, dt: number): void {
  for (let i = 0; i < w.events.length; i++) {
    const ev = w.events[i];
    if (ev.type !== "ENEMY_HIT" && ev.type !== "PLAYER_HIT") continue;
    spawnDamageTextFromEvent(w, ev);
  }
  updateFloatText(w, dt);
}
