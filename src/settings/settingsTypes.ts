import type { PaletteGroup } from "../engine/render/palette/palettes";

export type VerticalTilesMode = "auto" | "manual";
export type VerticalTilesViewportClass = "phone" | "desktop";
export type LightColorModeOverride = "authored" | "off" | "standard" | "palette";
export type LightStrengthOverride = "authored" | "low" | "medium" | "high";
export type StructureTriangleAdmissionMode = "viewport" | "renderDistance" | "hybrid" | "compare";
export type ShadowV1DebugGeometryMode = "full" | "capOnly" | "connectorsOnly";
export type ShadowCasterMode =
  | "v1Roof"
  | "v2AlphaSilhouette"
  | "v3HybridTriangles"
  | "v4SliceStrips"
  | "v5TriangleShadowMask"
  | "v6FaceSliceDebug";
export type ShadowHybridDiagnosticMode = "off" | "solidShadowPass" | "solidMainCanvas";
export type ShadowDebugMode = "flatOnly" | "warpedOnly" | "both";
export type ShadowV5DebugView = "finalOnly" | "topMask" | "eastWestMask" | "southNorthMask" | "all";
export type ShadowV5TransformDebugMode = "deformed" | "raw";
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
  sunElevationOverrideEnabled: boolean;
  sunElevationOverrideDeg: number;
  shadowV1DebugGeometryMode: ShadowV1DebugGeometryMode;
  shadowCasterMode: ShadowCasterMode;
  shadowHybridDiagnosticMode: ShadowHybridDiagnosticMode;
  shadowDebugMode: ShadowDebugMode;
  shadowV5DebugView: ShadowV5DebugView;
  shadowV5TransformDebugMode: ShadowV5TransformDebugMode;
  shadowV6SemanticBucket: ShadowV6SemanticBucket;
  shadowV6StructureIndex: number;
  shadowV6SliceCount: number;
  shadowV6AllStructures: boolean;
  shadowV6OneStructureOnly: boolean;
  shadowV6VerticalOnly: boolean;
  shadowV6TopOnly: boolean;
  shadowV6ForceRefresh: boolean;
  shadowV6FaceSliceDebugOverlay: boolean;
};

export type SystemOverrides = {
  gameSpeed: number;
  forceSpawnOverride: boolean;
  godMode: boolean;
  dmgMult: number;
  fireRateMult: number;
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
