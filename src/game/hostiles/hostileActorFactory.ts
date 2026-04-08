import type { World } from "../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { anchorFromWorld } from "../coords/anchor";
import { gridToWorld } from "../coords/grid";
import { createEnemyAilmentsState } from "../combat_mods/ailments/enemyAilments";
import type { EnemyBrainState } from "../systems/enemies/brain";
import type {
  HostileBodyConfig,
  HostileMovementConfig,
  HostileStatsConfig,
} from "./hostileTypes";

export type SpawnHostileActorGridArgs = {
  actorType: number;
  gx: number;
  gy: number;
  tileWorld?: number;
  stats: HostileStatsConfig;
  body: HostileBodyConfig;
  movement: HostileMovementConfig;
  scaledHp: number;
  scaledDamage: number;
  baseLife?: number;
  radius?: number;
  splitStage?: number;
  visualScale?: number;
  spawnTriggerId?: string;
  bossId?: string;
  brainFactory?: () => EnemyBrainState;
};

export function spawnHostileActorGrid(
  world: World,
  args: SpawnHostileActorGridArgs,
): number {
  const tileWorld = args.tileWorld ?? KENNEY_TILE_WORLD;
  const baseLife = Math.max(1, Math.round(args.baseLife ?? args.stats.baseLife));
  const scaledHp = Math.max(1, Math.round(args.scaledHp));
  const scaledDamage = Math.max(0, Math.round(args.scaledDamage));
  const radius = Math.max(1, args.radius ?? args.body.radius);
  const splitStage = Number.isFinite(args.splitStage) ? Math.max(0, Math.floor(args.splitStage as number)) : 0;
  const visualScale = Number.isFinite(args.visualScale) ? Math.max(0.1, args.visualScale as number) : 1;

  const index = world.eAlive.length;
  world.eAlive.push(true);
  world.eType.push(args.actorType);

  const wp = gridToWorld(args.gx, args.gy, tileWorld);
  const anchor = anchorFromWorld(wp.wx, wp.wy, tileWorld);
  world.egxi.push(anchor.gxi);
  world.egyi.push(anchor.gyi);
  world.egox.push(anchor.gox);
  world.egoy.push(anchor.goy);

  world.evx.push(0);
  world.evy.push(0);
  world.eFaceX.push(0);
  world.eFaceY.push(-1);
  world.eBaseLife.push(baseLife);
  world.eHp.push(scaledHp);
  world.eHpMax.push(scaledHp);
  world.eR.push(radius);
  world.eSplitStage.push(splitStage);
  world.eVisualScale.push(visualScale);
  world.eSpeed.push(args.movement.speed);
  world.eDamage.push(scaledDamage);
  world.ePoisonT.push(0);
  world.ePoisonDps.push(0);
  world.ePoisonedOnDeath.push(false);
  world.eSpawnTriggerId.push(args.spawnTriggerId);
  world.eBossId.push(args.bossId);
  world.eAilments.push(createEnemyAilmentsState());
  world.ezVisual.push(0);
  world.ezLogical.push(0);
  world.eBrain.push(args.brainFactory ? args.brainFactory() : undefined);

  return index;
}
