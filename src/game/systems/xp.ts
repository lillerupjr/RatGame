import { World } from "../world";

/**
 * XP + leveling.
 * When a level-up happens, we pause gameplay by switching to LEVELUP state
 * and incrementing pendingLevelUps. The UI consumes pendingLevelUps.
 */
export function xpSystem(w: World, _dt: number) {
  for (let i = 0; i < w.xAlive.length; i++) {
    if (!w.xAlive[i]) continue;

    const dx = w.xx[i] - w.px;
    const dy = w.xy[i] - w.py;
    const pickupR = 18; // physical pickup radius (separate from vacuum radius)
    if (dx * dx + dy * dy <= pickupR * pickupR) {
      w.xAlive[i] = false;
      w.xp += w.xValue[i];

      while (w.xp >= w.xpToNext) {
        w.xp -= w.xpToNext;
        w.level++;
        w.xpToNext = Math.floor(w.xpToNext * 1.25 + 3);
        w.pendingLevelUps++;
      }
    }
  }
}
