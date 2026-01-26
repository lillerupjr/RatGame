import { World, spawnXp } from "../world";

/**
 * XP + leveling.
 * - Spawns XP gems from ENEMY_KILLED events (decoupled from collisions/combat).
 * - Collects XP gems on pickup and triggers LEVELUP.
 */
export function xpSystem(w: World, _dt: number) {
  // 1) Spawn XP from kill events (decoupled from collisions/combat)
  for (let i = 0; i < w.events.length; i++) {
    const e = w.events[i];
    if (e.type !== "ENEMY_KILLED") continue;
    spawnXp(w, e.x, e.y, e.xpValue);
  }

  // 2) Collect XP gems
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
