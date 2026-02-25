import { emitEvent, type World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getEnemyWorld } from "../../coords/worldViews";
import { spawnZone, ZONE_KIND } from "../../factories/zoneFactory";
import { onEnemyKilledForChallenge } from "../progression/roomChallenge";
import { isEnemyInCircle } from "./hitDetection";
import { queryCircle } from "../../util/spatialHash";
import { normalizeWorldRelics } from "../progression/relics";

const EXPLODE_ON_KILL_RADIUS_PX = 140;

export function relicExplodeOnKillSystem(w: World, _dt: number): void {
  normalizeWorldRelics(w);
  if (!w.relics.includes("ACT_EXPLODE_ON_KILL")) return;
  if (!Array.isArray(w.events) || w.events.length === 0) return;

  const eventCount = w.events.length;
  for (let ei = 0; ei < eventCount; ei++) {
    const ev = w.events[ei];
    if (ev.type !== "ENEMY_KILLED") continue;
    if (ev.source === "OTHER") continue; // loop guard

    const killed = ev.enemyIndex;
    const maxHp = w.eHpMax[killed] ?? 0;
    const dmg = 0.5 * maxHp;
    if (!(dmg > 0)) continue;

    const cx = ev.x;
    const cy = ev.y;

    spawnZone(w, {
      kind: ZONE_KIND.EXPLOSION,
      x: cx,
      y: cy,
      radius: EXPLODE_ON_KILL_RADIUS_PX,
      damage: 0,
      tickEvery: 999,
      ttl: 0.35,
      followPlayer: false,
    });
    emitEvent(w, { type: "SFX", id: "EXPLOSION_SYRINGE", vol: 0.55 });

    const nearbyEnemies = queryCircle(w.enemySpatialHash, cx, cy, EXPLODE_ON_KILL_RADIUS_PX + 50);
    const checkedEnemies = new Set<number>();
    for (let i = 0; i < nearbyEnemies.length; i++) {
      const e = nearbyEnemies[i];
      if (checkedEnemies.has(e)) continue;
      checkedEnemies.add(e);

      if (!w.eAlive[e]) continue;
      if (!isEnemyInCircle(w, e, cx, cy, EXPLODE_ON_KILL_RADIUS_PX)) continue;

      w.eHp[e] -= dmg;

      const ew = getEnemyWorld(w, e, KENNEY_TILE_WORLD);
      emitEvent(w, {
        type: "ENEMY_HIT",
        enemyIndex: e,
        damage: dmg,
        x: ew.wx,
        y: ew.wy,
        isCrit: false,
        source: "OTHER",
      });

      if (w.eHp[e] <= 0) {
        w.eAlive[e] = false;
        w.kills++;
        onEnemyKilledForChallenge(w);
        emitEvent(w, {
          type: "ENEMY_KILLED",
          enemyIndex: e,
          x: ew.wx,
          y: ew.wy,
          source: "OTHER",
        });
      }
    }
  }
}
