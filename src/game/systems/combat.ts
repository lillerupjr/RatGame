import { World, spawnProjectile } from "../world";

export function combatSystem(w: World, dt: number) {
  // Throwing knife (starter)
  // Fires at nearest enemy direction
  const knifeBaseCd = 0.55; // seconds
  w.knifeCd -= dt * w.fireRateMult;
  if (w.knifeCd <= 0) {
    w.knifeCd += knifeBaseCd;

    const target = findNearestEnemy(w);
    if (target) {
      const [tx, ty] = target;
      const dx = tx - w.px;
      const dy = ty - w.py;
      const d = Math.hypot(dx, dy) || 1;
      const speed = 420;
      const vx = (dx / d) * speed;
      const vy = (dy / d) * speed;
      spawnProjectile(w, 1, w.px, w.py, vx, vy, 10 * w.dmgMult, 6, 0);
    }
  }

  // Pistol placeholder (we'll gate it behind an upgrade later)
  // For now: off until you add upgrade acquisition
}

function findNearestEnemy(w: World): [number, number] | null {
  let bestI = -1;
  let bestD = Infinity;
  for (let i = 0; i < w.eAlive.length; i++) {
    if (!w.eAlive[i]) continue;
    const dx = w.ex[i] - w.px;
    const dy = w.ey[i] - w.py;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  if (bestI === -1) return null;
  return [w.ex[bestI], w.ey[bestI]];
}
