import type { World } from "../../../engine/world/world";
import { emitEvent } from "../../../engine/world/world";
import { getEnemyWorld, getProjectileWorld } from "../../coords/worldViews";
import { PRJ_KIND, spawnProjectile } from "../../factories/projectileFactory";
import { normalizeWorldRelics } from "./relics";
import { queryCircle } from "../../util/spatialHash";
import { isEnemyInCircle } from "../sim/hitDetection";
import { spawnZone, ZONE_KIND } from "../../factories/zoneFactory";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getUserSettings } from "../../../userSettings";
import type { DamageMeta, RelicTriggerEvent } from "../../events";
import { addIgniteStacksFromSnapshots, createEnemyAilmentsState } from "../../combat_mods/ailments/enemyAilments";
import { restoreArmor } from "../sim/playerArmor";
import { aimDir, getEnemyAimWorld, getPlayerAimWorld } from "../../combat/aimPoints";
import { STARTER_RELIC_IDS } from "../../content/starterRelics";
import { isProcDamage, makeRelicTriggeredMeta } from "../../combat/damageMeta";
import { finalizeEnemyDeath } from "../enemies/finalize";
import { despawnProjectile } from "../sim/projectileLifecycle";

const RELIC_MISSILE_EXPLODE_RADIUS = 64;
const RELIC_ALL_HITS_EXPLODE_RADIUS = 64;
const RELIC_LIFE_ON_HIT_HEAL = 2;
const ARMOR_RESTORE_ON_HIT_AMOUNT = 1;
const ARMOR_RESTORE_ON_CRIT_AMOUNT = 5;
const ARMOR_RESTORE_ON_KILL_AMOUNT = 10;
const RELIC_EXPLODE_ON_KILL_RADIUS = 128;
const RELIC_V2_SPARK_PROC_CHANCE = 0.2;
const RELIC_V2_SPARK_RANGE = 220;
const RELIC_V2_SPARK_DAMAGE_SCALE = 1.0;
const RELIC_V2_SPARK_SPEED = 300;
const RELIC_V2_PROC_CHANCE_MULT = 1.5;
const RELIC_V2_NOVA_PROC_CHANCE = 1.0;
const RELIC_V2_NOVA_DURATION_SEC = 5.0;
const RELIC_V2_NOVA_TICK_SEC = 0.5;
const RELIC_V2_NOVA_RADIUS = 200;
const ACT_DAGGER_ON_KILL_50_PROC_CHANCE = 0.5;
const RELIC_V2_DAGGER_RANGE = 260;
const RELIC_V2_DAGGER_DELAY_SEC = 2.0;
const RELIC_V2_DAGGER_SPEED = 190;
const IGNITE_SPREAD_RADIUS_PX = 96;
const STARTER_STREET_REFLEX_PROC_CHANCE = 0.2;
const STARTER_STREET_REFLEX_RANGE = 260;
const STARTER_STREET_REFLEX_SPEED = 260;
const POINT_BLANK_KNOCK_RANGE_PX = 84;
const POINT_BLANK_KNOCK_IMPULSE = 280;
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

function applyPointBlankCarnageKnockback(world: World, ev: EnemyHitEvent): void {
  const enemyIndex = ev.enemyIndex;
  if (enemyIndex < 0 || !world.eAlive[enemyIndex]) return;

  const from = getPlayerAimWorld(world);
  const to = getEnemyAimWorld(world, enemyIndex);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist > POINT_BLANK_KNOCK_RANGE_PX) return;

  const inv = 1 / Math.max(1e-6, dist);
  const nx = dx * inv;
  const ny = dy * inv;
  const knockVx = ((world as any)._eKnockVx ??= []) as number[];
  const knockVy = ((world as any)._eKnockVy ??= []) as number[];
  knockVx[enemyIndex] = (knockVx[enemyIndex] ?? 0) + nx * POINT_BLANK_KNOCK_IMPULSE;
  knockVy[enemyIndex] = (knockVy[enemyIndex] ?? 0) + ny * POINT_BLANK_KNOCK_IMPULSE;
}

