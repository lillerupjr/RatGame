import {
  NEUTRAL_BIRD_FORCE_STATES,
  normalizePaletteRemapWeightPercent,
  normalizeStaticRelightTargetDarknessPercent,
} from "./settings/systemOverrides";
import { DEFAULT_SETTINGS, type DebugSettings } from "./userSettings";

export type {
  DebugSettings,
  NeutralBirdAIDebugSettings,
  UserSettings,
} from "./userSettings";

export type NeutralBirdForceState = (typeof NEUTRAL_BIRD_FORCE_STATES)[number];
export type ObjectiveDebugSettings = { showZoneBounds: boolean };

export {
  NEUTRAL_BIRD_FORCE_STATES,
  normalizePaletteRemapWeightPercent,
  normalizeStaticRelightTargetDarknessPercent,
};

export const PALETTE_REMAP_WEIGHT_OPTIONS = [0, 25, 50, 75, 100] as const;
export type PaletteRemapWeightPercent = (typeof PALETTE_REMAP_WEIGHT_OPTIONS)[number];
export const STATIC_RELIGHT_TARGET_DARKNESS_OPTIONS = [0, 25, 50, 75] as const;
export type StaticRelightTargetDarknessPercent = (typeof STATIC_RELIGHT_TARGET_DARKNESS_OPTIONS)[number];

export type BooleanDebugSettingKey = Exclude<
  keyof DebugSettings,
  | "waterFlowRate"
  | "dmgMult"
  | "fireRateMult"
  | "paletteSWeightPercent"
  | "paletteDarknessPercent"
  | "staticRelightStrengthPercent"
  | "staticRelightTargetDarknessPercent"
  | "shadowSunTimeHour"
  | "shadowV1DebugGeometryMode"
  | "shadowCasterMode"
  | "neutralBirdAI"
  | "objectives"
>;

export type DebugToggleDefinition = {
  key: BooleanDebugSettingKey;
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
  { key: "disableVisualCompiledCutoutCache", label: "disableVisualCompiledCutoutCache" },
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
  ...DEFAULT_SETTINGS.debug,
};

export function makeAllDebugOffSettings(): DebugSettings {
  return {
    ...DEFAULT_DEBUG_SETTINGS,
    disableVisualCompiledCutoutCache: false,
    mapOverlaysDisabled: false,
    rampFaces: false,
    forceSpawnOverride: false,
    godMode: false,
    dmgMult: 1,
    fireRateMult: 1,
    paletteSWeightPercent: 0,
    paletteDarknessPercent: 0,
    staticRelightStrengthPercent: 0,
    staticRelightTargetDarknessPercent: 50,
    shadowSunTimeHour: DEFAULT_DEBUG_SETTINGS.shadowSunTimeHour,
    shadowV1DebugGeometryMode: DEFAULT_DEBUG_SETTINGS.shadowV1DebugGeometryMode,
    shadowCasterMode: DEFAULT_DEBUG_SETTINGS.shadowCasterMode,
    waterFlowRate: 1,
    neutralBirdAI: {
      ...DEFAULT_DEBUG_SETTINGS.neutralBirdAI,
      disabled: false,
      forceState: "NONE",
      disableTransitions: false,
      drawDebug: false,
      debugRepickTarget: false,
    },
    objectives: { showZoneBounds: false },
  };
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

export function resolveDebugFlags(debug: DebugSettings): ResolvedDebugFlags {
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
    showStructureTriangleFootprint: debug.structureTriangleFootprint,
    showMapOverlays: !debug.mapOverlaysDisabled,
    showEnemyAimOverlay: debug.enemyAimOverlay,
    showLootGoblinOverlay: debug.lootGoblinOverlay,
    visualCompiledCutoutCache: !debug.disableVisualCompiledCutoutCache,
  };
}
