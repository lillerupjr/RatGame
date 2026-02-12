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
