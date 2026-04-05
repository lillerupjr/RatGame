import { emitEvent, type World } from "../../../engine/world/world";
import { isEnemyInCircle } from "./hitDetection";
import { tickDelayedExplosions } from "./delayedExplosions";
import { queryCircle } from "../../util/spatialHash";
import { anchorFromWorld, writeAnchor } from "../../coords/anchor";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getEnemyWorld, getPlayerWorld, getZoneWorld } from "../../coords/worldViews";
import { getUserSettings } from "../../../userSettings";
import { applyPlayerIncomingDamage } from "./playerArmor";
import { breakMomentumOnLifeDamage } from "./momentum";
import { ZONE_KIND } from "../../factories/zoneFactory";
import { type FireZoneVfx, spawnFireZoneVfx, updateFireZoneVfx } from "../../vfx/fireZoneVfx";
import { makeEnvironmentDamageMeta } from "../../combat/damageMeta";
import { finalizeEnemyDeath } from "../enemies/finalize";

function zoneTickScale(zoneTickEvery: number, dtTick: number): number {
  const every = Math.max(0.02, zoneTickEvery);
  return dtTick / every;
}

/**
 * Per-frame zone maintenance (TTL, follow behavior, VFX).
 * Damage application is performed by tickZonesOnce from the central DoT scheduler.
 */
export function zonesSystem(w: World, dt: number) {
  const T = KENNEY_TILE_WORLD;
  const pw = getPlayerWorld(w, T);
  const px = pw.wx;
  const py = pw.wy;

  const syncZoneGrid = (i: number, wx: number, wy: number) => {
    const anchor = anchorFromWorld(wx, wy, T);
    writeAnchor({ gxi: w.zgxi, gyi: w.zgyi, gox: w.zgox, goy: w.zgoy }, i, anchor);
  };

  tickDelayedExplosions(w, dt);

  // Cache zone floor height so we don't recompute every update.
  const zFloorH = ((w as any)._zFloorH ??= []) as number[];
  const fireZoneVfx = ((w as any)._fireZoneVfx ??= []) as (FireZoneVfx | null)[];

  for (let z = 0; z < w.zAlive.length; z++) {
    if (!w.zAlive[z]) continue;

    if (fireZoneVfx[z] === undefined) {
      if (w.zKind[z] === ZONE_KIND.FIRE) {
        const zp = getZoneWorld(w, z, T);
        fireZoneVfx[z] = spawnFireZoneVfx({
          x: zp.wx,
          y: zp.wy,
          radius: w.zR[z],
          duration: w.zTtl[z],
          rand: () => w.rng.next(),
        });
      } else {
        fireZoneVfx[z] = null;
      }
    }

    // TTL
    const ttl = w.zTtl[z];
    if (ttl !== Infinity) {
      w.zTtl[z] = ttl - dt;
      if (w.zTtl[z] <= 0) {
        w.zAlive[z] = false;
        fireZoneVfx[z] = null;
        continue;
      }
    }

    const fvfx = fireZoneVfx[z];
    if (fvfx) {
      updateFireZoneVfx(fvfx, dt);
      if (w.zFollowPlayer[z]) {
        const zp = getZoneWorld(w, z, T);
        fvfx.x = zp.wx;
        fvfx.y = zp.wy;
      }
    }

    // Follow player
    if (w.zFollowPlayer[z]) {
      syncZoneGrid(z, px, py);
      zFloorH[z] = w.activeFloorH | 0;
    }

    // Initialize cached zone floor height if missing.
    if (zFloorH[z] === undefined) zFloorH[z] = w.activeFloorH | 0;
  }
}

/**
 * Apply one fixed DoT tick for all alive zones.
 * Damage values authored in zones are interpreted as "damage per zone tickEvery interval".
 */
