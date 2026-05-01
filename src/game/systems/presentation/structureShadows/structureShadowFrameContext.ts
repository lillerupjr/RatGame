import { buildShadowSunV1StepKeySuffix, getShadowSunV1LightingState } from "../../../../shadowSunV1";
import type {
  StructureShadowFrameInputs,
  StructureShadowFrameResult,
} from "./structureShadowTypes";
import { resolveStructureShadowRouting } from "./structureShadowVersionRouting";

export function buildStructureShadowFrameContext(
  input: StructureShadowFrameInputs,
): StructureShadowFrameResult {
  const lightingState = getShadowSunV1LightingState(input.shadowSunTimeHour, {
    shadowSunAzimuthDeg: input.shadowSunAzimuthDeg,
    sunElevationOverrideEnabled: input.sunElevationOverrideEnabled,
    sunElevationOverrideDeg: input.sunElevationOverrideDeg,
  });
  const sunModel = lightingState.sunModel;
  if (input.shadowSunStepKeyOverride) {
    sunModel.stepKey = `${input.shadowSunStepKeyOverride}${buildShadowSunV1StepKeySuffix({
      sunElevationOverrideEnabled: input.sunElevationOverrideEnabled,
      sunElevationResolvedDeg: sunModel.elevationDeg,
      shadowSunAzimuthDeg: input.shadowSunAzimuthDeg,
    })}`;
  }

  return {
    sunModel,
    ambientSunLighting: lightingState.ambientSunLighting,
    routing: resolveStructureShadowRouting(),
  };
}
