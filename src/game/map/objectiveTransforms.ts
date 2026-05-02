// @system   map-compilation/activation/floor-topology
// @owns     attach generated objective definitions to table map definitions
// @doc      docs/canonical/map_compilation_activation_floor_topology.md
// @agents   no objective runtime or reward handling; see objectiveSpec.ts and objective.ts

import type { TableMapDef } from "./formats/table/tableMapTypes";
import type { ObjectiveId } from "./objectivePlan";
import { objectiveSpecFromObjectiveId } from "./objectivePlan";
import { objectiveSpecToObjectiveDefs } from "../systems/progression/objectiveSpec";
import type { RNG } from "../util/rng";

export function applyObjective(
  baseMap: TableMapDef,
  objectiveId: ObjectiveId,
  _rng: RNG
): TableMapDef {
  const spec = objectiveSpecFromObjectiveId(objectiveId);
  const objectiveDefs = objectiveSpecToObjectiveDefs(spec);
  return {
    ...baseMap,
    objectiveDefs,
  };
}
