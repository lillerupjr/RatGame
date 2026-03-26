import type {
  DebugToolsSettings,
  ShadowCasterMode,
  ShadowV6SemanticBucket,
} from "./settingsTypes";
import {
  DEFAULT_SHADOW_SUN_V1_ELEVATION_OVERRIDE_DEG,
  DEFAULT_SHADOW_SUN_V1_TIME_HOUR,
  clampShadowSunElevationOverrideDeg,
  clampShadowSunTimeHour,
} from "../shadowSunV1";
import {
  DEFAULT_SHADOW_SUN_CYCLE_MODE,
  DEFAULT_SHADOW_SUN_DAY_CYCLE_SPEED_MULTIPLIER,
  DEFAULT_SHADOW_SUN_DAY_CYCLE_STEPS_PER_DAY,
  clampShadowSunCycleMode,
  clampShadowSunDayCycleSpeedMultiplier,
  clampShadowSunDayCycleStepsPerDay,
} from "../shadowSunDayCycle";
import {
  clampStaticLightCycleOverride,
} from "../staticLightCycle";
import {
  STRUCTURE_SHADOW_V6_DEFAULT_SLICE_COUNT,
  STRUCTURE_SHADOW_V6_DEFAULT_STRUCTURE_INDEX,
  clampStructureV6SliceCount,
  clampStructureV6StructureIndex,
  normalizeStructureV6SemanticBucket,
} from "../game/systems/presentation/structureShadowV6FaceSlices";

export type DebugToggleDefinition = {
  key: keyof DebugToolsSettings;
  label: string;
};

export const DEBUG_TOGGLE_DEFINITIONS: readonly DebugToggleDefinition[] = [
  { key: "grid", label: "grid" },
  { key: "walkMask", label: "walkMask" },
  { key: "blockedTiles", label: "blockedTiles" },
  { key: "ramps", label: "ramps" },
  { key: "colliders", label: "colliders" },
  { key: "slices", label: "slices" },
  { key: "occluders", label: "occluders" },
  { key: "decals", label: "decals" },
  { key: "structureHeights", label: "structureHeights" },
  { key: "spriteBounds", label: "spriteBounds" },
  { key: "showStructureSlices", label: "showStructureSlices" },
  { key: "structureTriangleFootprint", label: "structureSemanticFaces" },
  { key: "showStructureAnchors", label: "showStructureAnchors" },
  { key: "showStructureTriangleOwnershipSort", label: "showStructureTriangleOwnershipSort" },
  { key: "projectileFaces", label: "projectileFaces" },
  { key: "triggers", label: "triggers" },
  { key: "debugRoadSemantic", label: "debugRoadSemantic" },
  { key: "entityAnchorOverlay", label: "entityAnchorOverlay" },
  { key: "enemyAimOverlay", label: "enemyAimOverlay" },
  { key: "lootGoblinOverlay", label: "lootGoblinOverlay" },
  { key: "pauseDebugCards", label: "Enable Pause Debug Cards" },
  { key: "pauseCsvControls", label: "Enable Pause CSV Controls" },
  { key: "dpsMeter", label: "Show DPS Meter" },
  { key: "neutralBirdDrawDebug", label: "neutralBirdDrawDebug" },
  { key: "objectivesShowZoneBounds", label: "objectivesShowZoneBounds" },
  { key: "entityAnchorsEnabled", label: "entityAnchorsEnabled" },
  { key: "renderPerfCountersEnabled", label: "renderPerfCountersEnabled" },
  { key: "paletteHudDebugOverlayEnabled", label: "paletteHudDebugOverlayEnabled" },
  { key: "shadowSunDayCycleEnabled", label: "shadowSunDayCycleEnabled" },
  { key: "sweepShadowDebug", label: "sweepShadowDebug" },
  { key: "tileHeightMap", label: "tileHeightMap" },
] as const;

