import { World } from "../world";
import type { DropId } from "../content/drops";

export const PICKUP_KIND = {
  XP: 1,
  CHEST: 2,
} as const;

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

  w.xAlive.push(true);
  w.xKind.push(PICKUP_KIND.XP);
  w.xx.push(x);
  w.xy.push(y);
  w.xValue.push(value);
  w.xDropId.push("");

  return i;
}

export function spawnChest(w: World, x: number, y: number, dropId: DropId = "BOSS_CHEST") {
  const i = w.xAlive.length;

  w.xAlive.push(true);
  w.xKind.push(PICKUP_KIND.CHEST);
  w.xx.push(x);
  w.xy.push(y);
  w.xValue.push(0);
  w.xDropId.push(dropId);

  return i;
}