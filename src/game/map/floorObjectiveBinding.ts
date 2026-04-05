import type { FloorIntent } from "./floorIntent";
import type { ObjectiveSpec } from "../systems/progression/objectiveSpec";
import { objectiveIdFromArchetype, objectiveSpecFromObjectiveId } from "./objectivePlan";

export function objectiveSpecFromFloorIntent(intent: FloorIntent): ObjectiveSpec {
  const objectiveId = intent.objectiveId ?? objectiveIdFromArchetype(intent.archetype);
  return objectiveSpecFromObjectiveId(objectiveId, {
    timeLimitSec: intent.timeLimitSec,
    zoneCount: intent.spawnZoneCount,
    bossCount: intent.bossCount,
    bossId: intent.bossId ?? null,
  });
}