export const DEFAULT_DEBUG_TOOLS_SETTINGS: DebugToolsSettings = {
  grid: false,
  walkMask: false,
  blockedTiles: false,
  ramps: false,
  colliders: false,
  slices: false,
  occluders: false,
  decals: false,
  structureHeights: false,
  spriteBounds: false,
  showStructureSlices: false,
  structureTriangleFootprint: false,
  showStructureAnchors: false,
  showStructureTriangleOwnershipSort: false,
  projectileFaces: false,
  triggers: false,
  debugRoadSemantic: false,
  entityAnchorOverlay: false,
  enemyAimOverlay: false,
  lootGoblinOverlay: false,
  pauseDebugCards: false,
  pauseCsvControls: false,
  dpsMeter: false,
  neutralBirdDrawDebug: false,
  objectivesShowZoneBounds: false,
  entityAnchorsEnabled: false,
  renderPerfCountersEnabled: false,
  paletteHudDebugOverlayEnabled: false,
  shadowSunTimeHour: 17,
  shadowSunDayCycleEnabled: true,
  shadowSunCycleMode: DEFAULT_SHADOW_SUN_CYCLE_MODE,
  shadowSunDayCycleSpeedMultiplier: DEFAULT_SHADOW_SUN_DAY_CYCLE_SPEED_MULTIPLIER,
  shadowSunStepsPerDay: 144,
  staticLightCycleOverride: "automatic",
  shadowSunAzimuthDeg: -1,
  sunElevationOverrideEnabled: false,
  sunElevationOverrideDeg: 45,
  shadowCasterMode: "v6SweepShadow",
  shadowV6SemanticBucket: "EAST_WEST",
  shadowV6StructureIndex: STRUCTURE_SHADOW_V6_DEFAULT_STRUCTURE_INDEX,
  shadowV6SliceCount: STRUCTURE_SHADOW_V6_DEFAULT_SLICE_COUNT,
  shadowV6AllStructures: true,
  shadowV6OneStructureOnly: false,
  shadowV6VerticalOnly: false,
  shadowV6TopOnly: false,
  shadowV6ForceRefresh: false,
  shadowV6FaceSliceDebugOverlay: false,
  sweepShadowDebug: false,
  tileHeightMap: false,
};

function clampShadowSunAzimuthDeg(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return -1;
  if (numeric < 0) return -1;
  return Math.round(numeric) % 360;
}

function sanitizeShadowSunTimeHourSetting(value: unknown): number {
  const numeric = Number(value);
  return clampShadowSunTimeHour(Number.isFinite(numeric) ? Math.round(numeric) : numeric);
}

function normalizeShadowCasterMode(value: unknown): ShadowCasterMode {
  if (value === "v6SweepShadow") return "v6SweepShadow";
  if (value === "v6FaceSliceDebug") return "v6FaceSliceDebug";
  return "v6SweepShadow";
}

function normalizeShadowV6SemanticBucket(value: unknown): ShadowV6SemanticBucket {
  return normalizeStructureV6SemanticBucket(value);
}

export type DebugToolsSettingsPatch = Partial<DebugToolsSettings>;

export function sanitizeDebugToolsSettings(input: Partial<DebugToolsSettings> | undefined): DebugToolsSettings {
  const merged: DebugToolsSettings = {
    ...DEFAULT_DEBUG_TOOLS_SETTINGS,
    ...(input ?? {}),
  };

  return {
    grid: !!merged.grid,
    walkMask: !!merged.walkMask,
    blockedTiles: !!merged.blockedTiles,
    ramps: !!merged.ramps,
    colliders: !!merged.colliders,
    slices: !!merged.slices,
    occluders: !!merged.occluders,
    decals: !!merged.decals,
    structureHeights: !!merged.structureHeights,
    spriteBounds: !!merged.spriteBounds,
    showStructureSlices: !!merged.showStructureSlices,
    structureTriangleFootprint: !!merged.structureTriangleFootprint,
    showStructureAnchors: !!merged.showStructureAnchors,
    showStructureTriangleOwnershipSort: !!merged.showStructureTriangleOwnershipSort,
    projectileFaces: !!merged.projectileFaces,
    triggers: !!merged.triggers,
    debugRoadSemantic: !!merged.debugRoadSemantic,
    entityAnchorOverlay: !!merged.entityAnchorOverlay,
    enemyAimOverlay: !!merged.enemyAimOverlay,
    lootGoblinOverlay: !!merged.lootGoblinOverlay,
    pauseDebugCards: !!merged.pauseDebugCards,
    pauseCsvControls: !!merged.pauseCsvControls,
    dpsMeter: !!merged.dpsMeter,
    neutralBirdDrawDebug: !!merged.neutralBirdDrawDebug,
    objectivesShowZoneBounds: !!merged.objectivesShowZoneBounds,
    entityAnchorsEnabled: !!merged.entityAnchorsEnabled,
    renderPerfCountersEnabled: !!merged.renderPerfCountersEnabled,
    paletteHudDebugOverlayEnabled: !!merged.paletteHudDebugOverlayEnabled,
    shadowSunTimeHour: sanitizeShadowSunTimeHourSetting(merged.shadowSunTimeHour),
    shadowSunDayCycleEnabled: !!merged.shadowSunDayCycleEnabled,
    shadowSunCycleMode: clampShadowSunCycleMode(merged.shadowSunCycleMode),
    shadowSunDayCycleSpeedMultiplier: clampShadowSunDayCycleSpeedMultiplier(merged.shadowSunDayCycleSpeedMultiplier),
    shadowSunStepsPerDay: clampShadowSunDayCycleStepsPerDay(merged.shadowSunStepsPerDay),
    staticLightCycleOverride: clampStaticLightCycleOverride(merged.staticLightCycleOverride),
    shadowSunAzimuthDeg: clampShadowSunAzimuthDeg(merged.shadowSunAzimuthDeg),
    sunElevationOverrideEnabled: !!merged.sunElevationOverrideEnabled,
    sunElevationOverrideDeg: clampShadowSunElevationOverrideDeg(merged.sunElevationOverrideDeg),
    shadowCasterMode: normalizeShadowCasterMode(merged.shadowCasterMode),
    shadowV6SemanticBucket: normalizeShadowV6SemanticBucket(merged.shadowV6SemanticBucket),
    shadowV6StructureIndex: clampStructureV6StructureIndex(merged.shadowV6StructureIndex),
    shadowV6SliceCount: clampStructureV6SliceCount(merged.shadowV6SliceCount),
    shadowV6AllStructures: !!merged.shadowV6AllStructures,
    shadowV6OneStructureOnly: !!merged.shadowV6OneStructureOnly,
    shadowV6VerticalOnly: !!merged.shadowV6VerticalOnly,
    shadowV6TopOnly: !!merged.shadowV6TopOnly,
    shadowV6ForceRefresh: !!merged.shadowV6ForceRefresh,
    shadowV6FaceSliceDebugOverlay: !!merged.shadowV6FaceSliceDebugOverlay,
    sweepShadowDebug: !!merged.sweepShadowDebug,
    tileHeightMap: !!merged.tileHeightMap,
  };
}

