import type { World } from "../../../engine/world/world";
import { emitEvent } from "../../../engine/world/world";
import { getPlayerWorld } from "../../coords/worldViews";
import { PRJ_KIND, spawnProjectile } from "../../factories/projectileFactory";
import { normalizeWorldRelics } from "./relics";

const RELIC_MISSILE_EXPLODE_RADIUS = 80;

/** Phase 0 scaffold: iterate combat events for future relic triggers. */
export function relicTriggerSystem(world: World): void {
  if (!Array.isArray(world.events) || world.events.length === 0) return;
  normalizeWorldRelics(world);
  const hasMissileOnHit = world.relics.includes("ACT_MISSILE_ON_HIT_20");
  const hasBazookaOnHit = world.relics.includes("ACT_BAZOOKA_ON_HIT_20");
  if (!hasMissileOnHit && !hasBazookaOnHit) return;

  const eventCount = world.events.length;
  for (let i = 0; i < eventCount; i++) {
    const ev = world.events[i];
    if (ev.type !== "ENEMY_HIT") continue;
    if (ev.source === "OTHER") continue; // loop guard: relic projectiles never retrigger relic procs
    const pw = getPlayerWorld(world);
    const dirX = ev.x - pw.wx;
    const dirY = ev.y - pw.wy;

    if (hasMissileOnHit && world.rng.next() < 0.2) {
      const baseDamage = 8 * world.dmgMult;
      spawnProjectile(world, {
        kind: PRJ_KIND.MISSILE,
        x: pw.wx,
        y: pw.wy,
        dirX,
        dirY,
        speed: 150,
        damage: baseDamage,
        radius: 5,
        pierce: 0,
        ttl: 2.0,
        critChance: 0,
        targetX: ev.x,
        targetY: ev.y,
      });
      emitEvent(world, { type: "SFX", id: "FIRE_OTHER", vol: 0.45 });
    }

    if (!hasBazookaOnHit) continue;
    const typed = ev as unknown as { dmgPhys?: number; dmgFire?: number; dmgChaos?: number; damage?: number };
    const dmgPhys = Number.isFinite(typed.dmgPhys) ? (typed.dmgPhys as number) : 0;
    const dmgFire = Number.isFinite(typed.dmgFire) ? (typed.dmgFire as number) : 0;
    const dmgChaos = Number.isFinite(typed.dmgChaos) ? (typed.dmgChaos as number) : 0;
    const hitDamage = dmgPhys + dmgFire + dmgChaos;
    const totalDamage = hitDamage > 0 ? hitDamage : Math.max(0, ev.damage ?? 0);
    const explodeDamage = totalDamage * 0.2;
    if (!(explodeDamage > 0)) continue;

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
