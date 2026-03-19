import type {
  DebugToolsSettings,
  ShadowCasterMode,
  ShadowHybridDiagnosticMode,
  ShadowV1DebugGeometryMode,
} from "./settingsTypes";
import { DEFAULT_SHADOW_SUN_V1_TIME_HOUR, clampShadowSunTimeHour } from "../shadowSunV1";

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
  { key: "structureTriangleFootprint", label: "structureTriangleFootprint" },
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
  structureTriangleFootprint: false,
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
  shadowV1DebugGeometryMode: "full",
  shadowCasterMode: "v3HybridTriangles",
  shadowHybridDiagnosticMode: "off",
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
  return "v3HybridTriangles";
}

function normalizeShadowHybridDiagnosticMode(value: unknown): ShadowHybridDiagnosticMode {
  if (value === "solidShadowPass") return "solidShadowPass";
  if (value === "solidMainCanvas") return "solidMainCanvas";
  return "off";
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
    structureTriangleFootprint: !!merged.structureTriangleFootprint,
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
    shadowV1DebugGeometryMode: normalizeShadowV1DebugGeometryMode(merged.shadowV1DebugGeometryMode),
    shadowCasterMode: normalizeShadowCasterMode(merged.shadowCasterMode),
    shadowHybridDiagnosticMode: normalizeShadowHybridDiagnosticMode(merged.shadowHybridDiagnosticMode),
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
    showStructureSlices: args.debug.slices || args.debug.spriteBounds,
    showStructureTriangleFootprint: args.debug.structureTriangleFootprint,
    showMapOverlays: !args.mapOverlaysDisabled,
    showEnemyAimOverlay: args.debug.enemyAimOverlay,
    showLootGoblinOverlay: args.debug.lootGoblinOverlay,
    visualCompiledCutoutCache: !args.disableVisualCompiledCutoutCache,
  };
}
