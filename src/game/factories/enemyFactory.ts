// src/game/factories/enemyFactory.ts
import type { World } from "../../engine/world/world";
import { registry } from "../content/registry";
import { EnemyId } from "../content/enemies";
import { gridToWorld, worldToGrid } from "../coords/grid";
import { anchorFromWorld } from "../coords/anchor";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { createEnemyAilmentsState } from "../combat_mods/ailments/enemyAilments";
import { createEnemyBrainState } from "../systems/enemies/brain";

export { EnemyId };

/** Spawn an enemy at grid coordinates with scaled stats. */
export function spawnEnemyGrid(
    w: World,
    type: EnemyId,
    gx: number,
    gy: number,
    _tileWorld: number = KENNEY_TILE_WORLD
) {
    const s = registry.enemy(type);
    const baseLife = Math.max(1, Math.round(s.stats.baseLife));

    const scaling = w.delveScaling ?? { hpMult: 1, damageMult: 1 };
    const scaledHp = Math.max(1, Math.round(baseLife * scaling.hpMult));
    const scaledDamage = Math.round(s.stats.contactDamage * scaling.damageMult);

    const i = w.eAlive.length;
    w.eAlive.push(true);
    w.eType.push(type);
    const wp = gridToWorld(gx, gy, _tileWorld);
    const anchor = anchorFromWorld(wp.wx, wp.wy, _tileWorld);
    w.egxi.push(anchor.gxi);
    w.egyi.push(anchor.gyi);
    w.egox.push(anchor.gox);
    w.egoy.push(anchor.goy);

    w.evx.push(0);
    w.evy.push(0);
    w.eFaceX.push(0);
    w.eFaceY.push(-1);
    w.eBaseLife.push(baseLife);
    w.eHp.push(scaledHp);
    w.eHpMax.push(scaledHp);
    w.eR.push(s.body.radius);
    w.eSpeed.push(s.movement.speed);
    w.eDamage.push(scaledDamage);
    w.ePoisonT.push(0);
    w.ePoisonDps.push(0);
    w.ePoisonedOnDeath.push(false);
    w.eSpawnTriggerId.push(undefined);
    w.eAilments.push(createEnemyAilmentsState());
    w.ezVisual.push(0);
    w.ezLogical.push(0);
    w.eBrain.push(createEnemyBrainState(s));

    return i;
}

/** Spawn an enemy at world coordinates (converted to grid). */
export function spawnEnemy(w: World, type: EnemyId, x: number, y: number) {
    const gp = worldToGrid(x, y, KENNEY_TILE_WORLD);
    return spawnEnemyGrid(w, type, gp.gx, gp.gy, KENNEY_TILE_WORLD);
}
