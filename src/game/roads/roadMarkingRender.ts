import type { RuntimeDecalSetId } from "../content/runtimeDecalConfig";
import { ROAD_CENTER_MARKING_VARIANT_INDEX } from "./roadMarkings";

export function roadMarkingDecalScale(setId: RuntimeDecalSetId, variantIndex: number): number {
  if (setId !== "road_markings") return 1;
  if (variantIndex === ROAD_CENTER_MARKING_VARIANT_INDEX) return 2;
  if (variantIndex === 2) return 2; // edge line sprite
  return 1;
}

export function shouldPixelSnapRoadMarking(setId: RuntimeDecalSetId, _variantIndex: number): boolean {
  return setId === "road_markings";
}
