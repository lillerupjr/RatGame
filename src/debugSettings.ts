export type LightingMaskDebugMode = "OFF" | "SOURCE" | "INVERSE" | "COMBINED";
export type NeutralBirdForceState =
  | "NONE"
  | "IDLE"
  | "TAKEOFF"
  | "FLY_TO_TARGET"
  | "LAND";

export type NeutralBirdAIDebugSettings = {
  disabled: boolean;
  forceState: NeutralBirdForceState;
  disableTransitions: boolean;
  drawDebug: boolean;
  debugRepickTarget: boolean;
};

export type ObjectiveDebugSettings = {
  showZoneBounds: boolean;
};

export type DebugSettings = {
  grid: boolean;
  walkMask: boolean;
  blockedTiles: boolean;
  ramps: boolean;
  colliders: boolean;
  slices: boolean;
  occluders: boolean;
  decals: boolean;
  structureHeights: boolean;
  spriteBounds: boolean;
  projectileFaces: boolean;
  triggers: boolean;
  debugRoadSemantic: boolean;
  disableLightingOcclusion: boolean;
  disableLightingHeightBandedOcclusion: boolean;
  lightingUseLegacyGlobalOcclusion: boolean;
  disableLightingCompiledMaskCache: boolean;
  disableVisualCompiledCutoutCache: boolean;
  lightingMasks: boolean;
  lightingMaskDebugMode: LightingMaskDebugMode;
  mapOverlaysDisabled: boolean;
  rampFaces: boolean;
  forceSpawnOverride: boolean;
  godMode: boolean;
  dmgMult: number;
  fireRateMult: number;
  entityAnchorOverlay: boolean;
  enemyAimOverlay: boolean;
  lootGoblinOverlay: boolean;
  pauseDebugCards: boolean;
  pauseCsvControls: boolean;
  dpsMeter: boolean;
  waterFlowRate: number;
  neutralBirdAI: NeutralBirdAIDebugSettings;
  objectives: ObjectiveDebugSettings;
};

export type BooleanDebugSettingKey = Exclude<
  keyof DebugSettings,
  "lightingMaskDebugMode" | "waterFlowRate" | "dmgMult" | "fireRateMult" | "neutralBirdAI" | "objectives"
>;

export type DebugToggleDefinition = {
  key: BooleanDebugSettingKey;
  label: string;
};

export const LIGHTING_MASK_DEBUG_MODES: readonly LightingMaskDebugMode[] = [
  "OFF",
  "SOURCE",
  "INVERSE",
  "COMBINED",
] as const;

export const NEUTRAL_BIRD_FORCE_STATES: readonly NeutralBirdForceState[] = [
  "NONE",
  "IDLE",
  "TAKEOFF",
  "FLY_TO_TARGET",
  "LAND",
] as const;

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
  { key: "projectileFaces", label: "projectileFaces" },
  { key: "triggers", label: "triggers" },
  { key: "debugRoadSemantic", label: "debugRoadSemantic" },
  { key: "disableLightingOcclusion", label: "disableLightingOcclusion" },
  { key: "disableLightingHeightBandedOcclusion", label: "disableLightingHeightBandedOcclusion" },
  { key: "lightingUseLegacyGlobalOcclusion", label: "lightingUseLegacyGlobalOcclusion" },
  { key: "disableLightingCompiledMaskCache", label: "disableLightingCompiledMaskCache" },
  { key: "disableVisualCompiledCutoutCache", label: "disableVisualCompiledCutoutCache" },
  { key: "lightingMasks", label: "lightingMasks" },
  { key: "mapOverlaysDisabled", label: "mapOverlaysDisabled" },
  { key: "rampFaces", label: "rampFaces" },
  { key: "forceSpawnOverride", label: "forceSpawnOverride" },
  { key: "godMode", label: "godMode" },
  { key: "entityAnchorOverlay", label: "entityAnchorOverlay" },
  { key: "enemyAimOverlay", label: "enemyAimOverlay" },
  { key: "lootGoblinOverlay", label: "lootGoblinOverlay" },
  { key: "pauseDebugCards", label: "Enable Pause Debug Cards" },
  { key: "pauseCsvControls", label: "Enable Pause CSV Controls" },
  { key: "dpsMeter", label: "Show DPS Meter" },
] as const;

export const DEFAULT_DEBUG_SETTINGS: DebugSettings = {
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
  projectileFaces: false,
  triggers: false,
  debugRoadSemantic: false,
  disableLightingOcclusion: false,
  disableLightingHeightBandedOcclusion: false,
  lightingUseLegacyGlobalOcclusion: false,
  disableLightingCompiledMaskCache: false,
  disableVisualCompiledCutoutCache: false,
  lightingMasks: false,
  lightingMaskDebugMode: "OFF",
  mapOverlaysDisabled: false,
  rampFaces: false,
  forceSpawnOverride: false,
  godMode: false,
  dmgMult: 1,
  fireRateMult: 1,
  entityAnchorOverlay: false,
  enemyAimOverlay: false,
  lootGoblinOverlay: false,
  pauseDebugCards: false,
  pauseCsvControls: false,
  dpsMeter: false,
  waterFlowRate: 1,
  neutralBirdAI: {
    disabled: false,
    forceState: "NONE",
    disableTransitions: false,
    drawDebug: false,
    debugRepickTarget: false,
  },
  objectives: {
    showZoneBounds: false,
  },
};

export function makeAllDebugOffSettings(): DebugSettings {
  return { ...DEFAULT_DEBUG_SETTINGS };
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
  showMapOverlays: boolean;
  showEnemyAimOverlay: boolean;
  showLootGoblinOverlay: boolean;
  lightingOcclusionEnabled: boolean;
  lightingHeightBandedOcclusion: boolean;
  lightingUseLegacyGlobalOcclusion: boolean;
  lightingCompiledMaskCache: boolean;
  visualCompiledCutoutCache: boolean;
  buildingMaskDebugView: LightingMaskDebugMode;
  showBuildingMaskDebug: boolean;
};

export function resolveDebugFlags(debug: DebugSettings): ResolvedDebugFlags {
  const buildingMaskDebugView: LightingMaskDebugMode = debug.lightingMasks
    ? debug.lightingMaskDebugMode
    : "OFF";
  return {
    showGrid: debug.grid,
    showWalkMask: debug.walkMask,
    showRamps: debug.ramps || debug.rampFaces,
    showOccluders: debug.occluders,
    showDecals: debug.decals,
    showProjectileFaces: debug.projectileFaces,
    showTriggers: debug.triggers,
    showRoadSemantic: debug.debugRoadSemantic,
    showStructureHeights: debug.structureHeights,
    showStructureCollision: debug.blockedTiles || debug.colliders,
    showStructureSlices: debug.slices || debug.spriteBounds,
    showMapOverlays: !debug.mapOverlaysDisabled,
    showEnemyAimOverlay: debug.enemyAimOverlay,
    showLootGoblinOverlay: debug.lootGoblinOverlay,
    lightingOcclusionEnabled: !debug.disableLightingOcclusion,
    lightingHeightBandedOcclusion: !debug.disableLightingHeightBandedOcclusion,
    lightingUseLegacyGlobalOcclusion: debug.lightingUseLegacyGlobalOcclusion,
    lightingCompiledMaskCache: !debug.disableLightingCompiledMaskCache,
    visualCompiledCutoutCache: !debug.disableVisualCompiledCutoutCache,
    buildingMaskDebugView,
    showBuildingMaskDebug: buildingMaskDebugView !== "OFF",
  };
}
