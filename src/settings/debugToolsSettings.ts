import type {
  DebugToolsSettings,
  ShadowCasterMode,
  ShadowDebugMode,
  ShadowHybridDiagnosticMode,
  ShadowV6SemanticBucket,
  ShadowV5DebugView,
  ShadowV5TransformDebugMode,
  ShadowV1DebugGeometryMode,
} from "./settingsTypes";
import {
  DEFAULT_SHADOW_SUN_V1_ELEVATION_OVERRIDE_DEG,
  DEFAULT_SHADOW_SUN_V1_TIME_HOUR,
  clampShadowSunElevationOverrideDeg,
  clampShadowSunTimeHour,
} from "../shadowSunV1";
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
  shadowSunTimeHour: DEFAULT_SHADOW_SUN_V1_TIME_HOUR,
  sunElevationOverrideEnabled: false,
  sunElevationOverrideDeg: DEFAULT_SHADOW_SUN_V1_ELEVATION_OVERRIDE_DEG,
  shadowV1DebugGeometryMode: "full",
  shadowCasterMode: "v1Roof",
  shadowHybridDiagnosticMode: "off",
  shadowDebugMode: "warpedOnly",
  shadowV5DebugView: "finalOnly",
  shadowV5TransformDebugMode: "deformed",
  shadowV6SemanticBucket: "EAST_WEST",
  shadowV6StructureIndex: STRUCTURE_SHADOW_V6_DEFAULT_STRUCTURE_INDEX,
  shadowV6SliceCount: STRUCTURE_SHADOW_V6_DEFAULT_SLICE_COUNT,
  shadowV6AllStructures: true,
  shadowV6OneStructureOnly: false,
  shadowV6VerticalOnly: false,
  shadowV6TopOnly: false,
  shadowV6ForceRefresh: false,
  shadowV6FaceSliceDebugOverlay: false,
};

function normalizeShadowV1DebugGeometryMode(value: unknown): ShadowV1DebugGeometryMode {
  if (value === "capOnly" || value === "connectorsOnly") return value;
  return "full";
}

function normalizeShadowCasterMode(value: unknown): ShadowCasterMode {
  if (value === "v1Roof") return "v1Roof";
  if (value === "v2AlphaSilhouette") return "v2AlphaSilhouette";
  if (value === "v3HybridTriangles") return "v3HybridTriangles";
  if (value === "v4SliceStrips") return "v4SliceStrips";
  if (value === "v5TriangleShadowMask") return "v5TriangleShadowMask";
  if (value === "v6FaceSliceDebug") return "v6FaceSliceDebug";
  return "v1Roof";
}

function normalizeShadowHybridDiagnosticMode(value: unknown): ShadowHybridDiagnosticMode {
  if (value === "solidShadowPass") return "solidShadowPass";
  if (value === "solidMainCanvas") return "solidMainCanvas";
  return "off";
}

function normalizeShadowDebugMode(value: unknown): ShadowDebugMode {
  if (value === "flatOnly") return "flatOnly";
  if (value === "both") return "both";
  return "warpedOnly";
}

function normalizeShadowV5DebugView(value: unknown): ShadowV5DebugView {
  if (value === "topMask") return "topMask";
  if (value === "eastWestMask") return "eastWestMask";
  if (value === "southNorthMask") return "southNorthMask";
  if (value === "all") return "all";
  return "finalOnly";
}

function normalizeShadowV5TransformDebugMode(value: unknown): ShadowV5TransformDebugMode {
  if (value === "raw") return "raw";
  return "deformed";
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
    shadowSunTimeHour: clampShadowSunTimeHour(merged.shadowSunTimeHour),
    sunElevationOverrideEnabled: !!merged.sunElevationOverrideEnabled,
    sunElevationOverrideDeg: clampShadowSunElevationOverrideDeg(merged.sunElevationOverrideDeg),
    shadowV1DebugGeometryMode: normalizeShadowV1DebugGeometryMode(merged.shadowV1DebugGeometryMode),
    shadowCasterMode: normalizeShadowCasterMode(merged.shadowCasterMode),
    shadowHybridDiagnosticMode: normalizeShadowHybridDiagnosticMode(merged.shadowHybridDiagnosticMode),
    shadowDebugMode: normalizeShadowDebugMode(merged.shadowDebugMode),
    shadowV5DebugView: normalizeShadowV5DebugView(merged.shadowV5DebugView),
    shadowV5TransformDebugMode: normalizeShadowV5TransformDebugMode(merged.shadowV5TransformDebugMode),
    shadowV6SemanticBucket: normalizeShadowV6SemanticBucket(merged.shadowV6SemanticBucket),
    shadowV6StructureIndex: clampStructureV6StructureIndex(merged.shadowV6StructureIndex),
    shadowV6SliceCount: clampStructureV6SliceCount(merged.shadowV6SliceCount),
    shadowV6AllStructures: !!merged.shadowV6AllStructures,
    shadowV6OneStructureOnly: !!merged.shadowV6OneStructureOnly,
    shadowV6VerticalOnly: !!merged.shadowV6VerticalOnly,
    shadowV6TopOnly: !!merged.shadowV6TopOnly,
    shadowV6ForceRefresh: !!merged.shadowV6ForceRefresh,
    shadowV6FaceSliceDebugOverlay: !!merged.shadowV6FaceSliceDebugOverlay,
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
  };
}
