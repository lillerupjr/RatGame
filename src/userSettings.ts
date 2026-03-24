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
  normalizeStaticRelightTargetDarknessPercent,
  type LightColorModeOverride,
  type LightStrengthOverride,
  type StructureTriangleAdmissionMode,
} from "./settings/systemOverrides";
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
export type { LightColorModeOverride, LightStrengthOverride, StructureTriangleAdmissionMode };

export type VerticalTilesViewportClass = "phone" | "desktop";

export type RenderSettings = {
  entityShadowsDisable: boolean;
  entityAnchorsEnabled: boolean;
  renderPerfCountersEnabled: boolean;
  performanceMode: boolean;
  staticRelightEnabled: boolean;
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
  spawnBase: number;
  spawnPerDepth: number;
  hpBase: number;
  hpPerDepth: number;
  pressureAt0Sec: number;
  pressureAt120Sec: number;
  staticRelightPocEnabled?: boolean;
};

export type GameSettings = {
  userModeEnabled: boolean;
  healthOrbSide: "left" | "right";
  gameSpeed: number;
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
  disableVisualCompiledCutoutCache: boolean;
  mapOverlaysDisabled: boolean;
  rampFaces: boolean;
  forceSpawnOverride: boolean;
  godMode: boolean;
  dmgMult: number;
  fireRateMult: number;
  paletteSWeightPercent: 0 | 25 | 50 | 75 | 100;
  paletteDarknessPercent: 0 | 25 | 50 | 75 | 100;
  staticRelightStrengthPercent: 0 | 25 | 50 | 75 | 100;
  staticRelightTargetDarknessPercent: 0 | 25 | 50 | 75;
  entityAnchorOverlay: boolean;
  enemyAimOverlay: boolean;
  lootGoblinOverlay: boolean;
  pauseDebugCards: boolean;
  pauseCsvControls: boolean;
  dpsMeter: boolean;
  shadowSunTimeHour: number;
  sunElevationOverrideEnabled: boolean;
  sunElevationOverrideDeg: number;
  shadowV1DebugGeometryMode: "full" | "capOnly" | "connectorsOnly";
  shadowCasterMode:
    | "v1Roof"
    | "v2AlphaSilhouette"
    | "v3HybridTriangles"
    | "v4SliceStrips"
    | "v5TriangleShadowMask"
    | "v6FaceSliceDebug";
  shadowHybridDiagnosticMode: "off" | "solidShadowPass" | "solidMainCanvas";
  shadowDebugMode: "flatOnly" | "warpedOnly" | "both";
  shadowV5DebugView: "finalOnly" | "topMask" | "eastWestMask" | "southNorthMask" | "all";
  shadowV5TransformDebugMode: "deformed" | "raw";
  shadowV6SemanticBucket: "TOP" | "EAST_WEST" | "SOUTH_NORTH";
  shadowV6StructureIndex: number;
  shadowV6SliceCount: number;
  shadowV6AllStructures: boolean;
  shadowV6OneStructureOnly: boolean;
  shadowV6VerticalOnly: boolean;
  shadowV6TopOnly: boolean;
  shadowV6ForceRefresh: boolean;
  shadowV6FaceSliceDebugOverlay: boolean;
  waterFlowRate: number;
  neutralBirdAI: NeutralBirdAIDebugSettings;
  objectives: {
    showZoneBounds: boolean;
  };
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
    paletteVWeightPercent?: unknown;
  };
  game?: Partial<GameSettings>;
  render?: Partial<RenderSettings> & {
    entityShadowsEnabled?: boolean;
  };
  audio?: Partial<AudioPreferenceSettings>;
};