export function patchDebugToolsSettings(
  base: DebugToolsSettings,
  patch: DebugToolsSettingsPatch,
): DebugToolsSettings {
  return sanitizeDebugToolsSettings({
    ...base,
    ...patch,
  });
}

export type ResolvedDebugFlags = {
  showGrid: boolean;
  showWalkMask: boolean;
  showRamps: boolean;
  showOccluders: boolean;
  showProjectileFaces: boolean;
  showDecals: boolean;
  showTriggers: boolean;
  showRoadSemantic: boolean;
  showStructureHeights: boolean;
  showStructureCollision: boolean;
  showStructureSlices: boolean;
  showStructureTriangleFootprint: boolean;
  showStructureAnchors: boolean;
  showStructureTriangleOwnershipSort: boolean;
  showMapOverlays: boolean;
  showEnemyAimOverlay: boolean;
  showLootGoblinOverlay: boolean;
  visualCompiledCutoutCache: boolean;
  showSweepShadowDebug: boolean;
  showTileHeightMap: boolean;
};

export function resolveDebugFlags(args: {
  debug: DebugToolsSettings;
  mapOverlaysDisabled: boolean;
  disableVisualCompiledCutoutCache: boolean;
  rampFaces: boolean;
}): ResolvedDebugFlags {
  return {
    showGrid: args.debug.grid,
    showWalkMask: args.debug.walkMask,
    showRamps: args.debug.ramps || args.rampFaces,
    showOccluders: args.debug.occluders,
    showDecals: args.debug.decals,
    showProjectileFaces: args.debug.projectileFaces,
    showTriggers: args.debug.triggers,
    showRoadSemantic: args.debug.debugRoadSemantic,
    showStructureHeights: args.debug.structureHeights,
    showStructureCollision: args.debug.blockedTiles || args.debug.colliders,
    showStructureSlices: args.debug.showStructureSlices,
    showStructureTriangleFootprint: args.debug.structureTriangleFootprint,
    showStructureAnchors: args.debug.showStructureAnchors,
    showStructureTriangleOwnershipSort: args.debug.showStructureTriangleOwnershipSort,
    showMapOverlays: !args.mapOverlaysDisabled,
    showEnemyAimOverlay: args.debug.enemyAimOverlay,
    showLootGoblinOverlay: args.debug.lootGoblinOverlay,
    visualCompiledCutoutCache: !args.disableVisualCompiledCutoutCache,
    showSweepShadowDebug: args.debug.sweepShadowDebug,
    showTileHeightMap: args.debug.tileHeightMap,
  };
}
