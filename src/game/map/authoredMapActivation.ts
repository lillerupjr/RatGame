import type { World } from "../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { setActiveMapSkinId } from "../../engine/render/sprites/renderSprites";
import { type CompiledKenneyMap, type IsoTile } from "./compile/kenneyMapLoader";
import {
  PLANE_TILE_Z_OFFSET,
  setActiveMap as setKenneyActiveMap,
  setActiveMapAsync as setKenneyActiveMapAsync,
} from "./compile/kenneyMap";
import type { TableMapDef } from "./formats/table/tableMapTypes";
import { setObjectives } from "../systems/progression/objective";
import { getSemanticFieldDefForTileId } from "../world/semanticFields";

let activeMap: CompiledKenneyMap | null = null;
let activeMapDef: TableMapDef | null = null;

export function getActiveMap(): CompiledKenneyMap | null {
  return activeMap;
}

export function getActiveMapDef(): TableMapDef | null {
  return activeMapDef;
}

export function activateMapDef(mapDef: TableMapDef, seed: number = 0): CompiledKenneyMap {
  const compiled = setKenneyActiveMap(mapDef, { runSeed: seed, mapId: mapDef.id });
  activeMap = compiled;
  activeMapDef = mapDef;
  setActiveMapSkinId(activeMapDef?.mapSkinId);
  return compiled;
}

export async function activateMapDefAsync(mapDef: TableMapDef, seed: number = 0): Promise<CompiledKenneyMap> {
  const compiled = await setKenneyActiveMapAsync(mapDef, { runSeed: seed, mapId: mapDef.id });
  activeMap = compiled;
  activeMapDef = mapDef;
  setActiveMapSkinId(activeMapDef?.mapSkinId);
  return compiled;
}

export function reloadActiveMap(seed: number = 0): CompiledKenneyMap | null {
  if (!activeMapDef) return null;
  return activateMapDef(activeMapDef, seed);
}

export async function reloadActiveMapAsync(seed: number = 0): Promise<CompiledKenneyMap | null> {
  if (!activeMapDef) return null;
  return activateMapDefAsync(activeMapDef, seed);
}

export function applyObjectivesFromActiveMap(world: World): void {
  const defs = activeMapDef?.objectiveDefs ?? [];
  setObjectives(world, defs);
}

export function getTileFromActive(tx: number, ty: number): IsoTile {
  if (!activeMap) return { kind: "VOID", h: 0 };
  return activeMap.getTile(tx, ty);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function isSpawnSafe(kind: IsoTile["kind"]): boolean {
  return getSemanticFieldDefForTileId(kind).isWalkable && kind !== "STAIRS";
}

function findSafeSpawnTile(tx: number, ty: number): { tx: number; ty: number } {
  if (!activeMap || !activeMapDef) return { tx, ty };

  const minTx = activeMap.originTx;
  const minTy = activeMap.originTy;
  const maxTx = activeMap.originTx + activeMapDef.w - 1;
  const maxTy = activeMap.originTy + activeMapDef.h - 1;

  const startTx = clamp(tx, minTx, maxTx);
  const startTy = clamp(ty, minTy, maxTy);
  const startTile = activeMap.getTile(startTx, startTy);
  if (isSpawnSafe(startTile.kind)) return { tx: startTx, ty: startTy };

  const maxR = Math.max(activeMapDef.w, activeMapDef.h);
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = startTx + dx;
        const ny = startTy + dy;
        if (nx < minTx || nx > maxTx || ny < minTy || ny > maxTy) continue;
        const tile = activeMap.getTile(nx, ny);
        if (isSpawnSafe(tile.kind)) return { tx: nx, ty: ny };
      }
    }
  }

  return { tx: startTx, ty: startTy };
}

export function getSpawnWorldFromActive(): {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  h: number;
} {
  if (!activeMap) return { x: 0, y: 0, z: 0, tx: 0, ty: 0, h: 0 };
  const safe = findSafeSpawnTile(activeMap.spawnTx, activeMap.spawnTy);
  const tile = activeMap.getTile(safe.tx, safe.ty);
  const h = tile.kind === "VOID" ? 0 : (tile.h | 0) + PLANE_TILE_Z_OFFSET;
  return {
    x: (safe.tx + 0.5) * KENNEY_TILE_WORLD,
    y: (safe.ty + 0.5) * KENNEY_TILE_WORLD,
    z: h,
    tx: safe.tx,
    ty: safe.ty,
    h,
  };
}