export function computeEffectiveRelicProcChance(baseChance: number, overclockCount: number): number {
  const scaled = baseChance * Math.pow(RELIC_V2_PROC_CHANCE_MULT, Math.max(0, overclockCount));
  return Math.max(0, Math.min(1, scaled));
}

function rollProcChance(world: World, baseChance: number, hasRetry: boolean): boolean {
  let overclockCount = 0;
  for (let i = 0; i < world.relics.length; i++) {
    if (world.relics[i] === "ACT_PROC_CHANCE_PERCENT_50") overclockCount++;
  }
  const chance = computeEffectiveRelicProcChance(baseChance, overclockCount);
  if (world.rng.next() < chance) return true;
  if (!hasRetry) return false;
  return world.rng.next() < chance;
}

function nearestEnemiesInRange(
  world: World,
  centerX: number,
  centerY: number,
  range: number,
  limit: number,
  excludeEnemyIndex: number,
): number[] {
  const nearby = queryCircle(world.enemySpatialHash, centerX, centerY, range + 50);
  const seen = new Set<number>();
  const candidates: Array<{ enemyIndex: number; dist2: number }> = [];

  for (let i = 0; i < nearby.length; i++) {
    const e = nearby[i];
    if (e === excludeEnemyIndex) continue;
    if (seen.has(e)) continue;
    seen.add(e);
    if (!world.eAlive[e]) continue;
    if (!isEnemyInCircle(world, e, centerX, centerY, range)) continue;
    const enemyAim = getEnemyAimWorld(world, e);
    const dx = enemyAim.x - centerX;
    const dy = enemyAim.y - centerY;
    candidates.push({ enemyIndex: e, dist2: dx * dx + dy * dy });
  }

  candidates.sort((a, b) => {
    if (a.dist2 !== b.dist2) return a.dist2 - b.dist2;
    return a.enemyIndex - b.enemyIndex;
  });
  return candidates.slice(0, limit).map((it) => it.enemyIndex);
}

function processPendingDaggerShots(world: World): void {
  const queue = world.relicDaggerQueue;
  if (!Array.isArray(queue) || queue.length === 0) return;
  const pending = [];
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    if (world.time < item.fireAt) {
      pending.push(item);
      continue;
    }
    const p = item.projectileIndex;
    if (!world.pAlive[p]) continue;
    const pw = getProjectileWorld(world, p, KENNEY_TILE_WORLD);
    const targets = nearestEnemiesInRange(
      world,
      pw.wx,
      pw.wy,
      item.range,
      1,
      item.excludeEnemyIndex,
    );
    if (targets.length === 0) {
      despawnProjectile(world, p);
      continue;
    }
    const tw = getEnemyAimWorld(world, targets[0]);
    const dirX = tw.x - pw.wx;
    const dirY = tw.y - pw.wy;
    const len = Math.hypot(dirX, dirY) || 1;
    const ndx = dirX / len;
    const ndy = dirY / len;
    world.prvx[p] = ndx * RELIC_V2_DAGGER_SPEED;
    world.prvy[p] = ndy * RELIC_V2_DAGGER_SPEED;
    world.prDirX[p] = ndx;
    world.prDirY[p] = ndy;
    world.prHasTarget[p] = true;
    world.prTargetX[p] = tw.x;
    world.prTargetY[p] = tw.y;
    world.prNoCollide[p] = false;
    emitEvent(world, { type: "SFX", id: "FIRE_OTHER", vol: 0.35 });
  }
  world.relicDaggerQueue = pending;
}

