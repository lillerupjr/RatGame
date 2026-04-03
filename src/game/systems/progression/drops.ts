import type { World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { goldValueFromEnemyBaseLife } from "../../economy/coins";
import { grantXp } from "../../economy/xp";
import { spawnGold, PICKUP_KIND, handlePickupSpecialCase } from "./pickups";
import { EnemyId } from "../../factories/enemyFactory";
import { registry } from "../../content/registry";
import { getEnemyWorld, getPickupWorld, getPlayerWorld } from "../../coords/worldViews";
import {
  isLootGoblinEnemy,
  scheduleLootGoblinGoldBurst,
  tickLootGoblinGoldBurst,
} from "./lootGoblin";

/** Handle drop spawns from kill events and pickup collection. */
export function dropsSystem(w: World, dt: number) {
  tickLootGoblinGoldBurst(w, dt);

  // 1) Spawn XP pickups (reusing gold orb visuals) from kill events.
  for (let i = 0; i < w.events.length; i++) {
    const e = w.events[i];
    if (e.type !== "ENEMY_KILLED") continue;
    if (isLootGoblinEnemy(w, e.enemyIndex)) {
      scheduleLootGoblinGoldBurst(w, e.x, e.y);
      continue;
    }

    const baseLife = Number.isFinite(w.eBaseLife[e.enemyIndex])
      ? Math.max(0, Math.floor(w.eBaseLife[e.enemyIndex]))
      : 0;
    const archetype = registry.enemy(w.eType[e.enemyIndex] as any);
    const rewards = archetype.rewards ?? {};
    const isBoss = rewards.isBoss ?? (w.eType[e.enemyIndex] === EnemyId.BOSS);
    const goldValue = Number.isFinite(rewards.goldValue)
      ? Math.max(1, Math.floor(rewards.goldValue as number))
      : goldValueFromEnemyBaseLife(baseLife, {
          isBoss,
          multiplier: rewards.goldMultiplier,
        });
    const enemyPos = getEnemyWorld(w, e.enemyIndex, KENNEY_TILE_WORLD);
    spawnGold(w, enemyPos.wx, enemyPos.wy, goldValue);

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
      grantXp(w, Math.max(0, stored));
      continue;
    }

    if (kind === PICKUP_KIND.CHEST) {
      handlePickupSpecialCase(w, i, kind);
    }
  }
}
