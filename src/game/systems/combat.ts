import { World } from "../world";
import { registry } from "../content/registry";

export function combatSystem(w: World, dt: number) {
  // Aim-at-fire-time (NOT homing): nearest enemy if present, else last movement aim.
  let aimX = w.lastAimX;
  let aimY = w.lastAimY;

  let best = -1;
  let bestD2 = Infinity;

  for (let e = 0; e < w.eAlive.length; e++) {
    if (!w.eAlive[e]) continue;
    const dx = w.ex[e] - w.px;
    const dy = w.ey[e] - w.py;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = e;
    }
  }

  if (best !== -1) {
    const dx = w.ex[best] - w.px;
    const dy = w.ey[best] - w.py;
    const len = Math.hypot(dx, dy) || 1;
    aimX = dx / len;
    aimY = dy / len;
  } else {
    const len = Math.hypot(aimX, aimY);
    if (len < 0.0001) {
      aimX = 1;
      aimY = 0;
    } else {
      aimX /= len;
      aimY /= len;
    }
  }

  // Fire all weapons in loadout
  for (let i = 0; i < w.weapons.length; i++) {
    const inst = w.weapons[i];
    const def = registry.weapon(inst.id);
    if (!def) continue;

    inst.cdLeft -= dt;
    if (inst.cdLeft > 0) continue;

    const stats = def.getStats(inst.level, w);
    inst.cdLeft += Math.max(0.01, stats.cooldown);

    def.fire(w, stats, { x: aimX, y: aimY });
  }
}
