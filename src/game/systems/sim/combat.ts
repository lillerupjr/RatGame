import { World, emitEvent } from "../../../engine/world/world";
import { registry } from "../../content/registry";
import { findTarget, findClosestTarget, type TargetingStrategy } from "../../util/targeting";

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

  // Fire all weapons in loadout
  for (let i = 0; i < w.weapons.length; i++) {
    const inst = w.weapons[i];
    const def = registry.weapon(inst.id);
    if (!def) continue;

    inst.cdLeft -= dt;
    if (inst.cdLeft > 0) continue;

    const stats = def.getStats(inst.level, w);
    inst.cdLeft += Math.max(0.01, stats.cooldown);

    // Determine aim direction based on weapon's targeting strategy
    let aimX = defaultAimX;
    let aimY = defaultAimY;

    if (stats.targeting) {
      const target = findTarget(
        w,
        stats.targeting,
        stats.targetingRange ?? 0,
        stats.clusterRadius ?? 80
      );
      
      if (target.enemyIndex !== -1) {
        aimX = target.dirX;
        aimY = target.dirY;
      }
    }

    def.fire(w, stats, { x: aimX, y: aimY });

    // SFX: weapon fired (throttled in audioSystem)
    emitEvent(w, {
      type: "SFX",
      id: "FIRE_OTHER", // resolved later by audioSystem
      weaponId: inst.id,
      vol: 0.55,
      rate: 0.95 + w.rng.range(0, 0.1),
    });


  }
}
