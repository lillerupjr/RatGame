import { World } from "../world";
import { WEAPONS, WeaponId } from "../content/weapons";

/**
 * Combat system: fires all weapons in the player's weapon array.
 * Projectiles are "static": we aim once at fire-time (nearest enemy if present),
 * then spawned projectiles never adjust direction (no homing).
 */
export function combatSystem(w: World, dt: number) {
  // Pick aim direction (static at fire time): nearest enemy or last movement
  let aimX = w.lastAimX;
  let aimY = w.lastAimY;

  // Prefer nearest living enemy
  let best = -1;
  let bestD2 = Infinity;
  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;
    const dx = w.ex[i] - w.px;
    const dy = w.ey[i] - w.py;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }

  if (best !== -1) {
    const dx = w.ex[best] - w.px;
    const dy = w.ey[best] - w.py;
    const len = Math.hypot(dx, dy) || 1;
    aimX = dx / len;
    aimY = dy / len;
  }

  // Fire all weapons in loadout (max 4 recommended)
  for (let i = 0; i < w.weapons.length; i++) {
    const inst = w.weapons[i];
    const def = WEAPONS[inst.id as WeaponId];
    if (!def) continue;

    // Tick cooldown
    inst.cdLeft -= dt;
    if (inst.cdLeft > 0) continue;

    // Compute stats at current level (includes multipliers like fireRateMult/dmgMult)
    const stats = def.getStats(inst.level, w);

    // Reset cooldown (avoid 0/negative edge cases)
    const cd = Math.max(0.01, stats.cooldown);
    inst.cdLeft += cd;

    // Fire once using the static aim direction
    def.fire(w, stats, { x: aimX, y: aimY });
  }
}
