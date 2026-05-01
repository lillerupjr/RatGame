import type { PaletteGroup } from "./engine/render/palette/palettes";
import {
  DEFAULT_VISIBLE_VERTICAL_TILES,
  DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP,
  DEFAULT_VISIBLE_VERTICAL_TILES_PHONE,
  DEFAULT_VERTICAL_TILES_MODE,
  MAX_VISIBLE_VERTICAL_TILES,
  MIN_VISIBLE_VERTICAL_TILES,
  clampVisibleVerticalTiles,
  resolveVerticalTiles as resolveVerticalTilesByUserGraphics,
  type ResolvedVerticalTiles,
  type VerticalTilesMode,
} from "./settings/userSettings";
import {
  DEFAULT_GAME_SPEED,
  MAX_GAME_SPEED,
  MIN_GAME_SPEED,
  clampGameSpeed,
  normalizePaletteRemapWeightPercent,
  type LightColorModeOverride,
  type LightStrengthOverride,
  type StructureTriangleAdmissionMode,
  type WorldAtlasMode,
} from "./settings/systemOverrides";
import type {
  PerfOverlayMode,
  RenderBackendMode,
} from "./settings/settingsTypes";
import type {
  ShadowSunCycleMode,
  ShadowSunDayCycleSpeedMultiplier,
  ShadowSunDayCycleStepsPerDay,
} from "./shadowSunDayCycle";
import type { StaticLightCycleOverride } from "./staticLightCycle";
import {
  getSettings,
  initSettings,
  updateDebugToolsSettings,
  updateSystemOverrides,
  updateUserSettings as updateBucketUserSettings,
} from "./settings/settingsStore";

export {
  DEFAULT_GAME_SPEED,
  DEFAULT_VISIBLE_VERTICAL_TILES,
  DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP,
  DEFAULT_VISIBLE_VERTICAL_TILES_PHONE,
  DEFAULT_VERTICAL_TILES_MODE,
  MAX_GAME_SPEED,
  MAX_VISIBLE_VERTICAL_TILES,
  MIN_GAME_SPEED,
  MIN_VISIBLE_VERTICAL_TILES,
  clampGameSpeed,
  clampVisibleVerticalTiles,
  type ResolvedVerticalTiles,
  type VerticalTilesMode,
};
export type {
  LightColorModeOverride,
  LightStrengthOverride,
  PerfOverlayMode,
  RenderBackendMode,
  StructureTriangleAdmissionMode,
  WorldAtlasMode,
};

export type VerticalTilesViewportClass = "phone" | "desktop";

export type RenderSettings = {
  renderBackend: RenderBackendMode;
  entityShadowsDisable: boolean;
  heightmapShadowsEnabled: boolean;
  entityAnchorsEnabled: boolean;
  renderPerfCountersEnabled: boolean;
  performanceMode: boolean;
  structureTriangleAdmissionMode: StructureTriangleAdmissionMode;
  structureTriangleCutoutEnabled: boolean;
  structureTriangleCutoutWidth: number;
  structureTriangleCutoutHeight: number;
  structureTriangleCutoutAlpha: number;
  deathSlowdownEnabled: boolean;
  cameraSmoothingEnabled: boolean;
  verticalTilesMode?: VerticalTilesMode;
  verticalTilesUser?: number;
  verticalTilesAutoPhone?: number;
  verticalTilesAutoDesktop?: number;
  visibleVerticalTiles?: number;
  tileRenderRadius: number;
  paletteSwapEnabled: boolean;
  paletteHudDebugOverlayEnabled?: boolean;
  darknessMaskDebugDisabled?: boolean;
  lightColorModeOverride: LightColorModeOverride;
  lightStrengthOverride: LightStrengthOverride;
  paletteGroup: PaletteGroup;
  paletteId: string;
  worldAtlasMode: WorldAtlasMode;
};

export type GameSettings = {
  userModeEnabled: boolean;
  healthOrbSide: "left" | "right";
  gameSpeed: number;
  xpLevelBase: number;
  xpLevelGrowth: number;
};

