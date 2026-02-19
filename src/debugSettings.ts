export type LightingMaskDebugMode = "OFF" | "SOURCE" | "INVERSE" | "COMBINED";
export type NeutralBirdForceState =
  | "NONE"
  | "IDLE"
  | "TAKEOFF"
  | "FLY_TO_TARGET"
  | "LAND";

export type NeutralBirdAIDebugSettings = {
  enabled: boolean;
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
  lightingMasks: boolean;
  lightingMaskDebugMode: LightingMaskDebugMode;
  mapOverlaysDisabled: boolean;
  rampFaces: boolean;
  forceSpawnOverride: boolean;
  entityAnchorOverlay: boolean;
  waterFlowRate: number;
  neutralBirdAI: NeutralBirdAIDebugSettings;
  objectives: ObjectiveDebugSettings;
};

export type BooleanDebugSettingKey = Exclude<keyof DebugSettings, "lightingMaskDebugMode" | "waterFlowRate" | "neutralBirdAI" | "objectives">;

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
  { key: "lightingMasks", label: "lightingMasks" },
  { key: "mapOverlaysDisabled", label: "mapOverlaysDisabled" },
  { key: "rampFaces", label: "rampFaces" },
  { key: "forceSpawnOverride", label: "forceSpawnOverride" },
  { key: "entityAnchorOverlay", label: "entityAnchorOverlay" },
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
  lightingMasks: false,
  lightingMaskDebugMode: "OFF",
  mapOverlaysDisabled: false,
  rampFaces: false,
  forceSpawnOverride: false,
  entityAnchorOverlay: false,
  waterFlowRate: 1,
  neutralBirdAI: {
    enabled: false,
    forceState: "NONE",
    disableTransitions: false,
    drawDebug: true,
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
  lightingOcclusionEnabled: boolean;
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
    lightingOcclusionEnabled: !debug.disableLightingOcclusion,
    buildingMaskDebugView,
    showBuildingMaskDebug: buildingMaskDebugView !== "OFF",
  };
}
