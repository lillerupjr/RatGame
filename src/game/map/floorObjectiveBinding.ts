import type { FloorIntent } from "./floorIntent";
import type { ObjectiveSpec } from "../systems/progression/objectiveSpec";
import { objectiveIdFromArchetype, objectiveSpecFromObjectiveId } from "./objectivePlan";

export function objectiveSpecFromFloorIntent(intent: FloorIntent): ObjectiveSpec {
  const objectiveId = intent.objectiveId ?? objectiveIdFromArchetype(intent.archetype);
  return objectiveSpecFromObjectiveId(objectiveId, {
    timeLimitSec: intent.timeLimitSec,
    zoneCount: intent.spawnZoneCount,
    rareCount: intent.rareCount,
    bossId: intent.bossId ?? null,
  });
}
