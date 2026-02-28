import { World, emitEvent } from "../../../engine/world/world";
import { findClosestTarget } from "../../util/targeting";
import { PRJ_KIND, spawnProjectileGrid } from "../../factories/projectileFactory";
import { getCardById } from "../../combat_mods/content/cards/cardPool";
import { resolveDotStats, resolveWeaponStats } from "../../combat_mods/stats/combatStatsResolver";
import { applySpreadToDirection, computeProjectileAngles } from "../../combat_mods/runtime/spread";
import { getDevGrantedCardIds } from "../../combat_mods/debug/devCombatModsDebug";
import { getUserSettings } from "../../../userSettings";
import { getRelicMods } from "../progression/relics";
import { resolveCombatStarterWeaponId } from "../../combat_mods/content/weapons/characterStarterMap";
import { resolveCombatStarterStatCards } from "../../combat_mods/content/weapons/characterStarterMods";
import { getCombatStarterWeaponById } from "../../combat_mods/content/weapons/starterWeapons";
import { resetPlayerBeamState, updatePlayerBeamCombat } from "./beamCombat";
import { getPlayerWorld } from "../../coords/worldViews";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";

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

  const cardIds = [...(w.cards ?? []), ...(w.combatCardIds ?? [])];
  if (import.meta.env.DEV) {
    cardIds.push(...getDevGrantedCardIds());
  }
  const cards = cardIds
    .map((id) => getCardById(id))
    .filter((card): card is NonNullable<typeof card> => Boolean(card));
  const starterCards = resolveCombatStarterStatCards((w as any).currentCharacterId);

  const weaponId = resolveCombatStarterWeaponId((w as any).currentCharacterId);
  const selectedWeapon = getCombatStarterWeaponById(weaponId);
  const resolved = resolveWeaponStats(selectedWeapon, { cards: [...cards, ...starterCards] });
  const dotStats = resolveDotStats({ cards });
  const debug = getUserSettings().debug;
  const relicMods = getRelicMods(w);
  const debugDamageMult = Math.max(0, debug.dmgMult || 1);
  const debugFireRateMult = Math.max(0.001, debug.fireRateMult || 1);
  const relicDamageMult = Math.max(0, relicMods.dmgMult ?? 1);
  const derivedDamageMult = Math.max(0, w.dmgMult ?? 1);
  const derivedFireRateMult = Math.max(0.001, w.fireRateMult ?? 1);
  const hitDamageMoreMult = Math.max(0, relicMods.hitDamageMoreMult ?? 1);
  const hasFullCritRelic = w.relics.includes("MOM_FULL_CRIT_DOUBLE");
  const isAtFullMomentum = hasFullCritRelic && w.momentumMax > 0 && w.momentumValue >= w.momentumMax;
  const shotsPerSecond = Math.max(0.001, resolved.shotsPerSecond * derivedFireRateMult * debugFireRateMult);
  const fireRangePx = Math.max(0, resolved.rangePx || 0);
  const cooldown = 1 / shotsPerSecond;
  const burstShotIntervalSec = Math.max(0, selectedWeapon.projectile.burstShotIntervalSec ?? 0);
  const dmgPhys = resolved.baseDamage.physical * derivedDamageMult * debugDamageMult * relicDamageMult * hitDamageMoreMult;
  const dmgFire = resolved.baseDamage.fire * derivedDamageMult * debugDamageMult * relicDamageMult * hitDamageMoreMult;
  const dmgChaos = resolved.baseDamage.chaos * derivedDamageMult * debugDamageMult * relicDamageMult * hitDamageMoreMult;
  const totalDamage = dmgPhys + dmgFire + dmgChaos;
  const finalCritChance = Math.min(1, resolved.critChance * (isAtFullMomentum ? 2 : 1));
  const projectileKind = selectedWeapon.projectile.kind ?? PRJ_KIND.PISTOL;
  const weaponFireMode = selectedWeapon.fireMode ?? "projectile";
  const runtime = w as any;

  if (!Number.isFinite(runtime.primaryBurstRemaining)) runtime.primaryBurstRemaining = 0;
  if (!Number.isFinite(runtime.primaryBurstIndex)) runtime.primaryBurstIndex = 0;
  if (!Array.isArray(runtime.primaryBurstOffsets)) runtime.primaryBurstOffsets = [] as number[];
  if (!Number.isFinite(runtime.primaryBurstAimX)) runtime.primaryBurstAimX = 1;
  if (!Number.isFinite(runtime.primaryBurstAimY)) runtime.primaryBurstAimY = 0;
  if (!Number.isFinite(runtime.primaryBurstTailCooldown)) runtime.primaryBurstTailCooldown = cooldown;

  const spawnResolvedProjectile = (dirX: number, dirY: number): void => {
    spawnProjectileGrid(w, {
      kind: projectileKind,
      gx: w.pgxi + w.pgox,
      gy: w.pgyi + w.pgoy,
      dirGx: dirX,
      dirGy: dirY,
      speed: resolved.projectileSpeedPxPerSec,
      damage: totalDamage,
      dmgPhys,
      dmgFire,
      dmgChaos,
      critChance: finalCritChance,
      critMulti: resolved.critMulti,
      chanceBleed: resolved.chanceToBleed,
      chanceIgnite: resolved.chanceToIgnite,
      chancePoison: resolved.chanceToPoison,
      radius: 5,
      pierce: resolved.pierce,
      ttl: 2.2,
      maxDist: fireRangePx > 0 ? fireRangePx : undefined,
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
    const fireRateScale = shotsPerSecond / Math.max(0.001, selectedWeapon.shotsPerSecond);
    const dpsScale = Math.max(0, beamAuthoringScale * fireRateScale);

    const pWorld = getPlayerWorld(w, KENNEY_TILE_WORLD);
    const aimWorldDx = target.x - pWorld.wx;
    const aimWorldDy = target.y - pWorld.wy;
    const aimWorldLen = Math.hypot(aimWorldDx, aimWorldDy);
    const beamDirX = aimWorldLen > 0.0001 ? aimWorldDx / aimWorldLen : defaultAimX;
    const beamDirY = aimWorldLen > 0.0001 ? aimWorldDy / aimWorldLen : defaultAimY;

    updatePlayerBeamCombat(w, dt, {
      dirX: beamDirX,
      dirY: beamDirY,
      maxRangePx: Math.max(0, beam.maxRangePx),
      targetDistancePx: Math.max(0, target.distance || 0),
      tickIntervalSec: Math.max(0.01, beam.tickIntervalSec),
      widthPx: Math.max(1, beam.widthPx),
      glowIntensity: Math.max(0, beam.glowIntensity),
      dpsPhys: dmgPhys * dpsScale,
      dpsFire: dmgFire * dpsScale,
      dpsChaos: dmgChaos * dpsScale,
      critChance: finalCritChance,
      critMulti: resolved.critMulti,
      chanceBleed: resolved.chanceToBleed,
      chanceIgnite: resolved.chanceToIgnite,
      chancePoison: resolved.chanceToPoison,
      pierce: resolved.pierce,
      projectileKind,
      critRolls: relicMods.critRolls ?? 1,
      dotScalars: dotStats,
      allDamageContributesToPoison: w.relics.includes("PASS_DAMAGE_TO_POISON_ALL"),
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
