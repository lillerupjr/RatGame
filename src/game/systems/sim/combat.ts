import { World, emitEvent } from "../../../engine/world/world";
import { findClosestTarget } from "../../util/targeting";
import { PRJ_KIND, spawnProjectileGrid } from "../../factories/projectileFactory";
import { JACK_PISTOL_V1 } from "../../combat_mods/content/weapons/jackPistol";
import { getCardById } from "../../combat_mods/content/cards/cardPool";
import { resolveWeaponStats } from "../../combat_mods/stats/combatStatsResolver";
import { applySpreadToDirection, computeProjectileAngles } from "../../combat_mods/runtime/spread";
import { getDevGrantedCardIds } from "../../combat_mods/debug/devCombatModsDebug";
import { getUserSettings } from "../../../userSettings";

/** Handle weapon cooldowns, targeting, and firing events. */
export function combatSystem(w: World, dt: number) {
  // Default aim (used when no target exists or as fallback)
  let defaultAimX = w.lastAimX;
  let defaultAimY = w.lastAimY;

  // Find default target (closest enemy) for weapons that don't specify targeting
  const defaultTarget = findClosestTarget(w, 0);
  
  if (defaultTarget.enemyIndex !== -1) {
    defaultAimX = defaultTarget.dirX;
    defaultAimY = defaultTarget.dirY;
  } else {
    const len = Math.hypot(defaultAimX, defaultAimY);
    if (len < 0.0001) {
      defaultAimX = 1;
      defaultAimY = 0;
    } else {
      defaultAimX /= len;
      defaultAimY /= len;
    }
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
  const debugDamageMult = Math.max(0, debug.dmgMult || 1);
  const debugFireRateMult = Math.max(0.001, debug.fireRateMult || 1);
  const shotsPerSecond = Math.max(0.001, resolved.shotsPerSecond * debugFireRateMult);
  const cooldown = 1 / shotsPerSecond;
  const dmgPhys = resolved.baseDamage.physical * debugDamageMult;
  const dmgFire = resolved.baseDamage.fire * debugDamageMult;
  const dmgChaos = resolved.baseDamage.chaos * debugDamageMult;
  const totalDamage = dmgPhys + dmgFire + dmgChaos;
  w.primaryWeaponCdLeft -= dt;

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
        critChance: resolved.critChance,
        critMulti: resolved.critMulti,
        chanceBleed: resolved.chanceToBleed,
        chanceIgnite: resolved.chanceToIgnite,
        chancePoison: resolved.chanceToPoison,
        radius: 5,
        pierce: resolved.pierce,
        ttl: 2.2,
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
          critChance: resolved.critChance,
          critMulti: resolved.critMulti,
          chanceBleed: resolved.chanceToBleed,
          chanceIgnite: resolved.chanceToIgnite,
          chancePoison: resolved.chanceToPoison,
          radius: 5,
          pierce: resolved.pierce,
          ttl: 2.2,
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