function applyAllHitsExplosion(
  world: World,
  ev: EnemyHitEvent,
  debugRelicLogs: boolean,
  damageMeta: DamageMeta,
): void {
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
    enemyDamageMeta: { ...damageMeta, category: "HIT" },
  });
  emitEvent(world, { type: "VFX", id: "RELIC_ALL_HITS_EXPLODE", x: cx, y: cy, radius: RELIC_ALL_HITS_EXPLODE_RADIUS, scale: 2 });
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
      damageMeta,
    });

    if (world.eHp[e] <= 0) {
      finalizeEnemyDeath(world, e, {
        damageMeta,
        source: "OTHER",
        x: ew.wx,
        y: ew.wy,
      });
    }
  }
}

function applyExplodeOnKill(world: World, ev: EnemyKilledEvent, damageMeta: DamageMeta): void {
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
    enemyDamageMeta: { ...damageMeta, category: "HIT" },
  });
  emitEvent(world, { type: "VFX", id: "RELIC_EXPLODE_ON_KILL", x: cx, y: cy, radius: RELIC_EXPLODE_ON_KILL_RADIUS, scale: 3 });
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
      damageMeta,
    });

    if (world.eHp[e] <= 0) {
      finalizeEnemyDeath(world, e, {
        damageMeta,
        source: "OTHER",
        x: ew.wx,
        y: ew.wy,
      });
    }
  }
}

function applyIgniteSpreadOnDeath(world: World, ev: EnemyKilledEvent): void {
  const deadState = world.eAilments?.[ev.enemyIndex];
  const deadIgniteRaw = (deadState as any)?.ignite;
  const deadIgniteStacks = Array.isArray(deadIgniteRaw)
    ? deadIgniteRaw
    : (deadIgniteRaw ? [deadIgniteRaw] : []);
  if (deadIgniteStacks.length === 0) return;

  const nearby = queryCircle(world.enemySpatialHash, ev.x, ev.y, IGNITE_SPREAD_RADIUS_PX + 50);
  const seen = new Set<number>();
  const candidates: Array<{ enemyIndex: number; dist2: number }> = [];
  for (let i = 0; i < nearby.length; i++) {
    const e = nearby[i];
    if (e === ev.enemyIndex) continue;
    if (seen.has(e)) continue;
    seen.add(e);
    if (!world.eAlive[e]) continue;
    if (!isEnemyInCircle(world, e, ev.x, ev.y, IGNITE_SPREAD_RADIUS_PX)) continue;
    const ew = getEnemyWorld(world, e, KENNEY_TILE_WORLD);
    const dx = ew.wx - ev.x;
    const dy = ew.wy - ev.y;
    candidates.push({ enemyIndex: e, dist2: dx * dx + dy * dy });
  }

  candidates.sort((a, b) => {
    if (a.dist2 !== b.dist2) return a.dist2 - b.dist2;
    return a.enemyIndex - b.enemyIndex;
  });

  if (!world.eAilments) world.eAilments = [];
  for (let i = 0; i < candidates.length; i++) {
    const e = candidates[i].enemyIndex;
    if (!world.eAilments[e]) world.eAilments[e] = createEnemyAilmentsState();
    addIgniteStacksFromSnapshots(world.eAilments[e]!, deadIgniteStacks);
  }
}

