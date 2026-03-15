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

export const PALETTE_REMAP_WEIGHT_OPTIONS = [0, 25, 50, 75, 100] as const;
export type PaletteRemapWeightPercent = (typeof PALETTE_REMAP_WEIGHT_OPTIONS)[number];
export const STATIC_RELIGHT_TARGET_DARKNESS_OPTIONS = [0, 25, 50, 75] as const;
export type StaticRelightTargetDarknessPercent = (typeof STATIC_RELIGHT_TARGET_DARKNESS_OPTIONS)[number];

export function normalizePaletteRemapWeightPercent(value: unknown): PaletteRemapWeightPercent {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;

  let nearest: PaletteRemapWeightPercent = PALETTE_REMAP_WEIGHT_OPTIONS[0];
  let nearestDist = Math.abs(numeric - nearest);
  for (let i = 1; i < PALETTE_REMAP_WEIGHT_OPTIONS.length; i++) {
    const candidate = PALETTE_REMAP_WEIGHT_OPTIONS[i];
    const dist = Math.abs(numeric - candidate);
    if (dist < nearestDist) {
      nearest = candidate;
      nearestDist = dist;
    }
  }
  return nearest;
}

export function normalizeStaticRelightTargetDarknessPercent(
  value: unknown,
): StaticRelightTargetDarknessPercent {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;

  let nearest: StaticRelightTargetDarknessPercent = STATIC_RELIGHT_TARGET_DARKNESS_OPTIONS[0];
  let nearestDist = Math.abs(numeric - nearest);
  for (let i = 1; i < STATIC_RELIGHT_TARGET_DARKNESS_OPTIONS.length; i++) {
    const candidate = STATIC_RELIGHT_TARGET_DARKNESS_OPTIONS[i];
    const dist = Math.abs(numeric - candidate);
    if (dist < nearestDist) {
      nearest = candidate;
      nearestDist = dist;
    }
  }
  return nearest;
}

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
  disableVisualCompiledCutoutCache: boolean;
  mapOverlaysDisabled: boolean;
  rampFaces: boolean;
  forceSpawnOverride: boolean;
  godMode: boolean;
  dmgMult: number;
  fireRateMult: number;
  paletteSWeightPercent: PaletteRemapWeightPercent;
  paletteDarknessPercent: PaletteRemapWeightPercent;
  staticRelightStrengthPercent: PaletteRemapWeightPercent;
  staticRelightTargetDarknessPercent: StaticRelightTargetDarknessPercent;
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
  | "waterFlowRate"
  | "dmgMult"
  | "fireRateMult"
  | "paletteSWeightPercent"
  | "paletteDarknessPercent"
  | "staticRelightStrengthPercent"
  | "staticRelightTargetDarknessPercent"
  | "neutralBirdAI"
  | "objectives"
>;

export type DebugToggleDefinition = {
  key: BooleanDebugSettingKey;
  label: string;
};

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
  disableVisualCompiledCutoutCache: false,
  mapOverlaysDisabled: false,
  rampFaces: false,
  forceSpawnOverride: false,
  godMode: false,
  dmgMult: 1,
  fireRateMult: 1,
  paletteSWeightPercent: 0,
  paletteDarknessPercent: 0,
  staticRelightStrengthPercent: 100,
  staticRelightTargetDarknessPercent: 50,
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
    showMapOverlays: !debug.mapOverlaysDisabled,
    showEnemyAimOverlay: debug.enemyAimOverlay,
    showLootGoblinOverlay: debug.lootGoblinOverlay,
    visualCompiledCutoutCache: !debug.disableVisualCompiledCutoutCache,
  };
}
