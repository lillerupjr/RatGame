// @system   map-compilation/activation/floor-topology
// @owns     converts floor intents into runtime objective specs with archetype fallback
// @doc      docs/canonical/map_compilation_activation_floor_topology.md
// @agents   no objective ticking, reward scheduling, or map activation; see systems/progression/objective.ts, reward*.ts, and authoredMapActivation.ts

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