/** Phase 0 scaffold: iterate combat events for future relic triggers. */
export function relicTriggerSystem(world: World): void {
  normalizeWorldRelics(world);
  processPendingDaggerShots(world);
  if (!Array.isArray(world.events) || world.events.length === 0) return;
  const hasTriggerEcho = world.relics.includes("ACT_TRIGGERS_DOUBLE");

  const eventCount = world.events.length;
  for (let i = 0; i < eventCount; i++) {
    const ev = world.events[i];
    if (ev.type !== "ENEMY_HIT") continue;
    if (ev.damageMeta?.category !== "HIT") continue; // DoT ticks must not count as on-hit trigger events.
    if (isProcDamage(ev.damageMeta)) continue; // loop guard: proc damage never retriggers relic procs
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
  const hasSparkOnHit = world.relics.includes("ACT_SPARK_ON_HIT_20");
  const hasNovaOnCrit = world.relics.includes("ACT_NOVA_ON_CRIT_FIRE");
  const hasDaggerOnKill = world.relics.includes("ACT_DAGGER_ON_KILL_50");
  const hasIgniteSpreadOnDeath = world.relics.includes("ACT_IGNITE_SPREAD_ON_DEATH");
  const hasStarterStreetReflex = world.relics.includes(STARTER_RELIC_IDS.STREET_REFLEX);
  const hasStarterPointBlankCarnage = world.relics.includes(STARTER_RELIC_IDS.POINT_BLANK_CARNAGE);
  const hasArmorOnHit = world.relics.includes("ARMOR_RESTORE_ON_HIT_1");
  const hasArmorOnCrit = world.relics.includes("ARMOR_RESTORE_ON_CRIT_5");
  const hasArmorOnKill = world.relics.includes("ARMOR_RESTORE_ON_KILL_10");
  const hasRetryFailedProcs = world.relics.includes("ACT_RETRY_FAILED_PROCS_ONCE");
  if (!hasExplodeOnKill && !hasBazookaOnHit && !hasAllHitsExplode && !hasLifeOnHit && !hasSparkOnHit && !hasNovaOnCrit && !hasDaggerOnKill && !hasIgniteSpreadOnDeath && !hasStarterStreetReflex && !hasStarterPointBlankCarnage && !hasArmorOnHit && !hasArmorOnCrit && !hasArmorOnKill) return;

  if (ev.type === "ENEMY_KILLED") {
    const explodeOnKillMeta = makeRelicTriggeredMeta("ACT_EXPLODE_ON_KILL", "ON_KILL", { category: "HIT" });
    const daggerOnKillMeta = makeRelicTriggeredMeta("ACT_DAGGER_ON_KILL_50", "ON_KILL", { category: "HIT" });
    if (hasExplodeOnKill) applyExplodeOnKill(world, ev, explodeOnKillMeta);
    if (hasIgniteSpreadOnDeath) applyIgniteSpreadOnDeath(world, ev);
    if (hasArmorOnKill) restoreArmor(world, ARMOR_RESTORE_ON_KILL_AMOUNT);
    if (hasDaggerOnKill) {
      const didProc = rollProcChance(world, ACT_DAGGER_ON_KILL_50_PROC_CHANCE, hasRetryFailedProcs);
      if (didProc) {
        const killDamage = Math.max(0, ev.killDamage ?? 0);
        if (killDamage > 0) {
          const p = spawnProjectile(world, {
            kind: PRJ_KIND.DAGGER,
            x: ev.x,
            y: ev.y,
            dirX: 1,
            dirY: 0,
            speed: 0,
            damage: killDamage * 0.5,
            dmgPhys: killDamage * 0.5,
            dmgFire: 0,
            dmgChaos: 0,
            radius: 8,
            pierce: 0,
            ttl: 6.0,
            critChance: 0,
            noCollide: true,
            damageMeta: daggerOnKillMeta,
          });
          world.relicDaggerQueue.push({
            fireAt: world.time + RELIC_V2_DAGGER_DELAY_SEC,
            projectileIndex: p,
            excludeEnemyIndex: ev.enemyIndex,
            range: RELIC_V2_DAGGER_RANGE,
          });
        }
      }
    }
    return;
  }

  const debugRelicLogs = import.meta.env.DEV && !!getUserSettings().debug.triggers;
  if (hasBazookaOnHit) {
    const bazookaMeta = makeRelicTriggeredMeta("ACT_BAZOOKA_ON_HIT_20", "ON_HIT", { category: "HIT" });
    const typed = eventTypedDamage(ev);
    const explodeDamage = typed.total * 0.2;
    if (explodeDamage > 0) {
      const from = getPlayerAimWorld(world);
      const to = { x: ev.x, y: ev.y };
      const { dx: dirX, dy: dirY } = aimDir(from, to);
      const p = spawnProjectile(world, {
        kind: PRJ_KIND.MISSILE,
        x: from.x,
        y: from.y,
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
        targetX: to.x,
        targetY: to.y,
        explodeRadius: RELIC_MISSILE_EXPLODE_RADIUS,
        damageMeta: bazookaMeta,
      });
      world.prExplodeR[p] = RELIC_MISSILE_EXPLODE_RADIUS;
      world.prExplodeDmg[p] = explodeDamage;
      world.prExplodeTtl[p] = 0.25;
      emitEvent(world, { type: "SFX", id: "FIRE_OTHER", vol: 0.45 });
    }
  }

  if (hasAllHitsExplode) {
    const allHitsExplodeMeta = makeRelicTriggeredMeta("ACT_ALL_HITS_EXPLODE_20", "ON_HIT", { category: "HIT" });
    applyAllHitsExplosion(world, ev, debugRelicLogs, allHitsExplodeMeta);
  }

  if (hasLifeOnHit) {
    world.playerHp = Math.min(world.playerHpMax, world.playerHp + RELIC_LIFE_ON_HIT_HEAL);
    if (debugRelicLogs) {
      console.debug("[Relic] Healed 2 life");
    }
  }
  if (hasArmorOnHit) {
    restoreArmor(world, ARMOR_RESTORE_ON_HIT_AMOUNT);
  }
  if (hasArmorOnCrit && ev.isCrit) {
    restoreArmor(world, ARMOR_RESTORE_ON_CRIT_AMOUNT);
  }
  if (hasStarterPointBlankCarnage) {
    applyPointBlankCarnageKnockback(world, ev);
  }

  if (hasStarterStreetReflex) {
    const streetReflexMeta = makeRelicTriggeredMeta(STARTER_RELIC_IDS.STREET_REFLEX, "ON_HIT", { category: "HIT" });
    const didProc = rollProcChance(world, STARTER_STREET_REFLEX_PROC_CHANCE, hasRetryFailedProcs);
    if (didProc) {
      const from = getPlayerAimWorld(world);
      let targetEnemy = -1;
      if (ev.enemyIndex >= 0 && world.eAlive[ev.enemyIndex]) {
        const hitAim = getEnemyAimWorld(world, ev.enemyIndex);
        const nearby = nearestEnemiesInRange(
          world,
          hitAim.x,
          hitAim.y,
          STARTER_STREET_REFLEX_RANGE,
          1,
          ev.enemyIndex,
        );
        targetEnemy = nearby.length > 0 ? nearby[0] : ev.enemyIndex;
      } else {
        const nearby = nearestEnemiesInRange(
          world,
          ev.x,
          ev.y,
          STARTER_STREET_REFLEX_RANGE,
          1,
          -1,
        );
        if (nearby.length > 0) targetEnemy = nearby[0];
      }

      if (targetEnemy >= 0 && world.eAlive[targetEnemy]) {
        const to = getEnemyAimWorld(world, targetEnemy);
        const typed = eventTypedDamage(ev);
        const knifeTotal = Math.max(0, typed.total);
        if (knifeTotal > 0) {
          const physRatio = typed.total > 0 ? typed.phys / typed.total : 1;
          const fireRatio = typed.total > 0 ? typed.fire / typed.total : 0;
          const chaosRatio = typed.total > 0 ? typed.chaos / typed.total : 0;
          const { dx: knifeDirX, dy: knifeDirY } = aimDir(from, to);
          spawnProjectile(world, {
            kind: PRJ_KIND.KNIFE,
            x: from.x,
            y: from.y,
            dirX: knifeDirX,
            dirY: knifeDirY,
            speed: STARTER_STREET_REFLEX_SPEED,
            damage: knifeTotal,
            dmgPhys: knifeTotal * physRatio,
            dmgFire: knifeTotal * fireRatio,
            dmgChaos: knifeTotal * chaosRatio,
            radius: 5,
            pierce: 0,
            ttl: 2.0,
            critChance: 0,
            targetX: to.x,
            targetY: to.y,
            damageMeta: streetReflexMeta,
          });
          emitEvent(world, { type: "SFX", id: "FIRE_OTHER", vol: 0.35 });
        }
      }
    }
  }

  if (hasSparkOnHit) {
    const sparkMeta = makeRelicTriggeredMeta("ACT_SPARK_ON_HIT_20", "ON_HIT", { category: "HIT" });
    const didProc = rollProcChance(world, RELIC_V2_SPARK_PROC_CHANCE, hasRetryFailedProcs);
    if (didProc) {
      let sparkSource = { x: ev.x, y: ev.y };
      if (ev.enemyIndex >= 0 && world.eAlive[ev.enemyIndex]) {
        sparkSource = getEnemyAimWorld(world, ev.enemyIndex);
      }
      const targets = nearestEnemiesInRange(
        world,
        sparkSource.x,
        sparkSource.y,
        RELIC_V2_SPARK_RANGE,
        1,
        ev.enemyIndex,
      );
      const sparkTarget = targets.length > 0 ? targets[0] : ev.enemyIndex;
      if (world.eAlive[sparkTarget]) {
        const typed = eventTypedDamage(ev);
        const sparkTotal = typed.total * RELIC_V2_SPARK_DAMAGE_SCALE;
        const physRatio = typed.total > 0 ? typed.phys / typed.total : 1;
        const fireRatio = typed.total > 0 ? typed.fire / typed.total : 0;
        const chaosRatio = typed.total > 0 ? typed.chaos / typed.total : 0;
        const tw = getEnemyAimWorld(world, sparkTarget);
        const { dx: sparkDirX, dy: sparkDirY } = aimDir(sparkSource, tw);
        const p = spawnProjectile(world, {
          kind: PRJ_KIND.SPARK,
          x: sparkSource.x,
          y: sparkSource.y,
          dirX: sparkDirX,
          dirY: sparkDirY,
          speed: RELIC_V2_SPARK_SPEED,
          damage: sparkTotal,
          dmgPhys: sparkTotal * physRatio,
          dmgFire: sparkTotal * fireRatio,
          dmgChaos: sparkTotal * chaosRatio,
          radius: 6,
          pierce: 0,
          ttl: 3.0,
          critChance: 0,
          targetX: tw.x,
          targetY: tw.y,
          noCollide: true,
          damageMeta: sparkMeta,
        });
        // Store target enemy index for tracking + damage on arrival
        world.prLastHitEnemy[p] = sparkTarget;
        emitEvent(world, { type: "SFX", id: "FIRE_OTHER", vol: 0.35 });
      }
    }
  }

  if (hasNovaOnCrit && ev.isCrit) {
    const novaMeta = makeRelicTriggeredMeta("ACT_NOVA_ON_CRIT_FIRE", "ON_CRIT", { category: "DOT" });
    const didProc = rollProcChance(world, RELIC_V2_NOVA_PROC_CHANCE, hasRetryFailedProcs);
    if (didProc) {
      const typed = eventTypedDamage(ev);
      const fireDps = (typed.total * 0.6) / RELIC_V2_NOVA_DURATION_SEC;
      const fireTickDamage = fireDps * RELIC_V2_NOVA_TICK_SEC;
      if (fireTickDamage > 0) {
        spawnZone(world, {
          kind: ZONE_KIND.FIRE,
          x: ev.x,
          y: ev.y,
          radius: RELIC_V2_NOVA_RADIUS,
          damage: fireTickDamage,
          tickEvery: RELIC_V2_NOVA_TICK_SEC,
          ttl: RELIC_V2_NOVA_DURATION_SEC,
          followPlayer: false,
          enemyDamageMeta: novaMeta,
        });
      }
    }
  }
}
