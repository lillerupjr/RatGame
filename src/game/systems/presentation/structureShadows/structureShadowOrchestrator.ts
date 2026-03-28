export type BuildStructureShadowFrameResultInput = {
  structureShadowBand: number;
};

export type StructureShadowOverlayQueueResult = {
  structureShadowBand: number;
};

export function buildStructureShadowFrameResult(
  input: BuildStructureShadowFrameResultInput,
): StructureShadowOverlayQueueResult {
  return {
    structureShadowBand: input.structureShadowBand,
  };
}
