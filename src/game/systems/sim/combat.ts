import { World, emitEvent } from "../../../engine/world/world";
import { findClosestTarget } from "../../util/targeting";
import { PRJ_KIND, spawnProjectileGrid } from "../../factories/projectileFactory";
import { JACK_PISTOL_V1 } from "../../combat_mods/content/weapons/jackPistol";
import { getCardById } from "../../combat_mods/content/cards/cardPool";
import { resolveWeaponStats } from "../../combat_mods/stats/combatStatsResolver";
import { applySpreadToDirection, computeProjectileAngles } from "../../combat_mods/runtime/spread";
import { getDevGrantedCardIds } from "../../combat_mods/debug/devCombatModsDebug";
import { getUserSettings } from "../../../userSettings";
import { getRelicMods } from "../progression/relics";

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

  const resolved = resolveWeaponStats(JACK_PISTOL_V1, { cards });
  const debug = getUserSettings().debug;
  const relicMods = getRelicMods(w);
  const debugDamageMult = Math.max(0, debug.dmgMult || 1);
  const debugFireRateMult = Math.max(0.001, debug.fireRateMult || 1);
  const relicDamageMult = Math.max(0, relicMods.dmgMult ?? 1);
  const derivedDamageMult = Math.max(0, w.dmgMult ?? 1);
  const derivedFireRateMult = Math.max(0.001, w.fireRateMult ?? 1);
  const hasFullCritRelic = w.relics.includes("MOM_FULL_CRIT_DOUBLE");
  const isAtFullMomentum = hasFullCritRelic && w.momentumMax > 0 && w.momentumValue >= w.momentumMax;
  const shotsPerSecond = Math.max(0.001, resolved.shotsPerSecond * derivedFireRateMult * debugFireRateMult);
  const fireRangePx = Math.max(0, resolved.rangePx || 0);
  const cooldown = 1 / shotsPerSecond;
  const dmgPhys = resolved.baseDamage.physical * derivedDamageMult * debugDamageMult * relicDamageMult;
  const dmgFire = resolved.baseDamage.fire * derivedDamageMult * debugDamageMult * relicDamageMult;
  const dmgChaos = resolved.baseDamage.chaos * derivedDamageMult * debugDamageMult * relicDamageMult;
  const totalDamage = dmgPhys + dmgFire + dmgChaos;
  const finalCritChance = Math.min(1, resolved.critChance * (isAtFullMomentum ? 2 : 1));

  const target = findClosestTarget(w, fireRangePx);
  const hasTargetInRange = target.enemyIndex !== -1;
  if (hasTargetInRange) {
    defaultAimX = target.dirX;
    defaultAimY = target.dirY;
    w.lastAimX = defaultAimX;
    w.lastAimY = defaultAimY;
  }

  w.primaryWeaponCdLeft -= dt;
  if (!hasTargetInRange) {
    if (w.primaryWeaponCdLeft < 0) w.primaryWeaponCdLeft = 0;
    return;
  }

  while (w.primaryWeaponCdLeft <= 0) {
    w.primaryWeaponCdLeft += cooldown;
    const projectileCount = Math.max(1, resolved.projectiles | 0);
    const pgx = w.pgxi + w.pgox;
    const pgy = w.pgyi + w.pgoy;
    if (projectileCount === 1) {
      const spread = applySpreadToDirection(defaultAimX, defaultAimY, resolved.spreadBaseDeg, w.rng);
      spawnProjectileGrid(w, {
        kind: PRJ_KIND.PISTOL,
        gx: pgx,
        gy: pgy,
        dirGx: spread.dirX,
        dirGy: spread.dirY,
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
    } else {
      const aimAngle = Math.atan2(defaultAimY, defaultAimX);
      const offsets = computeProjectileAngles(resolved.spreadBaseDeg, projectileCount);
      for (let i = 0; i < offsets.length; i++) {
        const angle = aimAngle + offsets[i];
        spawnProjectileGrid(w, {
          kind: PRJ_KIND.PISTOL,
          gx: pgx,
          gy: pgy,
          dirGx: Math.cos(angle),
          dirGy: Math.sin(angle),
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
      }
    }

    emitEvent(w, {
      type: "SFX",
      id: "FIRE_OTHER",
      weaponId: "PISTOL",
      vol: 0.55,
      rate: 0.95 + w.rng.range(0, 0.1),
    });
  }
}
