export const AnimatedSurfaceId = {
  TOXIC_POISON_SURFACE: "toxic_poison_surface",
} as const;

export type AnimatedSurfaceId = (typeof AnimatedSurfaceId)[keyof typeof AnimatedSurfaceId];

export type AnimatedSurfaceRecipe = {
  id: AnimatedSurfaceId;
  sourceClipId: string;
  outputWidth: number;
  outputHeight: number;
  columns: number;
  rows: number;
  horizontalStepPx: number;
  verticalStepPx: number;
  alternatingRowOffsetPx: number;
  instanceScale: number;
  instanceRotationDeg?: number;
  warningAlpha?: number;
  activeAlpha?: number;
};

export type AnimatedSurfaceAsset = {
  id: AnimatedSurfaceId;
  fps: number;
  loop: boolean;
  frameCount: number;
  projectedFrames: HTMLCanvasElement[];
  warningAlpha: number;
  activeAlpha: number;
};
