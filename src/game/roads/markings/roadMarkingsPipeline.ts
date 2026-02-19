import { buildRoadContext } from "./stage1_buildRoadContext";
import { generatePrimaryMarkings } from "./stage2_generatePrimaryMarkings";
import { generateFeatureMarkings } from "./stage3_generateFeatureMarkings";
import type { MarkingPiece, RoadContext, RoadMarkingInputs } from "./types";

export type RoadMarkingsPipelineResult = {
  context: RoadContext;
  markings: MarkingPiece[];
};

export function buildRoadMarkingsPipeline(inputs: RoadMarkingInputs): RoadMarkingsPipelineResult {
  const context = buildRoadContext(inputs);
  const primary = generatePrimaryMarkings(context, inputs);
  const features = generateFeatureMarkings(context, inputs);
  const markings = [...primary, ...features];
  return { context, markings };
}
