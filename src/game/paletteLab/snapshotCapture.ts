import type { World } from "../../engine/world/world";
import { getActiveMap } from "../map/authoredMapActivation";
import type {
  PaletteSnapshotCameraState,
  PaletteSnapshotMetadata,
  PaletteSnapshotSceneContext,
} from "./terminology";
import { PALETTE_SNAPSHOT_SCHEMA_VERSION } from "./snapshotSchema";

export interface PaletteSnapshotCaptureDraft {
  metadata: PaletteSnapshotMetadata;
  sceneContext: PaletteSnapshotSceneContext;
  cameraState: PaletteSnapshotCameraState;
  worldState: {
    player: {
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
    enemies: Array<{
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
    }>;
    lighting: {
      darknessAlpha: number;
      ambientTint?: string;
      ambientTintStrength?: number;
    };
  };
}

export type CapturePaletteSnapshotOptions = {
  name?: string;
  nowMs?: number;
  idFactory?: () => string;
};

function safeNum(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatLocalTimestamp(nowMs: number): string {
  const d = new Date(nowMs);
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function toDisplayMapName(mapId: string): string {
  const normalized = mapId
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "Map";

  const words = normalized.split(" ");
  return words
    .map((word) => {
      const upper = word.toUpperCase();
      if (word === upper && word.length <= 3) return word;
      const lower = word.toLowerCase();
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join(" ");
}

function createSnapshotId(nowMs: number, idFactory?: () => string): string {
  const custom = idFactory?.();
  if (custom && custom.length > 0) return custom;

  const randomPart = Math.floor(Math.random() * 0xffffffff)
    .toString(36)
    .padStart(7, "0");
  return `ps_${nowMs.toString(36)}_${randomPart}`;
}

function resolveSceneContext(world: World): PaletteSnapshotSceneContext {
  const activeMap = getActiveMap();
  const floorIntent = (world as any)?.currentFloorIntent as
    | {
      mapId?: string;
      zoneId?: string;
      variantSeed?: number;
    }
    | null
    | undefined;

  const mapId =
    (typeof activeMap?.id === "string" && activeMap.id.length > 0 ? activeMap.id : undefined) ??
    (typeof floorIntent?.mapId === "string" && floorIntent.mapId.length > 0 ? floorIntent.mapId : undefined) ??
    `floor_${Math.max(0, Math.floor(safeNum((world as any)?.floorIndex, 0)))}`;

  const biomeId =
    (typeof floorIntent?.zoneId === "string" && floorIntent.zoneId.length > 0 ? floorIntent.zoneId : undefined) ??
    (typeof (world as any)?.stageId === "string" ? (world as any).stageId : undefined);

  const seedCandidate = floorIntent?.variantSeed;
  const fallbackSeed = safeNum((world as any)?.runSeed, NaN);
  const seed = Number.isFinite(seedCandidate) ? seedCandidate : Number.isFinite(fallbackSeed) ? fallbackSeed : undefined;

  return {
    mapId,
    biomeId,
    seed,
  };
}

function resolveCameraState(world: World): PaletteSnapshotCameraState {
  const camera = (world as any)?.camera ?? {};
  const cameraSafeRect = (world as any)?.cameraSafeRect ?? {};
  return {
    cameraX: safeNum(camera.posX, 0),
    cameraY: safeNum(camera.posY, 0),
    cameraZoom: safeNum(cameraSafeRect.zoom, 1),
  };
}

function resolveWorldState(world: World): PaletteSnapshotCaptureDraft["worldState"] {
  const enemyAlive = Array.isArray((world as any).eAlive) ? (world as any).eAlive : [];
  const enemyCount = enemyAlive.length;
  const enemies: PaletteSnapshotCaptureDraft["worldState"]["enemies"] = [];

  for (let i = 0; i < enemyCount; i += 1) {
    if (!enemyAlive[i]) continue;
    enemies.push({
      id: i,
      type: safeNum((world as any).eType?.[i], 0),
      pgxi: safeNum((world as any).egxi?.[i], 0),
      pgyi: safeNum((world as any).egyi?.[i], 0),
      pgox: safeNum((world as any).egox?.[i], 0),
      pgoy: safeNum((world as any).egoy?.[i], 0),
      hp: safeNum((world as any).eHp?.[i], 0),
      faceX: safeNum((world as any).eFaceX?.[i], 0),
      faceY: safeNum((world as any).eFaceY?.[i], -1),
      zVisual: safeNum((world as any).ezVisual?.[i], 0),
      zLogical: safeNum((world as any).ezLogical?.[i], 0),
    });
  }

  return {
    player: {
      pgxi: safeNum((world as any).pgxi, 0),
      pgyi: safeNum((world as any).pgyi, 0),
      pgox: safeNum((world as any).pgox, 0),
      pgoy: safeNum((world as any).pgoy, 0),
      pz: safeNum((world as any).pz, 0),
      pzVisual: safeNum((world as any).pzVisual, 0),
      pzLogical: safeNum((world as any).pzLogical, 0),
      pvx: safeNum((world as any).pvx, 0),
      pvy: safeNum((world as any).pvy, 0),
      lastAimX: safeNum((world as any).lastAimX, 0),
      lastAimY: safeNum((world as any).lastAimY, 0),
    },
    enemies,
    lighting: {
      darknessAlpha: safeNum((world as any).lighting?.darknessAlpha, 0.5),
      ambientTint:
        typeof (world as any).lighting?.ambientTint === "string"
          ? (world as any).lighting.ambientTint
          : undefined,
      ambientTintStrength: safeNum((world as any).lighting?.ambientTintStrength, 0),
    },
  };
}

export function capturePaletteSnapshotDraft(
  world: World,
  options: CapturePaletteSnapshotOptions = {},
): PaletteSnapshotCaptureDraft {
  const nowMs = Number.isFinite(options.nowMs) ? (options.nowMs as number) : Date.now();
  const sceneContext = resolveSceneContext(world);
  const mapLabel = toDisplayMapName(sceneContext.mapId);
  const metadata: PaletteSnapshotMetadata = {
    id: createSnapshotId(nowMs, options.idFactory),
    version: PALETTE_SNAPSHOT_SCHEMA_VERSION,
    createdAt: nowMs,
    name: options.name?.trim().length
      ? options.name.trim()
      : `${mapLabel} - ${formatLocalTimestamp(nowMs)}`,
  };

  return {
    metadata,
    sceneContext,
    cameraState: resolveCameraState(world),
    worldState: resolveWorldState(world),
  };
}
