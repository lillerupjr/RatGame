import { resolveDebugFlags } from "../../../../debugSettings";
import type { DebugSettings } from "../../../../userSettings";
import type { RenderDebugFlags } from "./debugRenderTypes";

export function resolveRenderDebugFlags(debug: DebugSettings): RenderDebugFlags {
  const baseFlags = resolveDebugFlags(debug);
  return {
    showGrid: baseFlags.showGrid,
    showEntityAnchorOverlay: debug.entityAnchorOverlay,
    showWalkMask: baseFlags.showWalkMask,
    showRamps: baseFlags.showRamps,
    showOccluders: baseFlags.showOccluders,
    showDecals: baseFlags.showDecals,
    showProjectileFaces: baseFlags.showProjectileFaces,
    showTriggers: baseFlags.showTriggers,
    showRoadSemantic: baseFlags.showRoadSemantic,
    showStructureHeights: baseFlags.showStructureHeights,
    showStructureCollision: baseFlags.showStructureCollision,
    showStructureSlices: baseFlags.showStructureSlices,
    showStructureTriangleFootprint: baseFlags.showStructureTriangleFootprint,
    showStructureAnchors: baseFlags.showStructureAnchors,
    showStructureTriangleOwnershipSort: baseFlags.showStructureTriangleOwnershipSort,
    perfOverlayMode: debug.perfOverlayMode,
    showEnemyAimOverlay: baseFlags.showEnemyAimOverlay,
    showLootGoblinOverlay: baseFlags.showLootGoblinOverlay,
    showMapOverlays: baseFlags.showMapOverlays,
    showZoneObjectiveBounds: !!debug.objectives?.showZoneBounds,
    showTileHeightMap: baseFlags.showTileHeightMap,
    shadowSunTimeHour: debug.shadowSunTimeHour,
    shadowSunAzimuthDeg: debug.shadowSunAzimuthDeg,
    sunElevationOverrideEnabled: debug.sunElevationOverrideEnabled,
    sunElevationOverrideDeg: debug.sunElevationOverrideDeg,
    heightmapShadowDebugShowHeightBuffer: debug.heightmapShadowDebugShowHeightBuffer ?? false,
    heightmapShadowResolutionDivisor: debug.heightmapShadowResolutionDivisor ?? 2,
    heightmapShadowStepSize: debug.heightmapShadowStepSize ?? 2,
    heightmapShadowMaxSteps: debug.heightmapShadowMaxSteps ?? 128,
    heightmapShadowIntensity: debug.heightmapShadowIntensity ?? 0.45,
  };
}
