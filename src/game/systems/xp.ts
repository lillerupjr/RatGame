import type { World } from "../world";
import { emitEvent, pickupWorldPos, playerWorldPos } from "../world";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";
import { spawnChestGrid, spawnXpGrid, PICKUP_KIND } from "./pickups";
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

    // Apply delve XP scaling
    const xpMult = w.delveScaling?.xpMult ?? 1;
    const scaledXp = Math.round(e.xpValue * xpMult);
    const egx = w.egxi[e.enemyIndex] + w.egox[e.enemyIndex];
    const egy = w.egyi[e.enemyIndex] + w.egoy[e.enemyIndex];
    spawnXpGrid(w, egx, egy, scaledXp);

    // Boss chest drop + magnet effect
    if (w.eType[e.enemyIndex] === ENEMY_TYPE.BOSS) {
      spawnChestGrid(w, egx, egy, "BOSS_CHEST");
      w.bossRewardPending = true;
      
      // Activate magnet to pull all XP towards player
      w.magnetActive = true;
      w.magnetTimer = 3.0; // 3 seconds of magnet effect
    }
  }

  // 2) Collect pickups
  const pickupR = 18; // physical pickup radius (separate from vacuum radius)
  const pw = playerWorldPos(w, KENNEY_TILE_WORLD);
  const px = pw.wx;
  const py = pw.wy;

  for (let i = 0; i < w.xAlive.length; i++) {
    if (!w.xAlive[i]) continue;

    const wp = pickupWorldPos(w, i);
    const dx = wp.wx - px;
    const dy = wp.wy - py;
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
        w.xpToNext = Math.floor(w.xpToNext * 1.15 + 3);
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
      // Boss beat reward: heal to full
      w.playerHp = w.playerHpMax;

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
