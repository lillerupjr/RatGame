import {
  STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
  buildStructureShadowContextKey,
  type StructureShadowCacheStore,
} from "../structureShadowV1";
import {
  STRUCTURE_SHADOW_V2_ALPHA_THRESHOLD,
  STRUCTURE_SHADOW_V2_MAX_LOOP_POINTS,
  STRUCTURE_SHADOW_V2_SILHOUETTE_SAMPLE_STEP,
  buildStructureShadowV2ContextKey,
  type StructureShadowV2CacheStore,
} from "../structureShadowV2AlphaSilhouette";
import {
  buildStructureShadowHybridContextKey,
  type StructureShadowHybridCacheStore,
} from "../structureShadowHybridTriangles";
import {
  buildStructureShadowV4ContextKey,
  type StructureShadowV4CacheStore,
} from "../structureShadowV4";
import { getShadowSunModel } from "../renderShadow";
import type {
  StructureShadowFrameInputs,
  StructureShadowFrameResult,
} from "./structureShadowTypes";
import { resolveStructureShadowRouting } from "./structureShadowVersionRouting";

export type StructureShadowCacheStores = {
  v1: StructureShadowCacheStore;
  v2: StructureShadowV2CacheStore;
  hybrid: StructureShadowHybridCacheStore;
  v4: StructureShadowV4CacheStore;
};

export function buildStructureShadowFrameContext(
  input: StructureShadowFrameInputs,
  cacheStores: StructureShadowCacheStores,
): StructureShadowFrameResult {
  const sunModel = getShadowSunModel(input.shadowSunTimeHour, {
    shadowSunAzimuthDeg: input.shadowSunAzimuthDeg,
    sunElevationOverrideEnabled: input.sunElevationOverrideEnabled,
    sunElevationOverrideDeg: input.sunElevationOverrideDeg,
  });
  const contextKeys = {
    v1: buildStructureShadowContextKey({
      mapId: input.mapId,
      enabled: true,
      sunStepKey: sunModel.stepKey,
      roofScanStepPx: STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
    }),
    v2: buildStructureShadowV2ContextKey({
      mapId: input.mapId,
      enabled: true,
      sunStepKey: sunModel.stepKey,
      roofScanStepPx: STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
      alphaThreshold: STRUCTURE_SHADOW_V2_ALPHA_THRESHOLD,
      silhouetteSampleStep: STRUCTURE_SHADOW_V2_SILHOUETTE_SAMPLE_STEP,
      maxLoopPoints: STRUCTURE_SHADOW_V2_MAX_LOOP_POINTS,
    }),
    hybrid: buildStructureShadowHybridContextKey({
      mapId: input.mapId,
      enabled: true,
      sunStepKey: sunModel.stepKey,
      roofScanStepPx: STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
    }),
    v4: buildStructureShadowV4ContextKey({
      mapId: input.mapId,
      enabled: true,
      sunStepKey: sunModel.stepKey,
    }),
  };

  cacheStores.v1.resetIfContextChanged(contextKeys.v1);
  cacheStores.v2.resetIfContextChanged(contextKeys.v2);
  cacheStores.hybrid.resetIfContextChanged(contextKeys.hybrid);
  cacheStores.v4.resetIfContextChanged(contextKeys.v4);

  return {
    sunModel,
    routing: resolveStructureShadowRouting(input.shadowCasterMode),
    contextKeys,
  };
}
