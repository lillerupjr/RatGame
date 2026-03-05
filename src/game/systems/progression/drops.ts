import type { World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { addGold } from "../../economy/gold";
import { goldValueFromEnemyBaseLife } from "../../economy/coins";
import { spawnChest, spawnGold, PICKUP_KIND, handlePickupSpecialCase } from "./pickups";
import { ENEMY_TYPE } from "../../factories/enemyFactory";
import { getEnemyWorld, getPickupWorld, getPlayerWorld } from "../../coords/worldViews";

const MAX_COINS_PER_DROP = 256;
const COIN_SCATTER_RADIUS_PX = 8;

function spawnGoldCoins(w: World, x: number, y: number, count: number): void {
  const clampedCount = Math.max(0, Math.min(MAX_COINS_PER_DROP, Math.floor(count)));
  for (let i = 0; i < clampedCount; i++) {
    const angle = w.rng.range(0, Math.PI * 2);
    const radius = clampedCount > 1 ? w.rng.range(0, COIN_SCATTER_RADIUS_PX) : 0;
    const sx = x + Math.cos(angle) * radius;
    const sy = y + Math.sin(angle) * radius;
    spawnGold(w, sx, sy, 1);
  }
}

/** Handle drop spawns from kill events and pickup collection. */
export function dropsSystem(w: World, _dt: number) {
  // 1) Spawn gold orbs (and boss chest for bosses) from kill events.
  for (let i = 0; i < w.events.length; i++) {
    const e = w.events[i];
    if (e.type !== "ENEMY_KILLED") continue;

    const baseLife = Number.isFinite(w.eBaseLife[e.enemyIndex])
      ? Math.max(0, Math.floor(w.eBaseLife[e.enemyIndex]))
      : 0;
    const isBoss = w.eType[e.enemyIndex] === ENEMY_TYPE.BOSS;
    const goldCount = goldValueFromEnemyBaseLife(baseLife, { isBoss });
    const enemyPos = getEnemyWorld(w, e.enemyIndex, KENNEY_TILE_WORLD);
    spawnGoldCoins(w, enemyPos.wx, enemyPos.wy, goldCount);

    // Boss chest drop (no magnet)
    if (isBoss) {
      spawnChest(w, enemyPos.wx, enemyPos.wy, "BOSS_CHEST");
    }
  }

  // 2) Collect pickups
  const pickupR = 18; // physical pickup radius (separate from vacuum radius)
  const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const px = pw.wx;
  const py = pw.wy;

  for (let i = 0; i < w.xAlive.length; i++) {
    if (!w.xAlive[i]) continue;

    const wp = getPickupWorld(w, i, KENNEY_TILE_WORLD);
    const dx = wp.wx - px;
    const dy = wp.wy - py;
    if (dx * dx + dy * dy > pickupR * pickupR) continue;

    const kind = w.xKind[i] ?? PICKUP_KIND.GOLD;

    if (kind === PICKUP_KIND.GOLD) {
      w.xAlive[i] = false;
      const stored = Number.isFinite(w.xValue[i]) ? Math.floor(w.xValue[i]) : 1;
      addGold(w, Math.max(0, stored));
      continue;
    }

    if (kind === PICKUP_KIND.CHEST) {
      handlePickupSpecialCase(w, i, kind);
    }
  }
}