export type AudioPreferenceSettings = {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  musicMuted: boolean;
  sfxMuted: boolean;
};

export type NeutralBirdAIDebugSettings = {
  disabled: boolean;
  forceState: "NONE" | "IDLE" | "TAKEOFF" | "FLY_TO_TARGET" | "LAND";
  disableTransitions: boolean;
  drawDebug: boolean;
  debugRepickTarget: boolean;
};

export type DebugSettings = {
  renderBackend: RenderBackendMode;
  grid: boolean;
  walkMask: boolean;
  blockedTiles: boolean;
  ramps: boolean;
  colliders: boolean;
  slices: boolean;
  occluders: boolean;
  decals: boolean;
  structureHeights: boolean;
  showStructureSlices: boolean;
  tileHeightMap: boolean;
  spriteBounds: boolean;
  structureTriangleFootprint: boolean;
  showStructureAnchors: boolean;
  showStructureTriangleOwnershipSort: boolean;
  perfOverlayMode: PerfOverlayMode;
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
  paletteSWeightPercent: 0 | 25 | 50 | 75 | 100;
  paletteDarknessPercent: 0 | 25 | 50 | 75 | 100;
  entityAnchorOverlay: boolean;
  enemyAimOverlay: boolean;
  lootGoblinOverlay: boolean;
  pauseCsvControls: boolean;
  dpsMeter: boolean;
  shadowSunTimeHour: number;
  shadowSunDayCycleEnabled: boolean;
  shadowSunCycleMode: ShadowSunCycleMode;
  shadowSunDayCycleSpeedMultiplier: ShadowSunDayCycleSpeedMultiplier;
  shadowSunStepsPerDay: ShadowSunDayCycleStepsPerDay;
  staticLightCycleOverride: StaticLightCycleOverride;
  shadowSunAzimuthDeg: number;
  sunElevationOverrideEnabled: boolean;
  sunElevationOverrideDeg: number;
  waterFlowRate: number;
  heightmapShadowDebugShowHeightBuffer: boolean;
  heightmapShadowResolutionDivisor: number;
  heightmapShadowStepSize: number;
  heightmapShadowMaxSteps: number;
  heightmapShadowIntensity: number;
  neutralBirdAI: NeutralBirdAIDebugSettings;
  objectives: {
    showZoneBounds: boolean;
  };
  delveActShowCombatSubtypes: boolean;
};

export type UserSettings = {
  debug: DebugSettings;
  game: GameSettings;
  render: RenderSettings;
  audio: AudioPreferenceSettings;
};

export type UserSettingsPatch = {
  debug?: Partial<DebugSettings> & {
    neutralBirdAI?: Partial<NeutralBirdAIDebugSettings> & { enabled?: boolean };
    objectives?: Partial<DebugSettings["objectives"]>;
  };
  game?: Partial<GameSettings>;
  render?: Partial<RenderSettings>;
  audio?: Partial<AudioPreferenceSettings>;
};

