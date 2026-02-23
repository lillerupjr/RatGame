import { World, emitEvent } from "../../../engine/world/world";
import { findClosestTarget } from "../../util/targeting";
import { PRJ_KIND, spawnProjectileGrid } from "../../factories/projectileFactory";
import { JACK_PISTOL_V1 } from "../../combat_mods/content/weapons/jackPistol";
import { getStarterCardById } from "../../combat_mods/content/cards/starterCards";
import { resolveWeaponStats } from "../../combat_mods/stats/combatStatsResolver";
import { applySpreadToDirection } from "../../combat_mods/runtime/spread";
import { getDevGrantedCardIds } from "../../combat_mods/debug/devCombatModsDebug";

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

  const cardIds = [...w.combatCardIds];
  if (import.meta.env.DEV) {
    cardIds.push(...getDevGrantedCardIds());
  }
  const cards = cardIds
    .map((id) => getStarterCardById(id))
    .filter((card): card is NonNullable<typeof card> => Boolean(card));

  const resolved = resolveWeaponStats(JACK_PISTOL_V1, { cards });
  const shotsPerSecond = Math.max(0.001, resolved.shotsPerSecond);
  const cooldown = 1 / shotsPerSecond;
  w.primaryWeaponCdLeft -= dt;

  while (w.primaryWeaponCdLeft <= 0) {
    w.primaryWeaponCdLeft += cooldown;

    const spread = applySpreadToDirection(defaultAimX, defaultAimY, resolved.spreadBaseDeg, w.rng);
    const pgx = w.pgxi + w.pgox;
    const pgy = w.pgyi + w.pgoy;

    spawnProjectileGrid(w, {
      kind: PRJ_KIND.PISTOL,
      gx: pgx,
      gy: pgy,
      dirGx: spread.dirX,
      dirGy: spread.dirY,
      speed: resolved.projectileSpeedPxPerSec,
      damage: resolved.baseDamage.physical + resolved.baseDamage.fire + resolved.baseDamage.chaos,
      dmgPhys: resolved.baseDamage.physical,
      dmgFire: resolved.baseDamage.fire,
      dmgChaos: resolved.baseDamage.chaos,
      critChance: resolved.critChance,
      critMulti: resolved.critMulti,
      radius: 5,
      pierce: resolved.pierce,
      ttl: 2.2,
    });

    emitEvent(w, {
      type: "SFX",
      id: "FIRE_OTHER",
      weaponId: "PISTOL",
      vol: 0.55,
      rate: 0.95 + w.rng.range(0, 0.1),
    });
  }
}