export function tickZonesOnce(w: World, dtTick: number): void {
  const godMode = !!getUserSettings().debug.godMode;
  const PLAYER_R = w.playerR;
  const T = KENNEY_TILE_WORLD;
  const pw = getPlayerWorld(w, T);
  const px = pw.wx;
  const py = pw.wy;
  const zFloorH = ((w as any)._zFloorH ??= []) as number[];

  for (let z = 0; z < w.zAlive.length; z++) {
    if (!w.zAlive[z]) continue;
    if ((w.zTtl[z] ?? 0) <= 0) continue;

    const zp = getZoneWorld(w, z, T);
    const zx = zp.wx;
    const zy = zp.wy;
    const zr = w.zR[z];
    const zoneFloor = (zFloorH[z] ?? w.activeFloorH) | 0;
    const scale = zoneTickScale(w.zTickEvery[z], dtTick);

    // Player damage (boss hazards) — only if player is on same floor.
    const playerTickDamage = Math.max(0, (w.zDamagePlayer[z] ?? 0) * scale);
    if (playerTickDamage > 0 && zr > 0) {
      if ((w.activeFloorH | 0) === zoneFloor) {
        const dx = px - zx;
        const dy = py - zy;
        const rr = zr + PLAYER_R;
        if (dx * dx + dy * dy <= rr * rr) {
          const lifeDamage = godMode ? 0 : applyPlayerIncomingDamage(w, playerTickDamage);
          if (!godMode) w.playerHp -= lifeDamage;
          if (lifeDamage > 0) {
            breakMomentumOnLifeDamage(w, w.timeSec ?? w.time ?? 0);
          }
          const playerDamageMeta =
            w.zPlayerDamageMeta?.[z]
            ?? makeEnvironmentDamageMeta(`ZONE_PLAYER_${w.zKind[z]}`, { category: "DOT", mode: "INTRINSIC" });
          emitEvent(w, { type: "PLAYER_HIT", damage: lifeDamage, x: px, y: py, damageMeta: playerDamageMeta });
        }
      }
    }

    // Enemy damage — only enemies on same floor.
    const enemyTickDamage = Math.max(0, (w.zDamage[z] ?? 0) * scale);
    if (enemyTickDamage <= 0 || zr <= 0) continue;

    const nearbyEnemies = queryCircle(w.enemySpatialHash, zx, zy, zr + 50);
    const checkedEnemies = new Set<number>();

    for (let i = 0; i < nearbyEnemies.length; i++) {
      const e = nearbyEnemies[i];
      if (checkedEnemies.has(e)) continue;
      checkedEnemies.add(e);
      if (!w.eAlive[e]) continue;

      const enemyFloorZ =
        Number.isFinite(w.ezLogical?.[e])
          ? (w.ezLogical[e] as number)
          : ((w.ezVisual?.[e] ?? 0) as number);
      const enemyFloor = (enemyFloorZ + 0.00001) | 0;
      if (enemyFloor !== zoneFloor) continue;
      if (!isEnemyInCircle(w, e, zx, zy, zr)) continue;

      w.eHp[e] -= enemyTickDamage;
      const enemyDamageMeta =
        w.zEnemyDamageMeta?.[z]
        ?? makeEnvironmentDamageMeta(`ZONE_ENEMY_${w.zKind[z]}`, { category: "DOT", mode: "INTRINSIC" });

      const ew = getEnemyWorld(w, e, T);
      emitEvent(w, {
        type: "ENEMY_HIT",
        enemyIndex: e,
        damage: enemyTickDamage,
        dmgPhys: w.zKind[z] === ZONE_KIND.FIRE ? 0 : enemyTickDamage,
        dmgFire: w.zKind[z] === ZONE_KIND.FIRE ? enemyTickDamage : 0,
        dmgChaos: 0,
        x: ew.wx,
        y: ew.wy,
        isCrit: false,
        source: "OTHER",
        damageMeta: enemyDamageMeta,
      });

      if (w.eHp[e] > 0) continue;

      finalizeEnemyDeath(w, e, {
        damageMeta: enemyDamageMeta,
        source: "OTHER",
        x: ew.wx,
        y: ew.wy,
      });
    }
  }
}