function toLegacySettings(): UserSettings {
  const settings = getSettings();
  const visibleVerticalTiles = settings.user.graphics.verticalTilesMode === "manual"
    ? settings.user.graphics.verticalTilesUser
    : undefined;

  return {
    debug: {
      renderBackend: settings.debug.renderBackend,
      grid: settings.debug.grid,
      walkMask: settings.debug.walkMask,
      blockedTiles: settings.debug.blockedTiles,
      ramps: settings.debug.ramps,
      colliders: settings.debug.colliders,
      slices: settings.debug.slices,
      occluders: settings.debug.occluders,
      decals: settings.debug.decals,
      structureHeights: settings.debug.structureHeights,
      showStructureSlices: settings.debug.showStructureSlices,
      tileHeightMap: settings.debug.tileHeightMap,
      spriteBounds: settings.debug.spriteBounds,
      structureTriangleFootprint: settings.debug.structureTriangleFootprint,
      showStructureAnchors: settings.debug.showStructureAnchors,
      showStructureTriangleOwnershipSort: settings.debug.showStructureTriangleOwnershipSort,
      perfOverlayMode: settings.debug.perfOverlayMode,
      projectileFaces: settings.debug.projectileFaces,
      triggers: settings.debug.triggers,
      debugRoadSemantic: settings.debug.debugRoadSemantic,
      disableVisualCompiledCutoutCache: settings.system.disableVisualCompiledCutoutCache,
      mapOverlaysDisabled: settings.system.mapOverlaysDisabled,
      rampFaces: settings.system.rampFaces,
      forceSpawnOverride: settings.system.forceSpawnOverride,
      godMode: settings.system.godMode,
      dmgMult: settings.system.dmgMult,
      fireRateMult: settings.system.fireRateMult,
      paletteSWeightPercent: settings.system.paletteSWeightPercent,
      paletteDarknessPercent: settings.system.paletteDarknessPercent,
      entityAnchorOverlay: settings.debug.entityAnchorOverlay,
      enemyAimOverlay: settings.debug.enemyAimOverlay,
      lootGoblinOverlay: settings.debug.lootGoblinOverlay,
      pauseCsvControls: settings.debug.pauseCsvControls,
      dpsMeter: settings.debug.dpsMeter,
      shadowSunTimeHour: settings.debug.shadowSunTimeHour,
      shadowSunDayCycleEnabled: settings.debug.shadowSunDayCycleEnabled,
      shadowSunCycleMode: settings.debug.shadowSunCycleMode,
      shadowSunDayCycleSpeedMultiplier: settings.debug.shadowSunDayCycleSpeedMultiplier,
      shadowSunStepsPerDay: settings.debug.shadowSunStepsPerDay,
      staticLightCycleOverride: settings.debug.staticLightCycleOverride,
      shadowSunAzimuthDeg: settings.debug.shadowSunAzimuthDeg,
      sunElevationOverrideEnabled: settings.debug.sunElevationOverrideEnabled,
      sunElevationOverrideDeg: settings.debug.sunElevationOverrideDeg,
      waterFlowRate: settings.system.waterFlowRate,
      heightmapShadowDebugShowHeightBuffer: settings.debug.heightmapShadowDebugShowHeightBuffer,
      heightmapShadowResolutionDivisor: settings.debug.heightmapShadowResolutionDivisor,
      heightmapShadowStepSize: settings.debug.heightmapShadowStepSize,
      heightmapShadowMaxSteps: settings.debug.heightmapShadowMaxSteps,
      heightmapShadowIntensity: settings.debug.heightmapShadowIntensity,
      neutralBirdAI: {
        disabled: settings.system.neutralBirdDisabled,
        forceState: settings.system.neutralBirdForceState,
        disableTransitions: settings.system.neutralBirdDisableTransitions,
        drawDebug: settings.debug.neutralBirdDrawDebug,
        debugRepickTarget: settings.system.neutralBirdDebugRepickTarget,
      },
      objectives: {
        showZoneBounds: settings.debug.objectivesShowZoneBounds,
      },
      delveActShowCombatSubtypes: settings.debug.delveActShowCombatSubtypes,
    },
    game: {
      userModeEnabled: settings.user.game.userModeEnabled,
      healthOrbSide: settings.user.game.healthOrbSide,
      gameSpeed: settings.system.gameSpeed,
      xpLevelBase: settings.system.xpLevelBase,
      xpLevelGrowth: settings.system.xpLevelGrowth,
    },
    render: {
      renderBackend: settings.debug.renderBackend,
      entityShadowsDisable: settings.system.entityShadowsDisable,
      heightmapShadowsEnabled: settings.system.heightmapShadowsEnabled,
      entityAnchorsEnabled: settings.debug.entityAnchorsEnabled,
      renderPerfCountersEnabled: settings.debug.renderPerfCountersEnabled,
      performanceMode: settings.user.graphics.performanceMode,
      structureTriangleAdmissionMode: settings.system.structureTriangleAdmissionMode,
      structureTriangleCutoutEnabled: settings.system.structureTriangleCutoutEnabled,
      structureTriangleCutoutWidth: settings.system.structureTriangleCutoutWidth,
      structureTriangleCutoutHeight: settings.system.structureTriangleCutoutHeight,
      structureTriangleCutoutAlpha: settings.system.structureTriangleCutoutAlpha,
      deathSlowdownEnabled: settings.user.graphics.deathSlowdownEnabled,
      cameraSmoothingEnabled: settings.user.graphics.cameraSmoothingEnabled,
      verticalTilesMode: settings.user.graphics.verticalTilesMode,
      verticalTilesUser: settings.user.graphics.verticalTilesUser,
      verticalTilesAutoPhone: settings.user.graphics.verticalTilesAutoPhone,
      verticalTilesAutoDesktop: settings.user.graphics.verticalTilesAutoDesktop,
      visibleVerticalTiles,
      tileRenderRadius: settings.system.tileRenderRadius,
      paletteSwapEnabled: settings.system.paletteSwapEnabled,
      paletteHudDebugOverlayEnabled: settings.debug.paletteHudDebugOverlayEnabled,
      darknessMaskDebugDisabled: settings.system.darknessMaskDebugDisabled,
      lightColorModeOverride: settings.system.lightColorModeOverride,
      lightStrengthOverride: settings.system.lightStrengthOverride,
      paletteGroup: settings.system.paletteGroup,
      paletteId: settings.system.paletteId,
      worldAtlasMode: settings.system.worldAtlasMode,
    },
    audio: {
      ...settings.user.audio,
    },
  };
}

