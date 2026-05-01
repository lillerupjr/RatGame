import type { World } from "../../engine/world/world";
import { EnemyId } from "../content/enemies";
import { BossAbilityId as BossAbilityIds, type BossAbilityId } from "./bossAbilities";
import { bossRegistry } from "./bossRegistry";
import type {
  BossActivationState,
  BossDefinition,
  BossEncounterState,
  BossId,
  BossRuntimeState,
} from "./bossTypes";

export function createBossRuntimeState(): BossRuntimeState {
  return {
    nextEncounterSeq: 1,
    nextCastSeq: 1,
    nextArenaEffectSeq: 1,
    activeEncounterId: null,
    encounters: [],
    enemyIndexToEncounterId: [],
    objectiveToEncounterId: Object.create(null) as Record<string, string | undefined>,
  };
}

export function resetBossRuntime(world: World): void {
  world.bossRuntime = createBossRuntimeState();
}

export function isBossEntity(world: Pick<World, "eBossId" | "eType">, enemyIndex: number): boolean {
  if (!Number.isFinite(enemyIndex) || enemyIndex < 0) return false;
  if (typeof world.eBossId?.[enemyIndex] === "string") return true;
  return world.eType?.[enemyIndex] === EnemyId.BOSS;
}

export function getBossDefinitionForEntity(world: Pick<World, "eBossId">, enemyIndex: number): BossDefinition | null {
  const bossId = world.eBossId?.[enemyIndex];
  if (typeof bossId !== "string") return null;
  return bossRegistry.boss(bossId as BossId);
}

export function registerBossEncounter(
  world: World,
  args: { bossId: BossId; enemyIndex: number; objectiveId?: string; activationState?: BossActivationState },
): BossEncounterState {
  const runtime = world.bossRuntime;
  const encounterId = `BOSS_ENCOUNTER_${runtime.nextEncounterSeq++}`;
  const encounter: BossEncounterState = {
    id: encounterId,
    bossId: args.bossId,
    enemyIndex: args.enemyIndex,
    objectiveId: args.objectiveId,
    status: "ACTIVE",
    activationState: args.activationState ?? "ACTIVE",
    activeCast: null,
    requestedAnimation: null,
    cooldowns: Object.create(null) as Record<BossAbilityId, number>,
    globalCooldownLeftSec: 0,
    lastAbilityId: null,
    nextAbilityCursor: 0,
  };
  runtime.encounters.push(encounter);
  runtime.enemyIndexToEncounterId[args.enemyIndex] = encounterId;
  runtime.activeEncounterId = encounterId;
  if (args.objectiveId) {
    runtime.objectiveToEncounterId[args.objectiveId] = encounterId;
  }
  return encounter;
}

export function bindObjectiveToBossEncounter(
  world: World,
  objectiveId: string,
  encounterId: string,
): void {
  world.bossRuntime.objectiveToEncounterId[objectiveId] = encounterId;
  const encounter = getBossEncounter(world, encounterId);
  if (encounter) encounter.objectiveId = objectiveId;
}

export function getBossEncounter(world: Pick<World, "bossRuntime">, encounterId: string): BossEncounterState | null {
  const encounters = world.bossRuntime?.encounters ?? [];
  for (let i = 0; i < encounters.length; i++) {
    if (encounters[i].id === encounterId) return encounters[i];
  }
  return null;
}

export function getBossEncounterForEntity(
  world: Pick<World, "bossRuntime">,
  enemyIndex: number,
): BossEncounterState | null {
  const encounterId = world.bossRuntime?.enemyIndexToEncounterId?.[enemyIndex];
  if (typeof encounterId !== "string") return null;
  return getBossEncounter(world, encounterId);
}

export function getTrackedBossEncounterForObjective(
  world: Pick<World, "bossRuntime">,
  objectiveId: string,
): BossEncounterState | null {
  const encounterId = world.bossRuntime?.objectiveToEncounterId?.[objectiveId];
  if (typeof encounterId !== "string") return null;
  return getBossEncounter(world, encounterId);
}

export function getActiveBossEncounter(world: Pick<World, "bossRuntime">): BossEncounterState | null {
  const activeEncounterId = world.bossRuntime?.activeEncounterId;
  if (typeof activeEncounterId === "string") {
    const active = getBossEncounter(world, activeEncounterId);
    if (active && active.status === "ACTIVE") return active;
  }
  const encounters = world.bossRuntime?.encounters ?? [];
  for (let i = 0; i < encounters.length; i++) {
    if (encounters[i].status === "ACTIVE") return encounters[i];
  }
  return null;
}

export function isBossEncounterDormant(
  world: Pick<World, "bossRuntime">,
  enemyIndex: number,
): boolean {
  return getBossEncounterForEntity(world, enemyIndex)?.activationState === "DORMANT";
}

export function isBossMovementLockedByCast(
  world: Pick<World, "bossRuntime">,
  enemyIndex: number,
): boolean {
  const cast = getBossEncounterForEntity(world, enemyIndex)?.activeCast;
  return cast?.abilityId === BossAbilityIds.POISON_FLAMETHROWER && cast.phase === "ACTIVE";
}

export function activateBossEncounter(
  world: Pick<World, "bossRuntime">,
  enemyIndex: number,
): BossEncounterState | null {
  const encounter = getBossEncounterForEntity(world, enemyIndex);
  if (!encounter || encounter.status !== "ACTIVE") return encounter;
  encounter.activationState = "ACTIVE";
  return encounter;
}

export function markBossEncounterDefeated(world: World, enemyIndex: number): void {
  const encounter = getBossEncounterForEntity(world, enemyIndex);
  if (!encounter) return;
  encounter.status = "DEFEATED";
  encounter.activeCast = null;
  encounter.requestedAnimation = null;
  world.arenaTileEffects = world.arenaTileEffects.filter((effect) => effect.encounterId !== encounter.id);
  if (world.bossRuntime.activeEncounterId === encounter.id) {
    world.bossRuntime.activeEncounterId = null;
  }
}
