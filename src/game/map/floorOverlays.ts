import type { World } from "../../engine/world/world";
import { getActiveMap, getSpawnWorldFromActive } from "./authoredMapActivation";
import type { TriggerDef } from "../triggers/triggerTypes";
import type { FloorIntent, PlacementPolicy } from "./floorIntent";
import { OBJECTIVE_TRIGGER_IDS } from "../systems/progression/objectiveSpec";
import { RNG } from "../util/rng";
import { objectiveIdFromArchetype, type ObjectiveId } from "./objectivePlan";
import { pickZoneTrialLikePlacements } from "../objectives/zoneObjectiveSystem";
import { DEFAULT_ZONE_TRIAL_CONFIG } from "../objectives/zoneObjectiveTypes";
import {
  collectReachableTiles,
  pickReachableTilesLongestPath,
  pickReachableTilesStatic,
  type TilePoint,
} from "./reachablePlacements";

export type OverlayAction =
  | {
      type: "PLACE_SPAWN_ZONES";
      count: number;
      radiusTiles: number;
      minSeparationTiles: number;
      placementPolicy: PlacementPolicy;
    }
  | {
      type: "PLACE_BOSS_SPAWN_ZONES";
      count: number;
      radiusTiles: number;
      minSeparationTiles: number;
      placementPolicy: PlacementPolicy;
    }
  | { type: "PLACE_VENDOR_NPC" }
  | { type: "PLACE_HEAL_INTERACTABLE" };

export type OverlaySpec = OverlayAction[];

const DEFAULT_ZONE_RADIUS = 2;
const DEFAULT_BOSS_ZONE_RADIUS = 7;
const DEFAULT_ZONE_MIN_SEPARATION = 6;

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function buildOverlaySeed(intent: FloorIntent, objectiveId: ObjectiveId): number {
  if (typeof intent.variantSeed === "number") return intent.variantSeed;
  return hashString(`${intent.nodeId}|${intent.floorIndex}|${objectiveId}`);
}

function normalizeZoneCenters(
  centers: TilePoint[],
  count: number,
  fallback: TilePoint
): TilePoint[] {
  if (count <= 0) return [];
  const out = centers.slice(0, count);
  if (out.length === 0) out.push(fallback);
  while (out.length < count) {
    const idx = (out.length - 1) % out.length;
    const seed = out[idx] ?? fallback;
    out.push({ tx: seed.tx, ty: seed.ty });
  }
  return out;
}

export function overlaySpecFromFloorIntent(intent: FloorIntent): OverlaySpec {
  const objectiveId = intent.objectiveId ?? objectiveIdFromArchetype(intent.archetype);
  switch (objectiveId) {
    case "ZONE_TRIAL":
    case "TIME_TRIAL_ZONES":
      return [];
    case "KILL_RARES_IN_ZONES":
      return [
        {
          type: "PLACE_BOSS_SPAWN_ZONES",
          count: intent.spawnZoneCount ?? 3,
          radiusTiles: intent.spawnZoneRadiusTiles ?? DEFAULT_BOSS_ZONE_RADIUS,
          minSeparationTiles: intent.spawnZoneMinSeparationTiles ?? DEFAULT_ZONE_MIN_SEPARATION,
          placementPolicy: intent.placementPolicy ?? "LONGEST_PATH",
        },
      ];
    case "VENDOR_VISIT":
      return [{ type: "PLACE_VENDOR_NPC" }];
    case "HEAL_VISIT":
      return [{ type: "PLACE_HEAL_INTERACTABLE" }];
    default:
      return [];
  }
}

export function applyFloorOverlays(world: World, intent: FloorIntent): void {
  const map = getActiveMap();
  if (!map) {
    world.overlayTriggerDefs = [];
    world.overlayTriggerVersion++;
    return;
  }

  const objectiveId = intent.objectiveId ?? objectiveIdFromArchetype(intent.archetype);
  const spec = overlaySpecFromFloorIntent(intent);
  const spawn = getSpawnWorldFromActive();
  const spawnTile = { tx: spawn.tx, ty: spawn.ty };
  const { tiles: candidates, walkable, nodes } = collectReachableTiles(spawnTile);
  const rng = new RNG(buildOverlaySeed(intent, objectiveId));

  const overlayTriggers: TriggerDef[] = [];

  if (objectiveId === "SURVIVE_TIMER") {
    overlayTriggers.push({
      id: OBJECTIVE_TRIGGER_IDS.timer,
      type: "timer",
      tx: spawnTile.tx,
      ty: spawnTile.ty,
      radius: 0,
    });
  }

  for (const action of spec) {
    switch (action.type) {
      case "PLACE_SPAWN_ZONES": {
        const centers =
          action.placementPolicy === "LONGEST_PATH"
            ? pickReachableTilesLongestPath(
                candidates,
                nodes,
                walkable,
                action.count,
                action.minSeparationTiles,
                rng,
                spawnTile,
                action.radiusTiles
              )
            : pickReachableTilesStatic(
                candidates,
                action.count,
                action.minSeparationTiles,
                rng,
                spawnTile
              );
        for (let i = 0; i < centers.length; i++) {
          overlayTriggers.push({
            id: `${OBJECTIVE_TRIGGER_IDS.zonePrefix}${i + 1}`,
            type: "radius",
            tx: centers[i].tx,
            ty: centers[i].ty,
            radius: action.radiusTiles,
          });
        }
        break;
      }
      case "PLACE_BOSS_SPAWN_ZONES": {
        const zoneLikePlacements = pickZoneTrialLikePlacements(
          world,
          action.count,
          DEFAULT_ZONE_TRIAL_CONFIG.zoneSize,
          rng,
        );
        const zoneLikeCenters = zoneLikePlacements.map((z) => ({
          tx: map.originTx + z.tileX + z.tileW * 0.5 - 0.5,
          ty: map.originTy + z.tileY + z.tileH * 0.5 - 0.5,
        }));
        const fallbackCenters =
          action.placementPolicy === "LONGEST_PATH"
            ? pickReachableTilesLongestPath(
                candidates,
                nodes,
                walkable,
                action.count,
                action.minSeparationTiles,
                rng,
                spawnTile,
                action.radiusTiles
              )
            : pickReachableTilesStatic(
                candidates,
                action.count,
                action.minSeparationTiles,
                rng,
                spawnTile
              );
        const centers = normalizeZoneCenters(
          zoneLikeCenters.length > 0 ? zoneLikeCenters : fallbackCenters,
          action.count,
          spawnTile,
        );
        for (let i = 0; i < centers.length; i++) {
          overlayTriggers.push({
            id: `${OBJECTIVE_TRIGGER_IDS.bossZonePrefix}${i + 1}`,
            type: "radius",
            tx: centers[i].tx,
            ty: centers[i].ty,
            radius: action.radiusTiles,
          });
        }
        break;
      }
      case "PLACE_VENDOR_NPC":
        overlayTriggers.push({
          id: OBJECTIVE_TRIGGER_IDS.vendor,
          type: "radius",
          tx: spawnTile.tx,
          ty: spawnTile.ty,
          radius: 1,
        });
        break;
      case "PLACE_HEAL_INTERACTABLE":
        overlayTriggers.push({
          id: OBJECTIVE_TRIGGER_IDS.heal,
          type: "radius",
          tx: spawnTile.tx,
          ty: spawnTile.ty,
          radius: 1,
        });
        break;
    }
  }

  world.overlayTriggerDefs = overlayTriggers;
  world.overlayTriggerVersion++;
}