export const DEFAULT_SETTINGS: UserSettings = toLegacySettings();

function splitLegacyPatch(patch: UserSettingsPatch): {
  userPatch: Parameters<typeof updateBucketUserSettings>[0];
  debugPatch: Parameters<typeof updateDebugToolsSettings>[0];
  systemPatch: Parameters<typeof updateSystemOverrides>[0];
} {
  const userPatch: Parameters<typeof updateBucketUserSettings>[0] = {};
  const debugPatch: Parameters<typeof updateDebugToolsSettings>[0] = {};
  const systemPatch: Parameters<typeof updateSystemOverrides>[0] = {};

  const gamePatch = patch.game;
  if (gamePatch) {
    if (gamePatch.userModeEnabled !== undefined || gamePatch.healthOrbSide !== undefined) {
      userPatch.game = {
        userModeEnabled: gamePatch.userModeEnabled,
        healthOrbSide: gamePatch.healthOrbSide,
      };
    }
    if (gamePatch.gameSpeed !== undefined) {
      systemPatch.gameSpeed = gamePatch.gameSpeed;
    }
    if (gamePatch.xpLevelBase !== undefined) {
      systemPatch.xpLevelBase = gamePatch.xpLevelBase;
    }
    if (gamePatch.xpLevelGrowth !== undefined) {
      systemPatch.xpLevelGrowth = gamePatch.xpLevelGrowth;
    }
  }

  const audioPatch = patch.audio;
  if (audioPatch) {
    userPatch.audio = {
      ...audioPatch,
    };
  }

  const renderPatch = { ...(patch.render ?? {}) };

  if (Object.keys(renderPatch).length > 0) {
    if (
      renderPatch.performanceMode !== undefined
      || renderPatch.deathSlowdownEnabled !== undefined
      || renderPatch.cameraSmoothingEnabled !== undefined
      || renderPatch.verticalTilesMode !== undefined
      || renderPatch.verticalTilesUser !== undefined
      || renderPatch.verticalTilesAutoPhone !== undefined
      || renderPatch.verticalTilesAutoDesktop !== undefined
      || renderPatch.visibleVerticalTiles !== undefined
    ) {
      const nextGraphics: Record<string, unknown> = {};
      if (renderPatch.performanceMode !== undefined) nextGraphics.performanceMode = renderPatch.performanceMode;
      if (renderPatch.deathSlowdownEnabled !== undefined) nextGraphics.deathSlowdownEnabled = renderPatch.deathSlowdownEnabled;
      if (renderPatch.cameraSmoothingEnabled !== undefined) nextGraphics.cameraSmoothingEnabled = renderPatch.cameraSmoothingEnabled;
      if (renderPatch.verticalTilesMode !== undefined) nextGraphics.verticalTilesMode = renderPatch.verticalTilesMode;
      if (renderPatch.verticalTilesUser !== undefined) nextGraphics.verticalTilesUser = renderPatch.verticalTilesUser;
      if (renderPatch.verticalTilesAutoPhone !== undefined) nextGraphics.verticalTilesAutoPhone = renderPatch.verticalTilesAutoPhone;
      if (renderPatch.verticalTilesAutoDesktop !== undefined) {
        nextGraphics.verticalTilesAutoDesktop = renderPatch.verticalTilesAutoDesktop;
      }
      if (renderPatch.visibleVerticalTiles !== undefined) {
        nextGraphics.verticalTilesUser = renderPatch.visibleVerticalTiles;
        nextGraphics.verticalTilesMode = "manual";
      }
      userPatch.graphics = nextGraphics as any;
    }

    if (renderPatch.entityAnchorsEnabled !== undefined) debugPatch.entityAnchorsEnabled = renderPatch.entityAnchorsEnabled;
    if (renderPatch.renderPerfCountersEnabled !== undefined) {
      debugPatch.renderPerfCountersEnabled = renderPatch.renderPerfCountersEnabled;
    }
    if (renderPatch.paletteHudDebugOverlayEnabled !== undefined) {
      debugPatch.paletteHudDebugOverlayEnabled = renderPatch.paletteHudDebugOverlayEnabled;
    }

    if (renderPatch.entityShadowsDisable !== undefined) systemPatch.entityShadowsDisable = renderPatch.entityShadowsDisable;
    if (renderPatch.heightmapShadowsEnabled !== undefined) systemPatch.heightmapShadowsEnabled = renderPatch.heightmapShadowsEnabled;
    if (renderPatch.structureTriangleAdmissionMode !== undefined) {
      systemPatch.structureTriangleAdmissionMode = renderPatch.structureTriangleAdmissionMode;
    }
    if (renderPatch.structureTriangleCutoutEnabled !== undefined) {
      systemPatch.structureTriangleCutoutEnabled = renderPatch.structureTriangleCutoutEnabled;
    }
    if (renderPatch.structureTriangleCutoutWidth !== undefined) {
      systemPatch.structureTriangleCutoutWidth = renderPatch.structureTriangleCutoutWidth;
    }
    if (renderPatch.structureTriangleCutoutHeight !== undefined) {
      systemPatch.structureTriangleCutoutHeight = renderPatch.structureTriangleCutoutHeight;
    }
    if (renderPatch.structureTriangleCutoutAlpha !== undefined) {
      systemPatch.structureTriangleCutoutAlpha = renderPatch.structureTriangleCutoutAlpha;
    }
    if (renderPatch.tileRenderRadius !== undefined) systemPatch.tileRenderRadius = renderPatch.tileRenderRadius;
    if (renderPatch.paletteSwapEnabled !== undefined) systemPatch.paletteSwapEnabled = renderPatch.paletteSwapEnabled;
    if (renderPatch.darknessMaskDebugDisabled !== undefined) {
      systemPatch.darknessMaskDebugDisabled = renderPatch.darknessMaskDebugDisabled;
    }
    if (renderPatch.lightColorModeOverride !== undefined) {
      systemPatch.lightColorModeOverride = renderPatch.lightColorModeOverride;
    }
    if (renderPatch.lightStrengthOverride !== undefined) {
      systemPatch.lightStrengthOverride = renderPatch.lightStrengthOverride;
    }
    if (renderPatch.paletteGroup !== undefined) systemPatch.paletteGroup = renderPatch.paletteGroup;
    if (renderPatch.paletteId !== undefined) systemPatch.paletteId = renderPatch.paletteId;
    if (renderPatch.worldAtlasMode !== undefined) systemPatch.worldAtlasMode = renderPatch.worldAtlasMode;
    if (renderPatch.renderBackend !== undefined) debugPatch.renderBackend = renderPatch.renderBackend;
  }

  const debugAny = patch.debug as any;
  if (debugAny) {
    const debugBooleanKeys = [
      "showStructureSlices",
      "showStructureAnchors",
      "showStructureTriangleOwnershipSort",
      "grid",
      "walkMask",
      "blockedTiles",
      "ramps",
      "colliders",
      "slices",
      "occluders",
      "decals",
      "structureHeights",
      "tileHeightMap",
      "spriteBounds",
      "structureTriangleFootprint",
      "projectileFaces",
      "triggers",
      "debugRoadSemantic",
      "entityAnchorOverlay",
      "enemyAimOverlay",
      "lootGoblinOverlay",
      "pauseCsvControls",
      "dpsMeter",
      "shadowSunDayCycleEnabled",
      "sunElevationOverrideEnabled",
      "heightmapShadowDebugShowHeightBuffer",
    ] as const;
    for (const key of debugBooleanKeys) {
      if (debugAny[key] !== undefined) (debugPatch as any)[key] = debugAny[key];
    }
    if (debugAny.renderBackend !== undefined) {
      debugPatch.renderBackend = debugAny.renderBackend;
    }
    if (debugAny.perfOverlayMode !== undefined) {
      debugPatch.perfOverlayMode = debugAny.perfOverlayMode;
    }
    if (debugAny.shadowSunTimeHour !== undefined) {
      debugPatch.shadowSunTimeHour = debugAny.shadowSunTimeHour;
    }
    if (debugAny.shadowSunCycleMode !== undefined) {
      debugPatch.shadowSunCycleMode = debugAny.shadowSunCycleMode;
    }
    if (debugAny.shadowSunDayCycleSpeedMultiplier !== undefined) {
      debugPatch.shadowSunDayCycleSpeedMultiplier = debugAny.shadowSunDayCycleSpeedMultiplier;
    }
    if (debugAny.shadowSunStepsPerDay !== undefined) {
      debugPatch.shadowSunStepsPerDay = debugAny.shadowSunStepsPerDay;
    }
    if (debugAny.staticLightCycleOverride !== undefined) {
      debugPatch.staticLightCycleOverride = debugAny.staticLightCycleOverride;
    }
    if (debugAny.shadowSunAzimuthDeg !== undefined) {
      debugPatch.shadowSunAzimuthDeg = debugAny.shadowSunAzimuthDeg;
    }
    if (debugAny.sunElevationOverrideDeg !== undefined) {
      debugPatch.sunElevationOverrideDeg = debugAny.sunElevationOverrideDeg;
    }
    if (debugAny.heightmapShadowResolutionDivisor !== undefined) {
      debugPatch.heightmapShadowResolutionDivisor = debugAny.heightmapShadowResolutionDivisor;
    }
    if (debugAny.heightmapShadowStepSize !== undefined) {
      debugPatch.heightmapShadowStepSize = debugAny.heightmapShadowStepSize;
    }
    if (debugAny.heightmapShadowMaxSteps !== undefined) {
      debugPatch.heightmapShadowMaxSteps = debugAny.heightmapShadowMaxSteps;
    }
    if (debugAny.heightmapShadowIntensity !== undefined) {
      debugPatch.heightmapShadowIntensity = debugAny.heightmapShadowIntensity;
    }

    if (debugAny.disableVisualCompiledCutoutCache !== undefined) {
      systemPatch.disableVisualCompiledCutoutCache = debugAny.disableVisualCompiledCutoutCache;
    }
    if (debugAny.mapOverlaysDisabled !== undefined) systemPatch.mapOverlaysDisabled = debugAny.mapOverlaysDisabled;
    if (debugAny.rampFaces !== undefined) systemPatch.rampFaces = debugAny.rampFaces;
    if (debugAny.forceSpawnOverride !== undefined) systemPatch.forceSpawnOverride = debugAny.forceSpawnOverride;
    if (debugAny.godMode !== undefined) systemPatch.godMode = debugAny.godMode;
    if (debugAny.dmgMult !== undefined) systemPatch.dmgMult = debugAny.dmgMult;
    if (debugAny.fireRateMult !== undefined) systemPatch.fireRateMult = debugAny.fireRateMult;
    if (debugAny.waterFlowRate !== undefined) systemPatch.waterFlowRate = debugAny.waterFlowRate;
    if (debugAny.paletteSWeightPercent !== undefined) {
      systemPatch.paletteSWeightPercent = normalizePaletteRemapWeightPercent(debugAny.paletteSWeightPercent);
    }
    if (debugAny.paletteDarknessPercent !== undefined) {
      systemPatch.paletteDarknessPercent = normalizePaletteRemapWeightPercent(debugAny.paletteDarknessPercent);
    }

    if (debugAny.objectives?.showZoneBounds !== undefined) {
      debugPatch.objectivesShowZoneBounds = debugAny.objectives.showZoneBounds;
    }
    if (debugAny.delveActShowCombatSubtypes !== undefined) {
      debugPatch.delveActShowCombatSubtypes = debugAny.delveActShowCombatSubtypes;
    }

    const neutralBirdPatch = { ...(debugAny.neutralBirdAI ?? {}) };
    if (typeof neutralBirdPatch.enabled === "boolean" && typeof neutralBirdPatch.disabled !== "boolean") {
      neutralBirdPatch.disabled = !neutralBirdPatch.enabled;
    }
    if (neutralBirdPatch.disabled !== undefined) systemPatch.neutralBirdDisabled = neutralBirdPatch.disabled;
    if (neutralBirdPatch.forceState !== undefined) systemPatch.neutralBirdForceState = neutralBirdPatch.forceState;
    if (neutralBirdPatch.disableTransitions !== undefined) {
      systemPatch.neutralBirdDisableTransitions = neutralBirdPatch.disableTransitions;
    }
    if (neutralBirdPatch.drawDebug !== undefined) debugPatch.neutralBirdDrawDebug = neutralBirdPatch.drawDebug;
    if (neutralBirdPatch.debugRepickTarget !== undefined) {
      systemPatch.neutralBirdDebugRepickTarget = neutralBirdPatch.debugRepickTarget;
    }
  }

  return { userPatch, debugPatch, systemPatch };
}

