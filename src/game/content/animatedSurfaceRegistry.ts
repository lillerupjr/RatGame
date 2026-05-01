import {
  AnimatedSurfaceId,
  type AnimatedSurfaceId as AnimatedSurfaceIdType,
  type AnimatedSurfaceRecipe,
} from "../systems/presentation/animatedSurfaces/animatedSurfaceTypes";

export { AnimatedSurfaceId } from "../systems/presentation/animatedSurfaces/animatedSurfaceTypes";

export const ANIMATED_SURFACE_RECIPES: Record<AnimatedSurfaceIdType, AnimatedSurfaceRecipe> = {
  [AnimatedSurfaceId.TOXIC_POISON_SURFACE]: {
    id: AnimatedSurfaceId.TOXIC_POISON_SURFACE,
    sourceClipId: "SLIME_IDLE_LOOP",
    outputWidth: 128,
    outputHeight: 128,
    columns: 6,
    rows: 12,
    horizontalStepPx: 24,
    verticalStepPx: 16,
    alternatingRowOffsetPx: 16,
    instanceScale: 2,
    instanceRotationDeg: -45,
    warningAlpha: 0.4,
    activeAlpha: 1,
  },
};
