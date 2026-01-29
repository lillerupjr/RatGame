import type { World } from "../world";
import { emitEvent } from "../world";
import { spawnChest, spawnXp, PICKUP_KIND } from "./pickups";
import { ENEMY_TYPE } from "../factories/enemyFactory";

/**
 * XP + drops + leveling.
 * - Spawns XP gems from ENEMY_KILLED events (decoupled from collisions/combat).
 * - When a BOSS is killed, also spawns a Boss Chest and blocks transition until collected.
 * - Collects XP gems and chests (chest triggers a game.ts popup + reward resolution).
 */
export function xpSystem(w: World, _dt: number) {
  // 1) Spawn XP (and boss chest) from kill events
  for (let i = 0; i < w.events.length; i++) {
    const e = w.events[i];
    if (e.type !== "ENEMY_KILLED") continue;

    spawnXp(w, e.x, e.y, e.xpValue);

    // Boss chest drop
    if (w.eType[e.enemyIndex] === ENEMY_TYPE.BOSS) {
      spawnChest(w, e.x, e.y, "BOSS_CHEST");
      w.bossRewardPending = true;
    }
  }

  // 2) Collect pickups
  const pickupR = 18; // physical pickup radius (separate from vacuum radius)
  for (let i = 0; i < w.xAlive.length; i++) {
    if (!w.xAlive[i]) continue;

    const dx = w.xx[i] - w.px;
    const dy = w.xy[i] - w.py;
    if (dx * dx + dy * dy > pickupR * pickupR) continue;

    const kind = w.xKind[i] ?? PICKUP_KIND.XP;

    if (kind === PICKUP_KIND.XP) {
      w.xAlive[i] = false;
      w.xp += w.xValue[i];

      // SFX: xp pickup (throttled in audioSystem)
      emitEvent(w, { type: "SFX", id: "XP_PICKUP", vol: 0.35, rate: 0.98 + w.rng.range(0, 0.08) });

      while (w.xp >= w.xpToNext) {
        w.xp -= w.xpToNext;
        w.level++;
        w.xpToNext = Math.floor(w.xpToNext * 1.25 + 3);
        w.pendingLevelUps++;

        // SFX: level up
        emitEvent(w, { type: "SFX", id: "LEVEL_UP", vol: 0.9, rate: 1 });
      }
      continue;
    }

    if (kind === PICKUP_KIND.CHEST) {
      w.xAlive[i] = false;

      // Unblock boss progression once chest is taken
      w.bossRewardPending = false;

      // SFX: chest pickup
      emitEvent(w, { type: "SFX", id: "CHEST_PICKUP", vol: 1.0, rate: 1 });

      // Signal game.ts to pause + roll/apply reward + show popup
      w.chestOpenRequested = true;
    }


    if (kind === PICKUP_KIND.CHEST) {
      w.xAlive[i] = false;

      // Unblock boss progression once chest is taken
      w.bossRewardPending = false;

      // Signal game.ts to pause + roll/apply reward + show popup
      w.chestOpenRequested = true;
    }
  }
}