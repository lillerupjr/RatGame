import type { PaletteGroup } from "../engine/render/palette/palettes";
import type {
  ShadowSunCycleMode,
  ShadowSunDayCycleSpeedMultiplier,
  ShadowSunDayCycleStepsPerDay,
} from "../shadowSunDayCycle";
import type { StaticLightCycleOverride } from "../staticLightCycle";

export type VerticalTilesMode = "auto" | "manual";
export type RenderBackendMode = "canvas2d" | "webgl";
export type VerticalTilesViewportClass = "phone" | "desktop";
export type LightColorModeOverride = "authored" | "off" | "standard" | "palette";
export type LightStrengthOverride = "authored" | "low" | "medium" | "high";
export type StructureTriangleAdmissionMode = "viewport" | "renderDistance" | "hybrid" | "compare";
export type WorldAtlasMode = "dual" | "shared";
export type PerfOverlayMode = "off" | "overview" | "world" | "structures" | "textures" | "ground" | "lighting" | "cache" | "all";

export type NeutralBirdForceState =
  | "NONE"
  | "IDLE"
  | "TAKEOFF"
  | "FLY_TO_TARGET"
  | "LAND";

export const PALETTE_REMAP_WEIGHT_OPTIONS = [0, 25, 50, 75, 100] as const;
export type PaletteRemapWeightPercent = (typeof PALETTE_REMAP_WEIGHT_OPTIONS)[number];

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
    renderBackend: RenderBackendMode;
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
  perfOverlayMode: PerfOverlayMode;
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
  shadowSunDayCycleEnabled: boolean;
  shadowSunCycleMode: ShadowSunCycleMode;
  shadowSunDayCycleSpeedMultiplier: ShadowSunDayCycleSpeedMultiplier;
  shadowSunStepsPerDay: ShadowSunDayCycleStepsPerDay;
  staticLightCycleOverride: StaticLightCycleOverride;
  shadowSunAzimuthDeg: number;
  sunElevationOverrideEnabled: boolean;
  sunElevationOverrideDeg: number;
  sweepShadowDebug: boolean;
  tileHeightMap: boolean;
};

export type SystemOverrides = {
  gameSpeed: number;
  forceSpawnOverride: boolean;
  godMode: boolean;
  dmgMult: number;
  fireRateMult: number;
  waterFlowRate: number;

  entityShadowsDisable: boolean;
  structureTriangleAdmissionMode: StructureTriangleAdmissionMode;
  structureTriangleCutoutEnabled: boolean;
  structureTriangleCutoutWidth: number;
  structureTriangleCutoutHeight: number;
  structureTriangleCutoutAlpha: number;
  tileRenderRadius: number;
  worldAtlasMode: WorldAtlasMode;

  paletteSwapEnabled: boolean;
  darknessMaskDebugDisabled: boolean;
  lightColorModeOverride: LightColorModeOverride;
  lightStrengthOverride: LightStrengthOverride;
  paletteGroup: PaletteGroup;
  paletteId: string;
  paletteSWeightPercent: PaletteRemapWeightPercent;
  paletteDarknessPercent: PaletteRemapWeightPercent;

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
