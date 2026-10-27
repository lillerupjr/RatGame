// @system   core-simulation/combat-runtime
// @owns     spawn poison trail zones behind the player and apply poison stacks from them
// @doc      docs/canonical/core_simulation_combat_runtime.md
// @agents   no combat rule collection or zone SoA management; see combatRules.ts and zoneFactory.ts

import { type World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getPlayerWorld, getZoneWorld } from "../../coords/worldViews";
import { spawnZone, ZONE_KIND } from "../../factories/zoneFactory";
import { queryCircle } from "../../util/spatialHash";
import { isEnemyInCircle } from "./hitDetection";
import { createEnemyAilmentsState, addPoison } from "../../combat_mods/ailments/enemyAilments";
import { makeEnvironmentDamageMeta } from "../../combat/damageMeta";
import type { CombatRulesSnapshot } from "../../progression/effects/combatRules";

/**
 * Spawn poison trail zones behind the player at a fixed interval.
 * Called once per sim frame.
 */
export function tickPoisonTrail(w: World, dt: number, combatRules: CombatRulesSnapshot): void {
  if (!combatRules.poisonTrail) return;

  const { radius, poisonDps, tickEvery, trailTtl, dropEvery } = combatRules.poisonTrail;
  const lastDrop: number = (w as any)._poisonTrailLastDrop ?? 0;
  const elapsed = lastDrop + dt;

  if (elapsed < dropEvery) {
    (w as any)._poisonTrailLastDrop = elapsed;
    return;
  }

  (w as any)._poisonTrailLastDrop = elapsed % dropEvery;

  const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);
  spawnZone(w, {
    kind: ZONE_KIND.POISON,
    x: pw.wx,
    y: pw.wy,
    radius,
    damage: 0,
    tickEvery,
    ttl: trailTtl,
    enemyDamageMeta: makeEnvironmentDamageMeta("POISON_TRAIL", { category: "DOT", mode: "INTRINSIC" }),
  });

  // Store poisonDps on world so tickPoisonZones can read it.
  (w as any)._poisonTrailDps = poisonDps;
}

/**
 * Apply poison stacks from alive POISON zones to enemies in range.
 * Called from the fixed DoT tick (same cadence as tickZonesOnce).
 */
export function tickPoisonZones(w: World, dtTick: number): void {
  const poisonDps: number = (w as any)._poisonTrailDps ?? 0;
  if (poisonDps <= 0) return;

  const T = KENNEY_TILE_WORLD;
  const zFloorH = ((w as any)._zFloorH ??= []) as number[];

  for (let z = 0; z < w.zAlive.length; z++) {
    if (!w.zAlive[z]) continue;
    if (w.zKind[z] !== ZONE_KIND.POISON) continue;
    if ((w.zTtl[z] ?? 0) <= 0) continue;

    const zonePos = getZoneWorld(w, z, T);
    const zx = zonePos.wx;
    const zy = zonePos.wy;
    const zr = w.zR[z];
    const zoneFloor = (zFloorH[z] ?? w.activeFloorH) | 0;

    const nearby = queryCircle(w.enemySpatialHash, zx, zy, zr + 50);
    const seen = new Set<number>();

    for (let i = 0; i < nearby.length; i++) {
      const e = nearby[i];
      if (seen.has(e)) continue;
      seen.add(e);
      if (!w.eAlive[e]) continue;

      const enemyFloorZ =
        Number.isFinite(w.ezLogical?.[e])
          ? (w.ezLogical[e] as number)
          : ((w.ezVisual?.[e] ?? 0) as number);
      const enemyFloor = (enemyFloorZ + 0.00001) | 0;
      if (enemyFloor !== zoneFloor) continue;
      if (!isEnemyInCircle(w, e, zx, zy, zr)) continue;

      // Apply poison stack
      w.eAilments ??= [];
      if (!w.eAilments[e]) {
        w.eAilments[e] = createEnemyAilmentsState();
      }
      addPoison(w.eAilments[e]!, poisonDps);
    }
  }
}