function toLegacySettings(): UserSettings {
  const settings = getSettings();
  const visibleVerticalTiles = settings.user.graphics.verticalTilesMode === "manual"
    ? settings.user.graphics.verticalTilesUser
    : undefined;

  return {
    debug: {
      grid: settings.debug.grid,
      walkMask: settings.debug.walkMask,
      blockedTiles: settings.debug.blockedTiles,
      ramps: settings.debug.ramps,
      colliders: settings.debug.colliders,
      slices: settings.debug.slices,
      occluders: settings.debug.occluders,
      decals: settings.debug.decals,
      structureHeights: settings.debug.structureHeights,
      spriteBounds: settings.debug.spriteBounds,
      showStructureSlices: settings.debug.showStructureSlices,
      structureTriangleFootprint: settings.debug.structureTriangleFootprint,
      showStructureAnchors: settings.debug.showStructureAnchors,
      showStructureTriangleOwnershipSort: settings.debug.showStructureTriangleOwnershipSort,
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
      staticRelightStrengthPercent: settings.system.staticRelightStrengthPercent,
      staticRelightTargetDarknessPercent: settings.system.staticRelightTargetDarknessPercent,
      entityAnchorOverlay: settings.debug.entityAnchorOverlay,
      enemyAimOverlay: settings.debug.enemyAimOverlay,
      lootGoblinOverlay: settings.debug.lootGoblinOverlay,
      pauseDebugCards: settings.debug.pauseDebugCards,
      pauseCsvControls: settings.debug.pauseCsvControls,
      dpsMeter: settings.debug.dpsMeter,
      shadowSunTimeHour: settings.debug.shadowSunTimeHour,
      sunElevationOverrideEnabled: settings.debug.sunElevationOverrideEnabled,
      sunElevationOverrideDeg: settings.debug.sunElevationOverrideDeg,
      shadowV1DebugGeometryMode: settings.debug.shadowV1DebugGeometryMode,
      shadowCasterMode: settings.debug.shadowCasterMode,
      shadowHybridDiagnosticMode: settings.debug.shadowHybridDiagnosticMode,
      shadowDebugMode: settings.debug.shadowDebugMode,
      shadowV5DebugView: settings.debug.shadowV5DebugView,
      shadowV5TransformDebugMode: settings.debug.shadowV5TransformDebugMode,
      shadowV6SemanticBucket: settings.debug.shadowV6SemanticBucket,
      shadowV6StructureIndex: settings.debug.shadowV6StructureIndex,
      shadowV6SliceCount: settings.debug.shadowV6SliceCount,
      shadowV6AllStructures: settings.debug.shadowV6AllStructures,
      shadowV6OneStructureOnly: settings.debug.shadowV6OneStructureOnly,
      shadowV6VerticalOnly: settings.debug.shadowV6VerticalOnly,
      shadowV6TopOnly: settings.debug.shadowV6TopOnly,
      shadowV6ForceRefresh: settings.debug.shadowV6ForceRefresh,
      shadowV6FaceSliceDebugOverlay: settings.debug.shadowV6FaceSliceDebugOverlay,
      waterFlowRate: settings.system.waterFlowRate,
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
    },
    game: {
      userModeEnabled: settings.user.game.userModeEnabled,
      healthOrbSide: settings.user.game.healthOrbSide,
      gameSpeed: settings.system.gameSpeed,
    },
    render: {
      entityShadowsDisable: settings.system.entityShadowsDisable,
      entityAnchorsEnabled: settings.debug.entityAnchorsEnabled,
      renderPerfCountersEnabled: settings.debug.renderPerfCountersEnabled,
      performanceMode: settings.user.graphics.performanceMode,
      staticRelightEnabled: settings.system.staticRelightEnabled,
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
      spawnBase: settings.system.spawnBase,
      spawnPerDepth: settings.system.spawnPerDepth,
      hpBase: settings.system.hpBase,
      hpPerDepth: settings.system.hpPerDepth,
      pressureAt0Sec: settings.system.pressureAt0Sec,
      pressureAt120Sec: settings.system.pressureAt120Sec,
      staticRelightPocEnabled: undefined,
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
  }

  const audioPatch = patch.audio;
  if (audioPatch) {
    userPatch.audio = {
      ...audioPatch,
    };
  }

  const renderPatch = { ...(patch.render ?? {}) };
  if (renderPatch.entityShadowsEnabled !== undefined && renderPatch.entityShadowsDisable === undefined) {
    renderPatch.entityShadowsDisable = !renderPatch.entityShadowsEnabled;
  }

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
    if (renderPatch.staticRelightEnabled !== undefined) systemPatch.staticRelightEnabled = renderPatch.staticRelightEnabled;
    if (renderPatch.staticRelightPocEnabled !== undefined && renderPatch.staticRelightEnabled === undefined) {
      systemPatch.staticRelightEnabled = renderPatch.staticRelightPocEnabled;
    }
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
    if (renderPatch.spawnBase !== undefined) systemPatch.spawnBase = renderPatch.spawnBase;
    if (renderPatch.spawnPerDepth !== undefined) systemPatch.spawnPerDepth = renderPatch.spawnPerDepth;
    if (renderPatch.hpBase !== undefined) systemPatch.hpBase = renderPatch.hpBase;
    if (renderPatch.hpPerDepth !== undefined) systemPatch.hpPerDepth = renderPatch.hpPerDepth;
    if (renderPatch.pressureAt0Sec !== undefined) systemPatch.pressureAt0Sec = renderPatch.pressureAt0Sec;
    if (renderPatch.pressureAt120Sec !== undefined) systemPatch.pressureAt120Sec = renderPatch.pressureAt120Sec;
  }

  const debugAny = patch.debug as any;
  if (debugAny) {
    const debugBooleanKeys = [
      "grid",
      "walkMask",
      "blockedTiles",
      "ramps",
      "colliders",
      "slices",
      "occluders",
      "decals",
      "structureHeights",
      "spriteBounds",
      "showStructureSlices",
      "structureTriangleFootprint",
      "showStructureAnchors",
      "showStructureTriangleOwnershipSort",
      "projectileFaces",
      "triggers",
      "debugRoadSemantic",
      "entityAnchorOverlay",
      "enemyAimOverlay",
      "lootGoblinOverlay",
      "pauseDebugCards",
      "pauseCsvControls",
      "dpsMeter",
      "sunElevationOverrideEnabled",
      "shadowV6AllStructures",
      "shadowV6OneStructureOnly",
      "shadowV6VerticalOnly",
      "shadowV6TopOnly",
      "shadowV6ForceRefresh",
      "shadowV6FaceSliceDebugOverlay",
    ] as const;
    for (const key of debugBooleanKeys) {
      if (debugAny[key] !== undefined) (debugPatch as any)[key] = debugAny[key];
    }
    if (debugAny.shadowSunTimeHour !== undefined) {
      debugPatch.shadowSunTimeHour = debugAny.shadowSunTimeHour;
    }
    if (debugAny.sunElevationOverrideDeg !== undefined) {
      debugPatch.sunElevationOverrideDeg = debugAny.sunElevationOverrideDeg;
    }
    if (debugAny.shadowV1DebugGeometryMode !== undefined) {
      debugPatch.shadowV1DebugGeometryMode = debugAny.shadowV1DebugGeometryMode;
    }
    if (debugAny.shadowCasterMode !== undefined) {
      debugPatch.shadowCasterMode = debugAny.shadowCasterMode;
    }
    if (debugAny.shadowHybridDiagnosticMode !== undefined) {
      debugPatch.shadowHybridDiagnosticMode = debugAny.shadowHybridDiagnosticMode;
    }
    if (debugAny.shadowDebugMode !== undefined) {
      debugPatch.shadowDebugMode = debugAny.shadowDebugMode;
    }
    if (debugAny.shadowV5DebugView !== undefined) {
      debugPatch.shadowV5DebugView = debugAny.shadowV5DebugView;
    }
    if (debugAny.shadowV5TransformDebugMode !== undefined) {
      debugPatch.shadowV5TransformDebugMode = debugAny.shadowV5TransformDebugMode;
    }
    if (debugAny.shadowV6SemanticBucket !== undefined) {
      debugPatch.shadowV6SemanticBucket = debugAny.shadowV6SemanticBucket;
    }
    if (debugAny.shadowV6StructureIndex !== undefined) {
      debugPatch.shadowV6StructureIndex = debugAny.shadowV6StructureIndex;
    }
    if (debugAny.shadowV6SliceCount !== undefined) {
      debugPatch.shadowV6SliceCount = debugAny.shadowV6SliceCount;
    }
    if (debugAny.shadowV6AllStructures !== undefined) {
      debugPatch.shadowV6AllStructures = debugAny.shadowV6AllStructures;
    }
    if (debugAny.shadowV6OneStructureOnly !== undefined) {
      debugPatch.shadowV6OneStructureOnly = debugAny.shadowV6OneStructureOnly;
    }
    if (debugAny.shadowV6VerticalOnly !== undefined) {
      debugPatch.shadowV6VerticalOnly = debugAny.shadowV6VerticalOnly;
    }
    if (debugAny.shadowV6TopOnly !== undefined) {
      debugPatch.shadowV6TopOnly = debugAny.shadowV6TopOnly;
    }
    if (debugAny.shadowV6ForceRefresh !== undefined) {
      debugPatch.shadowV6ForceRefresh = debugAny.shadowV6ForceRefresh;
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
    if (debugAny.staticRelightStrengthPercent !== undefined) {
      systemPatch.staticRelightStrengthPercent = normalizePaletteRemapWeightPercent(debugAny.staticRelightStrengthPercent);
    }
    if (debugAny.staticRelightTargetDarknessPercent !== undefined) {
      systemPatch.staticRelightTargetDarknessPercent = normalizeStaticRelightTargetDarknessPercent(
        debugAny.staticRelightTargetDarknessPercent,
      );
    }

    if (debugAny.objectives?.showZoneBounds !== undefined) {
      debugPatch.objectivesShowZoneBounds = debugAny.objectives.showZoneBounds;
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

export function isPauseDebugCardsEnabled(): boolean {
  return !!getSettings().debug.pauseDebugCards;
}

export function isPauseCsvControlsEnabled(): boolean {
  return !!getSettings().debug.pauseCsvControls;
}

export function isUserModeEnabled(): boolean {
  return !!getSettings().user.game.userModeEnabled;
}
