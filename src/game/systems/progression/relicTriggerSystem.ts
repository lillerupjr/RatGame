import type { World } from "../../../engine/world/world";
import { emitEvent } from "../../../engine/world/world";
import { getEnemyWorld, getPlayerWorld } from "../../coords/worldViews";
import { PRJ_KIND, spawnProjectile } from "../../factories/projectileFactory";
import { normalizeWorldRelics } from "./relics";
import { queryCircle } from "../../util/spatialHash";
import { isEnemyInCircle } from "../sim/hitDetection";
import { spawnZone, ZONE_KIND } from "../../factories/zoneFactory";
import { onEnemyKilledForChallenge } from "./roomChallenge";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getUserSettings } from "../../../userSettings";
import type { RelicTriggerEvent } from "../../events";

const RELIC_MISSILE_EXPLODE_RADIUS = 80;
const RELIC_ALL_HITS_EXPLODE_RADIUS = 80;
const RELIC_LIFE_ON_HIT_HEAL = 2;
const RELIC_EXPLODE_ON_KILL_RADIUS = 140;
export const RELIC_RETRIGGER_DELAY_SEC = 0.5;

type EnemyHitEvent = Extract<RelicTriggerEvent, { type: "ENEMY_HIT" }>;
type EnemyKilledEvent = Extract<RelicTriggerEvent, { type: "ENEMY_KILLED" }>;

function eventTypedDamage(ev: EnemyHitEvent): { phys: number; fire: number; chaos: number; total: number } {
  const typed = ev as unknown as { dmgPhys?: number; dmgFire?: number; dmgChaos?: number };
  const phys = Number.isFinite(typed.dmgPhys) ? (typed.dmgPhys as number) : 0;
  const fire = Number.isFinite(typed.dmgFire) ? (typed.dmgFire as number) : 0;
  const chaos = Number.isFinite(typed.dmgChaos) ? (typed.dmgChaos as number) : 0;
  const typedTotal = phys + fire + chaos;
  if (typedTotal > 0) return { phys, fire, chaos, total: typedTotal };
  const total = Math.max(0, ev.damage ?? 0);
  return { phys: total, fire: 0, chaos: 0, total };
}

function applyAllHitsExplosion(world: World, ev: EnemyHitEvent, debugRelicLogs: boolean): void {
  const typed = eventTypedDamage(ev);
  const explosionTotal = typed.total * 0.2;
  if (!(explosionTotal > 0)) return;

  const cx = ev.x;
  const cy = ev.y;
  spawnZone(world, {
    kind: ZONE_KIND.EXPLOSION,
    x: cx,
    y: cy,
    radius: RELIC_ALL_HITS_EXPLODE_RADIUS,
    damage: 0,
    tickEvery: 999,
    ttl: 0.35,
    followPlayer: false,
  });
  emitEvent(world, { type: "SFX", id: "EXPLOSION_SYRINGE", vol: 0.55 });
  if (debugRelicLogs) {
    console.debug("[Relic] Explosion triggered");
  }

  const physRatio = typed.total > 0 ? typed.phys / typed.total : 1;
  const fireRatio = typed.total > 0 ? typed.fire / typed.total : 0;
  const chaosRatio = typed.total > 0 ? typed.chaos / typed.total : 0;

  const nearbyEnemies = queryCircle(world.enemySpatialHash, cx, cy, RELIC_ALL_HITS_EXPLODE_RADIUS + 50);
  const checkedEnemies = new Set<number>();
  for (let i = 0; i < nearbyEnemies.length; i++) {
    const e = nearbyEnemies[i];
    if (checkedEnemies.has(e)) continue;
    checkedEnemies.add(e);
    if (!world.eAlive[e]) continue;
    if (!isEnemyInCircle(world, e, cx, cy, RELIC_ALL_HITS_EXPLODE_RADIUS)) continue;

    const dmgPhys = explosionTotal * physRatio;
    const dmgFire = explosionTotal * fireRatio;
    const dmgChaos = explosionTotal * chaosRatio;
    const dmgTotal = dmgPhys + dmgFire + dmgChaos;
    world.eHp[e] -= dmgTotal;

    const ew = getEnemyWorld(world, e, KENNEY_TILE_WORLD);
    emitEvent(world, {
      type: "ENEMY_HIT",
      enemyIndex: e,
      damage: dmgTotal,
      dmgPhys,
      dmgFire,
      dmgChaos,
      x: ew.wx,
      y: ew.wy,
      isCrit: false,
      source: "OTHER",
    });

    if (world.eHp[e] <= 0) {
      world.eAlive[e] = false;
      world.kills++;
      onEnemyKilledForChallenge(world);
      emitEvent(world, {
        type: "ENEMY_KILLED",
        enemyIndex: e,
        x: ew.wx,
        y: ew.wy,
        source: "OTHER",
      });
    }
  }
}