export function resolveVerticalTiles(
  renderSettings: Partial<RenderSettings> | undefined,
  viewportWidth: number,
  viewportHeight: number,
): ResolvedVerticalTiles {
  return resolveVerticalTilesByUserGraphics(
    {
      verticalTilesMode: renderSettings?.verticalTilesMode,
      verticalTilesUser: renderSettings?.verticalTilesUser,
      verticalTilesAutoPhone: renderSettings?.verticalTilesAutoPhone,
      verticalTilesAutoDesktop: renderSettings?.verticalTilesAutoDesktop,
    },
    viewportWidth,
    viewportHeight,
  );
}

export async function initUserSettings(): Promise<UserSettings> {
  await initSettings();
  return getUserSettings();
}

export function getUserSettings(): UserSettings {
  return toLegacySettings();
}

export function updateUserSettings(patch: UserSettingsPatch): UserSettings {
  const split = splitLegacyPatch(patch);
  if (Object.keys(split.userPatch).length > 0) {
    updateBucketUserSettings(split.userPatch);
  }
  if (Object.keys(split.debugPatch).length > 0) {
    updateDebugToolsSettings(split.debugPatch);
  }
  if (Object.keys(split.systemPatch).length > 0) {
    updateSystemOverrides(split.systemPatch);
  }
  return getUserSettings();
}

export function isPauseCsvControlsEnabled(): boolean {
  return !!getSettings().debug.pauseCsvControls;
}

export function isUserModeEnabled(): boolean {
  return !!getSettings().user.game.userModeEnabled;
}