export function getGoalWorldFromActive(): {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  h: number;
} | null {
  if (!activeMap || activeMap.goalTx === null || activeMap.goalTy === null) return null;
  const tile = activeMap.getTile(activeMap.goalTx, activeMap.goalTy);
  const h = tile.kind === "VOID" ? 0 : (tile.h | 0) + PLANE_TILE_Z_OFFSET;
  return {
    x: (activeMap.goalTx + 0.5) * KENNEY_TILE_WORLD,
    y: (activeMap.goalTy + 0.5) * KENNEY_TILE_WORLD,
    z: h,
    tx: activeMap.goalTx,
    ty: activeMap.goalTy,
    h,
  };
}

export function isWalkable(tx: number, ty: number): boolean {
  return getSemanticFieldDefForTileId(getTileFromActive(tx, ty).kind).isWalkable;
}

export function isHole(tx: number, ty: number): boolean {
  return getTileFromActive(tx, ty).kind === "VOID";
}

export function isStairs(tx: number, ty: number): boolean {
  return getTileFromActive(tx, ty).kind === "STAIRS";
}

export function getTileHeight(tx: number, ty: number): number {
  return getTileFromActive(tx, ty).h | 0;
}

export type MapStats = {
  id: string;
  width: number;
  height: number;
  floorTileCount: number;
  stairsTileCount: number;
  voidTileCount: number;
  maxHeight: number;
  hasGoal: boolean;
  spawnToGoalDistance: number | null;
};

export function getActiveMapStats(): MapStats | null {
  if (!activeMap || !activeMapDef) return null;

  let floorTileCount = 0;
  let stairsTileCount = 0;
  let voidTileCount = 0;
  let maxHeight = 0;

  for (let y = 0; y < activeMapDef.h; y++) {
    for (let x = 0; x < activeMapDef.w; x++) {
      const tx = x + activeMap.originTx;
      const ty = y + activeMap.originTy;
      const tile = activeMap.getTile(tx, ty);
      switch (tile.kind) {
        case "FLOOR":
        case "SPAWN":
        case "GOAL":
          floorTileCount++;
          maxHeight = Math.max(maxHeight, tile.h);
          break;
        case "STAIRS":
          stairsTileCount++;
          maxHeight = Math.max(maxHeight, tile.h);
          break;
        case "VOID":
          voidTileCount++;
          break;
      }
    }
  }

  const hasGoal = activeMap.goalTx !== null && activeMap.goalTy !== null;
  let spawnToGoalDistance: number | null = null;
  if (hasGoal && activeMap.goalTx !== null && activeMap.goalTy !== null) {
    spawnToGoalDistance = Math.hypot(activeMap.goalTx - activeMap.spawnTx, activeMap.goalTy - activeMap.spawnTy);
  }

  return {
    id: activeMapDef.id,
    width: activeMapDef.w,
    height: activeMapDef.h,
    floorTileCount,
    stairsTileCount,
    voidTileCount,
    maxHeight,
    hasGoal,
    spawnToGoalDistance,
  };
}

export function getActiveMapAscii(): string {
  if (!activeMap || !activeMapDef) return "(no active map)";
  const lines: string[] = [];
  for (let y = 0; y < activeMapDef.h; y++) {
    let line = "";
    for (let x = 0; x < activeMapDef.w; x++) {
      const tx = x + activeMap.originTx;
      const ty = y + activeMap.originTy;
      if (tx === activeMap.spawnTx && ty === activeMap.spawnTy) {
        line += "S";
        continue;
      }
      if (tx === activeMap.goalTx && ty === activeMap.goalTy) {
        line += "G";
        continue;
      }
      const tile = activeMap.getTile(tx, ty);
      if (tile.kind === "VOID") line += " ";
      else if (tile.kind === "STAIRS") line += "~";
      else line += ".";
    }
    lines.push(line);
  }
  return lines.join("\n");
}

export function debugLogActiveMap(): void {
  const stats = getActiveMapStats();
  if (!stats) {
    console.log("[AuthoredMap] No active map");
    return;
  }
  console.log("[AuthoredMap] Active Map Stats:");
  console.log(`  ID: ${stats.id}`);
  console.log(`  Size: ${stats.width}x${stats.height}`);
  console.log(`  Floors: ${stats.floorTileCount}, Stairs: ${stats.stairsTileCount}, Void: ${stats.voidTileCount}`);
  console.log(`  Max Height: ${stats.maxHeight}`);
  console.log(`  Has Goal: ${stats.hasGoal}`);
  if (stats.spawnToGoalDistance !== null) {
    console.log(`  Spawn->Goal Distance: ${stats.spawnToGoalDistance.toFixed(1)} tiles`);
  }
  console.log("\n" + getActiveMapAscii());
}
