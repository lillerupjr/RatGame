import { getShadowSunModel } from "../renderShadow";
import type {
  StructureShadowFrameInputs,
  StructureShadowFrameResult,
} from "./structureShadowTypes";
import { resolveStructureShadowRouting } from "./structureShadowVersionRouting";

export function buildStructureShadowFrameContext(
  input: StructureShadowFrameInputs,
): StructureShadowFrameResult {
  const sunModel = getShadowSunModel(input.shadowSunTimeHour, {
    shadowSunAzimuthDeg: input.shadowSunAzimuthDeg,
    sunElevationOverrideEnabled: input.sunElevationOverrideEnabled,
    sunElevationOverrideDeg: input.sunElevationOverrideDeg,
  });

  return {
    sunModel,
    routing: resolveStructureShadowRouting(input.shadowCasterMode),
  };
}
