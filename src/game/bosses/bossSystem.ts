import type { World } from "../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { getEnemyWorld, getPlayerWorld } from "../coords/worldViews";
import { worldToTile } from "../map/compile/kenneyMap";
import {
  beginBossCast,
  selectAbilityForEncounter,
  stepBossCastPhase,
} from "./bossAbilityRunner";
import { updateArenaTileEffects } from "./arenaTileEffects";
import {
  activateBossEncounter,
  getBossDefinitionForEntity,
} from "./bossRuntime";

function updateEncounterCooldowns(world: World, enemyIndex: number, dt: number): void {
  const encounterId = world.bossRuntime.enemyIndexToEncounterId?.[enemyIndex];
  if (typeof encounterId !== "string") return;
  const encounters = world.bossRuntime.encounters;
  for (let i = 0; i < encounters.length; i++) {
    const encounter = encounters[i];
    if (encounter.id !== encounterId) continue;
    encounter.globalCooldownLeftSec = Math.max(0, encounter.globalCooldownLeftSec - dt);
    const cooldownIds = Object.keys(encounter.cooldowns) as Array<keyof typeof encounter.cooldowns>;
    for (let j = 0; j < cooldownIds.length; j++) {
      const id = cooldownIds[j];
      encounter.cooldowns[id] = Math.max(0, encounter.cooldowns[id] - dt);
    }
    return;
  }
}

export function bossEncounterSystem(world: World, dt: number): void {
  updateArenaTileEffects(world, dt);
  const encounters = world.bossRuntime.encounters;
  for (let i = 0; i < encounters.length; i++) {
    const encounter = encounters[i];
    if (encounter.status !== "ACTIVE") continue;

    const enemyIndex = encounter.enemyIndex;
    if (!world.eAlive[enemyIndex]) continue;

    if (encounter.activationState === "DORMANT") {
      const boss = getBossDefinitionForEntity(world, enemyIndex);
      if (!boss) continue;
      const bossWorld = getEnemyWorld(world, enemyIndex, KENNEY_TILE_WORLD);
      const playerWorld = getPlayerWorld(world, KENNEY_TILE_WORLD);
      const bossTile = worldToTile(bossWorld.wx, bossWorld.wy, KENNEY_TILE_WORLD);
      const playerTile = worldToTile(playerWorld.wx, playerWorld.wy, KENNEY_TILE_WORLD);
      const tileDistance = Math.hypot(playerTile.tx - bossTile.tx, playerTile.ty - bossTile.ty);
      if (tileDistance <= boss.engageDistanceTiles) {
        activateBossEncounter(world, enemyIndex);
      }
      continue;
    }

    updateEncounterCooldowns(world, enemyIndex, dt);

    if (encounter.activeCast) {
      stepBossCastPhase(world, encounter.id, enemyIndex, dt);
      continue;
    }
    if (encounter.globalCooldownLeftSec > 0) continue;

    const ability = selectAbilityForEncounter(world, enemyIndex);
    if (!ability) continue;
    beginBossCast(world, enemyIndex, ability.id);
    encounter.globalCooldownLeftSec = 0.15;
  }
}
