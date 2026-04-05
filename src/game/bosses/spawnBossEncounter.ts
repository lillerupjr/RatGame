import type { World } from "../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { EnemyId } from "../content/enemies";
import { worldToGrid } from "../coords/grid";
import { spawnHostileActorGrid } from "../hostiles/hostileActorFactory";
import { getActiveMap } from "../map/authoredMapActivation";
import { bossRegistry } from "./bossRegistry";
import {
  bindObjectiveToBossEncounter,
  registerBossEncounter,
} from "./bossRuntime";
import type { BossActivationState, BossId, SpawnBossEncounterResult } from "./bossTypes";

export function spawnBossEncounter(
  world: World,
  args: {
    bossId: BossId;
    spawnWorldX: number;
    spawnWorldY: number;
    objectiveId?: string;
    spawnTriggerId?: string;
    activationState?: BossActivationState;
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
    activationState: args.activationState,
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
  },
): SpawnBossEncounterResult {
  const activeMap = getActiveMap();
  const bossSpawn = activeMap?.semanticData?.bossSpawn;
  if (!activeMap || !bossSpawn) {
    const mapId = activeMap?.id ?? "UNKNOWN_MAP";
    throw new Error(`Act boss map ${mapId} is missing required semantic boss_spawn.`);
  }
  const targetWorldX = (bossSpawn.tx + 0.5) * KENNEY_TILE_WORLD;
  const targetWorldY = (bossSpawn.ty + 0.5) * KENNEY_TILE_WORLD;
  return spawnBossEncounter(world, {
    bossId: args.bossId,
    spawnWorldX: targetWorldX,
    spawnWorldY: targetWorldY,
    objectiveId: args.objectiveId,
    activationState: "DORMANT",
  });
}
