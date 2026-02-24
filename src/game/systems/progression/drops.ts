import type { World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { addGold } from "../../economy/gold";
import { spawnChestGrid, spawnGoldGrid, PICKUP_KIND, handlePickupSpecialCase } from "./pickups";
import { ENEMY_TYPE } from "../../factories/enemyFactory";
import { getPickupWorld, getPlayerWorld } from "../../coords/worldViews";

/** Handle drop spawns from kill events and pickup collection. */
export function dropsSystem(w: World, _dt: number) {
  // 1) Spawn gold orbs (and boss chest for bosses) from kill events.
  for (let i = 0; i < w.events.length; i++) {
    const e = w.events[i];
    if (e.type !== "ENEMY_KILLED") continue;

    const egx = w.egxi[e.enemyIndex] + w.egox[e.enemyIndex];
    const egy = w.egyi[e.enemyIndex] + w.egoy[e.enemyIndex];
    spawnGoldGrid(w, egx, egy, 1);

    // Boss chest drop (no magnet)
    if (w.eType[e.enemyIndex] === ENEMY_TYPE.BOSS) {
      spawnChestGrid(w, egx, egy, "BOSS_CHEST");
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
      addGold(w, 1);
      continue;
    }

    if (kind === PICKUP_KIND.CHEST) {
      handlePickupSpecialCase(w, i, kind);
    }
  }
}
