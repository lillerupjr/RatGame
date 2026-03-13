import type { StageId } from "../content/stages";
import type { FloorIntent } from "../map/floorIntent";
import { assertPaletteSnapshotWorldStateScope } from "./scope";
import type { PaletteSnapshotStorageRecord } from "./snapshotStorage";

type SnapshotWorldStateLike = {
  player?: unknown;
  enemies?: unknown;
  lighting?: unknown;
};

export type PaletteSnapshotRestoredPlayerState = {
  pgxi: number;
  pgyi: number;
  pgox: number;
  pgoy: number;
  pz: number;
  pzVisual: number;
  pzLogical: number;
  pvx: number;
  pvy: number;
  lastAimX: number;
  lastAimY: number;
};

export type PaletteSnapshotRestoredEnemyState = {
  id: number;
  type: number;
  pgxi: number;
  pgyi: number;
  pgox: number;
  pgoy: number;
  hp: number;
  faceX: number;
  faceY: number;
  zVisual: number;
  zLogical: number;
};

export type PaletteSnapshotRestoredLightingState = {
  darknessAlpha: number;
  ambientTint?: string;
  ambientTintStrength: number;
};

export type PaletteSnapshotRestoredSceneState = {
  stageId: StageId;
  mapId?: string;
  seed?: number;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  player: PaletteSnapshotRestoredPlayerState;
  enemies: PaletteSnapshotRestoredEnemyState[];
  lighting: PaletteSnapshotRestoredLightingState;
};

function safeNum(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeInt(value: unknown, fallback = 0): number {
  return Math.trunc(safeNum(value, fallback));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeBiomeId(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeMapId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeSnapshotStageId(rawBiomeId: unknown, fallback: StageId): StageId {
  const normalized = normalizeBiomeId(rawBiomeId);
  if (normalized === "DOCKS") return "DOCKS";
  if (normalized === "SEWERS") return "SEWERS";
  if (normalized === "CHINATOWN") return "CHINATOWN";
  return fallback;
}

export function buildPaletteSnapshotFloorIntent(
  record: Pick<PaletteSnapshotStorageRecord, "id" | "sceneContext">,
  fallbackStageId: StageId,
  fallbackSeed: number,
): FloorIntent {
  const mapId = normalizeMapId(record.sceneContext?.mapId);
  const stageId = normalizeSnapshotStageId(record.sceneContext?.biomeId, fallbackStageId);
  const seedCandidate = safeInt(record.sceneContext?.seed, fallbackSeed);

  return {
    nodeId: `PALETTE_SNAPSHOT_${record.id}`,
    zoneId: stageId,
    depth: 1,
    floorIndex: 0,
    archetype: "SURVIVE",
    mapId: mapId as FloorIntent["mapId"],
    variantSeed: seedCandidate,
  };
}

export function extractPaletteSnapshotSceneRestoreState(
  record: PaletteSnapshotStorageRecord,
  fallbackStageId: StageId,
): PaletteSnapshotRestoredSceneState {
  assertPaletteSnapshotWorldStateScope(record.worldState);

  const rawWorldState = (
    record.worldState && typeof record.worldState === "object"
      ? record.worldState
      : {}
  ) as SnapshotWorldStateLike;
  const rawPlayer =
    rawWorldState.player && typeof rawWorldState.player === "object"
      ? (rawWorldState.player as Record<string, unknown>)
      : {};
  const rawEnemies = Array.isArray(rawWorldState.enemies) ? rawWorldState.enemies : [];
  const rawLighting =
    rawWorldState.lighting && typeof rawWorldState.lighting === "object"
      ? (rawWorldState.lighting as Record<string, unknown>)
      : {};

  const enemies: PaletteSnapshotRestoredEnemyState[] = [];
  for (const rawEnemy of rawEnemies) {
    if (!rawEnemy || typeof rawEnemy !== "object") continue;
    const enemy = rawEnemy as Record<string, unknown>;
    enemies.push({
      id: safeInt(enemy.id, 0),
      type: safeInt(enemy.type, 0),
      pgxi: safeInt(enemy.pgxi, 0),
      pgyi: safeInt(enemy.pgyi, 0),
      pgox: safeNum(enemy.pgox, 0),
      pgoy: safeNum(enemy.pgoy, 0),
      hp: safeNum(enemy.hp, 1),
      faceX: safeNum(enemy.faceX, 0),
      faceY: safeNum(enemy.faceY, -1),
      zVisual: safeNum(enemy.zVisual, 0),
      zLogical: safeInt(enemy.zLogical, 0),
    });
  }

  return {
    stageId: normalizeSnapshotStageId(record.sceneContext?.biomeId, fallbackStageId),
    mapId: normalizeMapId(record.sceneContext?.mapId),
    seed: safeInt(record.sceneContext?.seed, 0),
    cameraX: safeNum(record.cameraState?.cameraX, 0),
    cameraY: safeNum(record.cameraState?.cameraY, 0),
    cameraZoom: Math.max(0.01, safeNum(record.cameraState?.cameraZoom, 1)),
    player: {
      pgxi: safeInt(rawPlayer.pgxi, 0),
      pgyi: safeInt(rawPlayer.pgyi, 0),
      pgox: safeNum(rawPlayer.pgox, 0),
      pgoy: safeNum(rawPlayer.pgoy, 0),
      pz: safeNum(rawPlayer.pz, 0),
      pzVisual: safeNum(rawPlayer.pzVisual, 0),
      pzLogical: safeInt(rawPlayer.pzLogical, 0),
      pvx: safeNum(rawPlayer.pvx, 0),
      pvy: safeNum(rawPlayer.pvy, 0),
      lastAimX: safeNum(rawPlayer.lastAimX, 0),
      lastAimY: safeNum(rawPlayer.lastAimY, -1),
    },
    enemies,
    lighting: {
      darknessAlpha: clamp01(safeNum(rawLighting.darknessAlpha, 0.5)),
      ambientTint:
        typeof rawLighting.ambientTint === "string" && rawLighting.ambientTint.length > 0
          ? rawLighting.ambientTint
          : undefined,
      ambientTintStrength: clamp01(safeNum(rawLighting.ambientTintStrength, 0)),
    },
  };
}