function applyExplodeOnKill(world: World, ev: EnemyKilledEvent): void {
  const killed = ev.enemyIndex;
  const maxHp = world.eHpMax[killed] ?? 0;
  const dmg = 0.5 * maxHp;
  if (!(dmg > 0)) return;

  const cx = ev.x;
  const cy = ev.y;

  spawnZone(world, {
    kind: ZONE_KIND.EXPLOSION,
    x: cx,
    y: cy,
    radius: RELIC_EXPLODE_ON_KILL_RADIUS,
    damage: 0,
    tickEvery: 999,
    ttl: 0.35,
    followPlayer: false,
  });
  emitEvent(world, { type: "SFX", id: "EXPLOSION_SYRINGE", vol: 0.55 });

  const nearbyEnemies = queryCircle(world.enemySpatialHash, cx, cy, RELIC_EXPLODE_ON_KILL_RADIUS + 50);
  const checkedEnemies = new Set<number>();
  for (let i = 0; i < nearbyEnemies.length; i++) {
    const e = nearbyEnemies[i];
    if (checkedEnemies.has(e)) continue;
    checkedEnemies.add(e);

    if (!world.eAlive[e]) continue;
    if (!isEnemyInCircle(world, e, cx, cy, RELIC_EXPLODE_ON_KILL_RADIUS)) continue;

    world.eHp[e] -= dmg;

    const ew = getEnemyWorld(world, e, KENNEY_TILE_WORLD);
    emitEvent(world, {
      type: "ENEMY_HIT",
      enemyIndex: e,
      damage: dmg,
      x: ew.wx,
      y: ew.wy,
      isCrit: false,
      source: "OTHER",
    });

    if (world.eHp[e] <= 0) {
      world.eAlive[e] = false;
      world.kills++;
      onEnemyKilledForChallenge(world);
      emitEvent(world, {
        type: "ENEMY_KILLED",
        enemyIndex: e,
        x: ew.wx,
        y: ew.wy,
        source: "OTHER",
      });
    }
  }
}

/** Phase 0 scaffold: iterate combat events for future relic triggers. */
export function relicTriggerSystem(world: World): void {
  if (!Array.isArray(world.events) || world.events.length === 0) return;
  normalizeWorldRelics(world);
  const hasTriggerEcho = world.relics.includes("ACT_TRIGGERS_DOUBLE");

  const eventCount = world.events.length;
  for (let i = 0; i < eventCount; i++) {
    const ev = world.events[i];
    if (ev.type !== "ENEMY_HIT") continue;
    if (ev.source === "OTHER") continue; // loop guard: relic projectiles never retrigger relic procs
    const triggerEv: EnemyHitEvent = ev;
    dispatchRelicTriggers(world, triggerEv);
    if (hasTriggerEcho && !triggerEv.isRetrigger) {
      world.relicRetriggerQueue.push({
        fireAt: world.time + RELIC_RETRIGGER_DELAY_SEC,
        event: {
          ...triggerEv,
          isRetrigger: true,
        },
      });
    }
  }
}

export function dispatchRelicTriggers(world: World, ev: RelicTriggerEvent): void {
  normalizeWorldRelics(world);
  const hasExplodeOnKill = world.relics.includes("ACT_EXPLODE_ON_KILL");
  const hasBazookaOnHit = world.relics.includes("ACT_BAZOOKA_ON_HIT_20");
  const hasAllHitsExplode = world.relics.includes("ACT_ALL_HITS_EXPLODE_20");
  const hasLifeOnHit = world.relics.includes("PASS_LIFE_ON_HIT_2");
  if (!hasExplodeOnKill && !hasBazookaOnHit && !hasAllHitsExplode && !hasLifeOnHit) return;

  if (ev.type === "ENEMY_KILLED") {
    if (hasExplodeOnKill) applyExplodeOnKill(world, ev);
    return;
  }

  const debugRelicLogs = import.meta.env.DEV && !!getUserSettings().debug.triggers;
  const pw = getPlayerWorld(world);
  const dirX = ev.x - pw.wx;
  const dirY = ev.y - pw.wy;

  if (hasBazookaOnHit) {
    const typed = eventTypedDamage(ev);
    const explodeDamage = typed.total * 0.2;
    if (explodeDamage > 0) {
      const p = spawnProjectile(world, {
        kind: PRJ_KIND.MISSILE,
        x: pw.wx,
        y: pw.wy,
        dirX,
        dirY,
        speed: 150,
        damage: 0,
        dmgPhys: 0,
        dmgFire: 0,
        dmgChaos: 0,
        radius: 5,
        pierce: 0,
        ttl: 2.0,
        critChance: 0,
        targetX: ev.x,
        targetY: ev.y,
        explodeRadius: RELIC_MISSILE_EXPLODE_RADIUS,
      });
      world.prExplodeR[p] = RELIC_MISSILE_EXPLODE_RADIUS;
      world.prExplodeDmg[p] = explodeDamage;
      world.prExplodeTtl[p] = 0.25;
      emitEvent(world, { type: "SFX", id: "FIRE_OTHER", vol: 0.45 });
    }
  }

  if (hasAllHitsExplode) {
    applyAllHitsExplosion(world, ev, debugRelicLogs);
  }

  if (hasLifeOnHit) {
    world.playerHp = Math.min(world.playerHpMax, world.playerHp + RELIC_LIFE_ON_HIT_HEAL);
    if (debugRelicLogs) {
      console.debug("[Relic] Healed 2 life");
    }
  }
}
