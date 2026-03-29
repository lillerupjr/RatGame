import type { PaletteGroup } from "../engine/render/palette/palettes";

export type VerticalTilesMode = "auto" | "manual";
export type VerticalTilesViewportClass = "phone" | "desktop";
export type LightColorModeOverride = "authored" | "off" | "standard" | "palette";
export type LightStrengthOverride = "authored" | "low" | "medium" | "high";
export type StructureTriangleAdmissionMode = "viewport" | "renderDistance" | "hybrid" | "compare";
export type ShadowCasterMode =
  | "v6SweepShadow"
  | "v6FaceSliceDebug";
export type ShadowV6SemanticBucket = "TOP" | "EAST_WEST" | "SOUTH_NORTH";

export type NeutralBirdForceState =
  | "NONE"
  | "IDLE"
  | "TAKEOFF"
  | "FLY_TO_TARGET"
  | "LAND";

export const PALETTE_REMAP_WEIGHT_OPTIONS = [0, 25, 50, 75, 100] as const;
export type PaletteRemapWeightPercent = (typeof PALETTE_REMAP_WEIGHT_OPTIONS)[number];

export const STATIC_RELIGHT_TARGET_DARKNESS_OPTIONS = [0, 25, 50, 75] as const;
export type StaticRelightTargetDarknessPercent = (typeof STATIC_RELIGHT_TARGET_DARKNESS_OPTIONS)[number];

export type UserSettings = {
  game: {
    userModeEnabled: boolean;
    healthOrbSide: "left" | "right";
  };
  audio: {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    musicMuted: boolean;
    sfxMuted: boolean;
  };
  graphics: {
    performanceMode: boolean;
    deathSlowdownEnabled: boolean;
    cameraSmoothingEnabled: boolean;
    verticalTilesMode: VerticalTilesMode;
    verticalTilesUser: number;
    verticalTilesAutoPhone: number;
    verticalTilesAutoDesktop: number;
  };
};

export type DebugToolsSettings = {
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
  showStructureSlices: boolean;
  structureTriangleFootprint: boolean;
  showStructureAnchors: boolean;
  showStructureTriangleOwnershipSort: boolean;
  projectileFaces: boolean;
  triggers: boolean;
  debugRoadSemantic: boolean;
  entityAnchorOverlay: boolean;
  enemyAimOverlay: boolean;
  lootGoblinOverlay: boolean;
  pauseDebugCards: boolean;
  pauseCsvControls: boolean;
  dpsMeter: boolean;
  neutralBirdDrawDebug: boolean;
  objectivesShowZoneBounds: boolean;
  entityAnchorsEnabled: boolean;
  renderPerfCountersEnabled: boolean;
  paletteHudDebugOverlayEnabled: boolean;
  shadowSunTimeHour: number;
  shadowSunAzimuthDeg: number;
  sunElevationOverrideEnabled: boolean;
  sunElevationOverrideDeg: number;
  shadowCasterMode: ShadowCasterMode;
  shadowV6SemanticBucket: ShadowV6SemanticBucket;
  shadowV6StructureIndex: number;
  shadowV6SliceCount: number;
  shadowV6AllStructures: boolean;
  shadowV6OneStructureOnly: boolean;
  shadowV6VerticalOnly: boolean;
  shadowV6TopOnly: boolean;
  shadowV6ForceRefresh: boolean;
  shadowV6FaceSliceDebugOverlay: boolean;
  sweepShadowDebug: boolean;
  tileHeightMap: boolean;
};

export type SystemOverrides = {
  gameSpeed: number;
  forceSpawnOverride: boolean;
  godMode: boolean;
  dmgMult: number;
  fireRateMult: number;
  xpLevelBase: number;
  xpLevelGrowth: number;
  waterFlowRate: number;

  entityShadowsDisable: boolean;
  staticRelightEnabled: boolean;
  structureTriangleAdmissionMode: StructureTriangleAdmissionMode;
  structureTriangleCutoutEnabled: boolean;
  structureTriangleCutoutWidth: number;
  structureTriangleCutoutHeight: number;
  structureTriangleCutoutAlpha: number;
  tileRenderRadius: number;

  paletteSwapEnabled: boolean;
  darknessMaskDebugDisabled: boolean;
  lightColorModeOverride: LightColorModeOverride;
  lightStrengthOverride: LightStrengthOverride;
  paletteGroup: PaletteGroup;
  paletteId: string;
  paletteSWeightPercent: PaletteRemapWeightPercent;
  paletteDarknessPercent: PaletteRemapWeightPercent;
  staticRelightStrengthPercent: PaletteRemapWeightPercent;
  staticRelightTargetDarknessPercent: StaticRelightTargetDarknessPercent;

  spawnBase: number;
  spawnPerDepth: number;
  hpBase: number;
  hpPerDepth: number;
  pressureAt0Sec: number;
  pressureAt120Sec: number;

  disableVisualCompiledCutoutCache: boolean;
  mapOverlaysDisabled: boolean;
  rampFaces: boolean;

  neutralBirdDisabled: boolean;
  neutralBirdForceState: NeutralBirdForceState;
  neutralBirdDisableTransitions: boolean;
  neutralBirdDebugRepickTarget: boolean;
};

export type AppSettings = {
  user: UserSettings;
  debug: DebugToolsSettings;
  system: SystemOverrides;
};

export type StoredSettings = {
  schemaVersion: number;
  user: UserSettings;
  debug: DebugToolsSettings;
  system: SystemOverrides;
};
