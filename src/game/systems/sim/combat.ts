import { World, emitEvent } from "../../../engine/world/world";
import { findClosestTarget } from "../../util/targeting";
import { PRJ_KIND, spawnProjectile } from "../../factories/projectileFactory";
import { resolveWeaponStats } from "../../combat_mods/stats/combatStatsResolver";
import { applySpreadToDirection, computeProjectileAngles } from "../../combat_mods/runtime/spread";
import { getUserSettings } from "../../../userSettings";
import { resolveCombatStarterWeaponId } from "../../combat_mods/content/weapons/characterStarterMap";
import { resolveCombatStarterStatMods } from "../../combat_mods/content/weapons/characterStarterMods";
import { getCombatStarterWeaponById } from "../../combat_mods/content/weapons/starterWeapons";
import { resetPlayerBeamState, updatePlayerBeamCombat } from "./beamCombat";
import { getPlayerAimWorld } from "../../combat/aimPoints";
import { getEnemyWorld, getPlayerWorld } from "../../coords/worldViews";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { STARTER_RELIC_IDS } from "../../content/starterRelics";
import { makeWeaponDotMeta, makeWeaponHitMeta } from "../../combat/damageMeta";

/** Handle weapon cooldowns, targeting, and firing events. */
export function combatSystem(w: World, dt: number) {
  // Default aim (used when no target exists or as fallback)
  let defaultAimX = w.lastAimX;
  let defaultAimY = w.lastAimY;

  const len = Math.hypot(defaultAimX, defaultAimY);
  if (len < 0.0001) {
    defaultAimX = 1;
    defaultAimY = 0;
  } else {
    defaultAimX /= len;
    defaultAimY /= len;
  }

  // Keep melee cone aim in sync with the direction we're firing (not just movement).
  w.lastAimX = defaultAimX;
  w.lastAimY = defaultAimY;

  const starterMods = resolveCombatStarterStatMods((w as any).currentCharacterId);

  const weaponId = resolveCombatStarterWeaponId((w as any).currentCharacterId);
  const selectedWeapon = getCombatStarterWeaponById(weaponId);
  const resolved = resolveWeaponStats(selectedWeapon, { mods: [...starterMods] });
  const debug = getUserSettings().debug;
  const debugDamageMult = Math.max(0, debug.dmgMult || 1);
  const debugFireRateMult = Math.max(0.001, debug.fireRateMult || 1);
  const derivedDamageMult = Math.max(0, w.dmgMult ?? 1);
  const derivedFireRateMult = Math.max(0.001, w.fireRateMult ?? 1);
  const hasFullCritRelic = w.relics.includes("MOM_FULL_CRIT_DOUBLE");
  const isAtFullMomentum = hasFullCritRelic && w.momentumMax > 0 && w.momentumValue >= w.momentumMax;
  const shotsPerSecond = Math.max(0.001, resolved.shotsPerSecond * derivedFireRateMult * debugFireRateMult);
  const fireRangePx = Math.max(0, resolved.rangePx || 0);
  const cooldown = 1 / shotsPerSecond;
  const burstShotIntervalSec = Math.max(0, selectedWeapon.projectile.burstShotIntervalSec ?? 0);
  const dmgPhys = resolved.baseDamage.physical * derivedDamageMult * debugDamageMult;
  const dmgFire = resolved.baseDamage.fire * derivedDamageMult * debugDamageMult;
  const dmgChaos = resolved.baseDamage.chaos * derivedDamageMult * debugDamageMult;
  const totalDamage = dmgPhys + dmgFire + dmgChaos;
  const finalCritChance = Math.min(1, resolved.critChance * (isAtFullMomentum ? 2 : 1));
  const hasStarterLuckyChamber = w.relics.includes(STARTER_RELIC_IDS.LUCKY_CHAMBER);
  const projectileKind = selectedWeapon.projectile.kind ?? PRJ_KIND.PISTOL;
  const weaponHitDamageMeta = makeWeaponHitMeta(selectedWeapon.id, {
    category: "HIT",
    instigatorId: "player",
    isProcDamage: false,
  });
  const weaponDotDamageMeta = makeWeaponDotMeta(selectedWeapon.id, {
    instigatorId: "player",
    isProcDamage: false,
  });
  const weaponFireMode = selectedWeapon.fireMode ?? "projectile";
  const runtime = w as any;

  if (!Number.isFinite(runtime.primaryBurstRemaining)) runtime.primaryBurstRemaining = 0;
  if (!Number.isFinite(runtime.primaryBurstIndex)) runtime.primaryBurstIndex = 0;
  if (!Array.isArray(runtime.primaryBurstOffsets)) runtime.primaryBurstOffsets = [] as number[];
  if (!Number.isFinite(runtime.primaryBurstAimX)) runtime.primaryBurstAimX = 1;
  if (!Number.isFinite(runtime.primaryBurstAimY)) runtime.primaryBurstAimY = 0;
  if (!Number.isFinite(runtime.primaryBurstTailCooldown)) runtime.primaryBurstTailCooldown = cooldown;
  if (!Number.isFinite(w.starterLuckyChamberShotCounter as any)) w.starterLuckyChamberShotCounter = 0;

  const nextShotCritChance = (): number => {
    if (!hasStarterLuckyChamber) return finalCritChance;
    w.starterLuckyChamberShotCounter = (w.starterLuckyChamberShotCounter ?? 0) + 1;
    if ((w.starterLuckyChamberShotCounter % 5) === 0) return 1;
    return finalCritChance;
  };

  const spawnResolvedProjectile = (dirX: number, dirY: number): void => {
    const from = getPlayerAimWorld(w);
    const shotCritChance = nextShotCritChance();
    spawnProjectile(w, {
      kind: projectileKind,
      x: from.x,
      y: from.y,
      dirX,
      dirY,
      speed: resolved.projectileSpeedPxPerSec,
      damage: totalDamage,
      dmgPhys,
      dmgFire,
      dmgChaos,
      critChance: shotCritChance,
      critMulti: resolved.critMulti,
      chanceBleed: resolved.chanceToBleed,
      chanceIgnite: resolved.chanceToIgnite,
      chancePoison: resolved.chanceToPoison,
      radius: 5,
      pierce: resolved.pierce,
      ttl: 2.2,
      maxDist: fireRangePx > 0 ? fireRangePx : undefined,
      damageMeta: weaponHitDamageMeta,
    });
  };

  const emitFireSfx = (): void => {
    emitEvent(w, {
      type: "SFX",
      id: "FIRE_OTHER",
      weaponId: selectedWeapon.displayName.toUpperCase(),
      vol: 0.55,
      rate: 0.95 + w.rng.range(0, 0.1),
    });
  };

  const target = findClosestTarget(w, fireRangePx);
  const hasTargetInRange = target.enemyIndex !== -1;
  if (hasTargetInRange) {
    defaultAimX = target.dirX;
    defaultAimY = target.dirY;
    w.lastAimX = defaultAimX;
    w.lastAimY = defaultAimY;
  }

  const wasBeamActive = w.playerBeamActive;
  if (weaponFireMode === "beam" && selectedWeapon.beam) {
    if (!hasTargetInRange) {
      resetPlayerBeamState(w);
      return;
    }

    const beam = selectedWeapon.beam;
    const baseWeaponDamageTotal = Math.max(
      0.001,
      selectedWeapon.baseDamage.physical + selectedWeapon.baseDamage.fire + selectedWeapon.baseDamage.chaos,
    );
    const beamAuthoringScale = beam.dps / baseWeaponDamageTotal;
    const dpsScale = Math.max(0, beamAuthoringScale);
    const beamDmgPhys = resolved.baseDamage.physical * debugDamageMult;
    const beamDmgFire = resolved.baseDamage.fire * debugDamageMult;
    const beamDmgChaos = resolved.baseDamage.chaos * debugDamageMult;

    const pWorld = getPlayerWorld(w, KENNEY_TILE_WORLD);
    const targetEnemyWorld =
      target.enemyIndex >= 0
        ? getEnemyWorld(w, target.enemyIndex, KENNEY_TILE_WORLD)
        : { wx: target.x, wy: target.y };
    const aimWorldDx = targetEnemyWorld.wx - pWorld.wx;
    const aimWorldDy = targetEnemyWorld.wy - pWorld.wy;
    const aimWorldLen = Math.hypot(aimWorldDx, aimWorldDy);
    const beamDirX = aimWorldLen > 0.0001 ? aimWorldDx / aimWorldLen : defaultAimX;
    const beamDirY = aimWorldLen > 0.0001 ? aimWorldDy / aimWorldLen : defaultAimY;

    updatePlayerBeamCombat(w, {
      dirX: beamDirX,
      dirY: beamDirY,
      maxRangePx: Math.max(0, beam.maxRangePx),
      widthPx: Math.max(1, beam.widthPx),
      glowIntensity: Math.max(0, beam.glowIntensity),
      dpsPhys: beamDmgPhys * dpsScale,
      dpsFire: beamDmgFire * dpsScale,
      dpsChaos: beamDmgChaos * dpsScale,
      damageMeta: weaponDotDamageMeta,
    });
    w.playerBeamUvOffset += dt * Math.max(0, beam.uvScrollSpeed);
    if (!wasBeamActive && w.playerBeamActive) emitFireSfx();
    return;
  }

  resetPlayerBeamState(w);

  w.primaryWeaponCdLeft -= dt;
  if (runtime.primaryBurstRemaining <= 0 && !hasTargetInRange) {
    if (w.primaryWeaponCdLeft < 0) w.primaryWeaponCdLeft = 0;
    return;
  }

  while (w.primaryWeaponCdLeft <= 0) {
    if (runtime.primaryBurstRemaining > 0) {
      const burstAimAngle = Math.atan2(runtime.primaryBurstAimY, runtime.primaryBurstAimX);
      const offset = runtime.primaryBurstOffsets[runtime.primaryBurstIndex] ?? 0;
      const angle = burstAimAngle + offset;
      spawnResolvedProjectile(Math.cos(angle), Math.sin(angle));
      emitFireSfx();

      runtime.primaryBurstIndex += 1;
      runtime.primaryBurstRemaining -= 1;
      w.primaryWeaponCdLeft += runtime.primaryBurstRemaining > 0 ? burstShotIntervalSec : runtime.primaryBurstTailCooldown;
      continue;
    }

    if (!hasTargetInRange) {
      if (w.primaryWeaponCdLeft < 0) w.primaryWeaponCdLeft = 0;
      break;
    }

    const projectileCount = Math.max(1, resolved.projectiles | 0);
    if (burstShotIntervalSec > 0 && projectileCount > 1) {
      const aimAngle = Math.atan2(defaultAimY, defaultAimX);
      const offsets = computeProjectileAngles(resolved.multiProjectileSpreadDeg, projectileCount);
      const burstDuration = burstShotIntervalSec * Math.max(0, projectileCount - 1);
      runtime.primaryBurstOffsets = offsets;
      runtime.primaryBurstAimX = Math.cos(aimAngle);
      runtime.primaryBurstAimY = Math.sin(aimAngle);
      runtime.primaryBurstRemaining = projectileCount;
      runtime.primaryBurstIndex = 0;
      runtime.primaryBurstTailCooldown = Math.max(0, cooldown - burstDuration);
      continue;
    }

    if (projectileCount === 1) {
      const spread = applySpreadToDirection(defaultAimX, defaultAimY, resolved.spreadBaseDeg, w.rng);
      spawnResolvedProjectile(spread.dirX, spread.dirY);
    } else {
      const aimAngle = Math.atan2(defaultAimY, defaultAimX);
      const offsets = computeProjectileAngles(resolved.multiProjectileSpreadDeg, projectileCount);
      for (let i = 0; i < offsets.length; i++) {
        const angle = aimAngle + offsets[i];
        spawnResolvedProjectile(Math.cos(angle), Math.sin(angle));
      }
    }
    emitFireSfx();
    w.primaryWeaponCdLeft += cooldown;
  }
}
