import type { World } from "../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { EnemyId } from "../content/enemies";
import { worldToGrid } from "../coords/grid";
import { spawnHostileActorGrid } from "../hostiles/hostileActorFactory";
import { getSpawnWorldFromActive } from "../map/authoredMapActivation";
import {
  collectReachableTiles,
  pickReachableTilesLongestPath,
} from "../map/reachablePlacements";
import { RNG } from "../util/rng";
import { bossRegistry } from "./bossRegistry";
import {
  bindObjectiveToBossEncounter,
  registerBossEncounter,
} from "./bossRuntime";
import type { BossId, SpawnBossEncounterResult } from "./bossTypes";

export function spawnBossEncounter(
  world: World,
  args: {
    bossId: BossId;
    spawnWorldX: number;
    spawnWorldY: number;
    objectiveId?: string;
    spawnTriggerId?: string;
  },
): SpawnBossEncounterResult {
  const boss = bossRegistry.boss(args.bossId);
  const gp = worldToGrid(args.spawnWorldX, args.spawnWorldY, KENNEY_TILE_WORLD);
  const scaling = world.delveScaling ?? { hpMult: 1, damageMult: 1 };
  const enemyIndex = spawnHostileActorGrid(world, {
    actorType: EnemyId.BOSS,
    gx: gp.gx,
    gy: gp.gy,
    tileWorld: KENNEY_TILE_WORLD,
    stats: boss.stats,
    body: boss.body,
    movement: boss.movement,
    scaledHp: Math.max(1, Math.round(boss.stats.baseLife * scaling.hpMult)),
    scaledDamage: Math.max(0, Math.round(boss.stats.contactDamage * scaling.damageMult)),
    spawnTriggerId: args.spawnTriggerId,
    bossId: boss.id,
  });
  const encounter = registerBossEncounter(world, {
    bossId: boss.id,
    enemyIndex,
    objectiveId: args.objectiveId,
  });
  if (args.objectiveId) {
    bindObjectiveToBossEncounter(world, args.objectiveId, encounter.id);
  }
  return {
    encounterId: encounter.id,
    bossId: boss.id,
    enemyIndex,
  };
}

export function spawnActBossEncounterFromActiveMap(
  world: World,
  args: {
    bossId: BossId;
    objectiveId: string;
    seed: number;
  },
): SpawnBossEncounterResult {
  const spawn = getSpawnWorldFromActive();
  const spawnTile = { tx: spawn.tx, ty: spawn.ty };
  const { tiles, walkable, nodes } = collectReachableTiles(spawnTile);
  const rng = new RNG(args.seed >>> 0);
  const [pickedTile] = pickReachableTilesLongestPath(
    tiles,
    nodes,
    walkable,
    1,
    0,
    rng,
    spawnTile,
    0,
  );
  const targetTile = pickedTile ?? spawnTile;
  const targetWorldX = (targetTile.tx + 0.5) * KENNEY_TILE_WORLD;
  const targetWorldY = (targetTile.ty + 0.5) * KENNEY_TILE_WORLD;
  return spawnBossEncounter(world, {
    bossId: args.bossId,
    spawnWorldX: targetWorldX,
    spawnWorldY: targetWorldY,
    objectiveId: args.objectiveId,
  });
}
