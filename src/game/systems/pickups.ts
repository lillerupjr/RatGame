import { World } from "../world";

export function pickupsSystem(w: World, dt: number) {
  // Pickups drift toward player when close (classic vacuum feel)
  for (let i = 0; i < w.xAlive.length; i++) {
    if (!w.xAlive[i]) continue;
    const dx = w.px - w.xx[i];
    const dy = w.py - w.xy[i];
    const d = Math.hypot(dx, dy);
    if (d < w.pickupRadius) {
      const pull = 420; // px/s
      const ux = dx / (d || 1);
      const uy = dy / (d || 1);
      w.xx[i] += ux * pull * dt;
      w.xy[i] += uy * pull * dt;
    }
  }
}

export function spawnXp(w: World, x: number, y: number, value: number) {
  const i = w.xAlive.length;
  w.xAlive.push(true); // all XP gems start alive
  w.xx.push(x); // x position
  w.xy.push(y); // y position
  w.xValue.push(value); // XP value
  return i;
}
