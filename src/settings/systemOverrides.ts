import {
  getFirstPaletteInGroup,
  isPaletteIdInGroup,
  normalizePaletteGroup,
} from "../engine/render/palette/palettes";
import {
  PALETTE_REMAP_WEIGHT_OPTIONS,
  type PaletteRemapWeightPercent,
  type SystemOverrides,
  type LightColorModeOverride,
  type LightStrengthOverride,
  type RenderBackendMode,
  type StructureTriangleAdmissionMode,
  type WorldAtlasMode,
} from "./settingsTypes";
export type { LightColorModeOverride, LightStrengthOverride, StructureTriangleAdmissionMode, WorldAtlasMode } from "./settingsTypes";
export { PALETTE_REMAP_WEIGHT_OPTIONS } from "./settingsTypes";

export type EffectiveWorldAtlasMode = "dual" | "shared";

export const MIN_GAME_SPEED = 0.5;
export const MAX_GAME_SPEED = 1.5;
export const DEFAULT_GAME_SPEED = 1.0;
export const DEFAULT_XP_LEVEL_BASE = 15;
export const DEFAULT_XP_LEVEL_GROWTH = 1.2;
export const DEFAULT_HOSTILE_SPAWN_T0_POWER_PER_SEC = 0.6;
export const DEFAULT_HOSTILE_SPAWN_T120_POWER_PER_SEC = 2.0;
export const DEFAULT_HOSTILE_SPAWN_OVERTIME_POWER_PER_SEC_SLOPE = 0.006;
export const DEFAULT_HOSTILE_SPAWN_T0_LIVE_THREAT_CAP = 4.0;
export const DEFAULT_HOSTILE_SPAWN_T120_LIVE_THREAT_CAP = 18.0;
export const DEFAULT_HOSTILE_SPAWN_OVERTIME_LIVE_THREAT_CAP_SLOPE = 0.05;
export const DEFAULT_HOSTILE_SPAWN_HEAT_HEALTH_FACTOR = 0.12;
export const DEFAULT_HOSTILE_SPAWN_HEAT_POWER_PER_SEC_FACTOR = 0.08;
export const DEFAULT_HOSTILE_SPAWN_HEAT_THREAT_CAP_FACTOR = 0.05;
export const DEFAULT_HOSTILE_SPAWN_STOCKPILE_MULTIPLIER = 1.35;
export const DEFAULT_HOSTILE_SPAWN_BURST_CHANCE = 0.16;
export const DEFAULT_HOSTILE_SPAWN_BURST_EXTRA_ATTEMPTS = 1;
export const DEFAULT_HOSTILE_SPAWN_MIN_INTERVAL_SEC = 1.25;

export const NEUTRAL_BIRD_FORCE_STATES = [
  "NONE",
  "IDLE",
  "TAKEOFF",
  "FLY_TO_TARGET",
  "LAND",
] as const;

export function clampGameSpeed(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GAME_SPEED;
  return Math.max(MIN_GAME_SPEED, Math.min(MAX_GAME_SPEED, value));
}

export function normalizeXpLevelBase(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_XP_LEVEL_BASE;
  return Math.max(1, Math.min(500, Math.round(numeric)));
}

export function normalizeXpLevelGrowth(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_XP_LEVEL_GROWTH;
  return Math.max(1, Math.min(3, numeric));
}

function clampFinite(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function clampRounded(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

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

function normalizeLightColorModeOverride(value: unknown): LightColorModeOverride {
  if (value === "off" || value === "standard" || value === "palette") return value;
  return "authored";
}

function normalizeLightStrengthOverride(value: unknown): LightStrengthOverride {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "authored";
}

function normalizeStructureTriangleAdmissionMode(value: unknown): StructureTriangleAdmissionMode {
  if (value === "viewport" || value === "renderDistance") return value;
  if (value === "compare") return import.meta.env.DEV ? "compare" : "hybrid";
  return "hybrid";
}

function normalizeStructureTriangleCutoutSpan(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 2;
  return Math.max(0, Math.min(12, Math.round(numeric)));
}

function normalizeStructureTriangleCutoutAlpha(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.45;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeWorldAtlasMode(value: unknown): WorldAtlasMode {
  if (value === "shared") return "shared";
  if (value === "dual") return "dual";
  return "auto";
}

export function resolveEffectiveWorldAtlasMode(
  requestedMode: WorldAtlasMode | null | undefined,
  backend: RenderBackendMode,
): EffectiveWorldAtlasMode {
  if (requestedMode === "shared") return "shared";
  if (requestedMode === "dual") return "dual";
  return backend === "webgl" ? "shared" : "dual";
}

function resolvePaletteIdForGroup(group: SystemOverrides["paletteGroup"], paletteId: unknown): string {
  const candidate = typeof paletteId === "string" ? paletteId : "";
  if (isPaletteIdInGroup(candidate, group)) return candidate;
  return getFirstPaletteInGroup(group).id;
}

export const DEFAULT_SYSTEM_OVERRIDES: SystemOverrides = {
  gameSpeed: DEFAULT_GAME_SPEED,
  forceSpawnOverride: false,
  godMode: false,
  dmgMult: 1,
  fireRateMult: 1,
  xpLevelBase: DEFAULT_XP_LEVEL_BASE,
  xpLevelGrowth: DEFAULT_XP_LEVEL_GROWTH,
  waterFlowRate: 1,

  entityShadowsDisable: false,
  heightmapShadowsEnabled: true,
  structureTriangleAdmissionMode: "hybrid",
  structureTriangleCutoutEnabled: true,
  structureTriangleCutoutWidth: 4,
  structureTriangleCutoutHeight: 6,
  structureTriangleCutoutAlpha: 0.30,
  tileRenderRadius: 2,
  worldAtlasMode: "auto",

  paletteSwapEnabled: false,
  darknessMaskDebugDisabled: true,
  lightColorModeOverride: "palette",
  lightStrengthOverride: "high",
  paletteGroup: "live",
  paletteId: "db32",
  paletteSWeightPercent: 75,
  paletteDarknessPercent: 50,

  disableVisualCompiledCutoutCache: false,
  mapOverlaysDisabled: false,
  rampFaces: false,

  neutralBirdDisabled: false,
  neutralBirdForceState: "NONE",
  neutralBirdDisableTransitions: false,
  neutralBirdDebugRepickTarget: false,

  hostileSpawnT0PowerPerSec: DEFAULT_HOSTILE_SPAWN_T0_POWER_PER_SEC,
  hostileSpawnT120PowerPerSec: DEFAULT_HOSTILE_SPAWN_T120_POWER_PER_SEC,
  hostileSpawnOvertimePowerPerSecSlope: DEFAULT_HOSTILE_SPAWN_OVERTIME_POWER_PER_SEC_SLOPE,
  hostileSpawnT0LiveThreatCap: DEFAULT_HOSTILE_SPAWN_T0_LIVE_THREAT_CAP,
  hostileSpawnT120LiveThreatCap: DEFAULT_HOSTILE_SPAWN_T120_LIVE_THREAT_CAP,
  hostileSpawnOvertimeLiveThreatCapSlope: DEFAULT_HOSTILE_SPAWN_OVERTIME_LIVE_THREAT_CAP_SLOPE,
  hostileSpawnHeatHealthFactor: DEFAULT_HOSTILE_SPAWN_HEAT_HEALTH_FACTOR,
  hostileSpawnHeatPowerPerSecFactor: DEFAULT_HOSTILE_SPAWN_HEAT_POWER_PER_SEC_FACTOR,
  hostileSpawnHeatThreatCapFactor: DEFAULT_HOSTILE_SPAWN_HEAT_THREAT_CAP_FACTOR,
  hostileSpawnStockpileMultiplier: DEFAULT_HOSTILE_SPAWN_STOCKPILE_MULTIPLIER,
  hostileSpawnBurstChancePerSpawnWindow: DEFAULT_HOSTILE_SPAWN_BURST_CHANCE,
  hostileSpawnBurstExtraAttempts: DEFAULT_HOSTILE_SPAWN_BURST_EXTRA_ATTEMPTS,
  hostileSpawnMinSpawnIntervalSec: DEFAULT_HOSTILE_SPAWN_MIN_INTERVAL_SEC,
};

export type SystemOverridesPatch = Partial<SystemOverrides>;

export function sanitizeSystemOverrides(input: Partial<SystemOverrides> | undefined): SystemOverrides {
  const merged: SystemOverrides = {
    ...DEFAULT_SYSTEM_OVERRIDES,
    ...(input ?? {}),
  };

  const normalizedPaletteGroup = normalizePaletteGroup(merged.paletteGroup);

  return {
    ...merged,
    gameSpeed: clampGameSpeed(Number(merged.gameSpeed)),
    forceSpawnOverride: !!merged.forceSpawnOverride,
    godMode: !!merged.godMode,
    dmgMult: Math.max(0, Number.isFinite(Number(merged.dmgMult)) ? Number(merged.dmgMult) : 1),
    fireRateMult: Math.max(0, Number.isFinite(Number(merged.fireRateMult)) ? Number(merged.fireRateMult) : 1),
    xpLevelBase: normalizeXpLevelBase(merged.xpLevelBase),
    xpLevelGrowth: normalizeXpLevelGrowth(merged.xpLevelGrowth),
    waterFlowRate: Math.max(0, Number.isFinite(Number(merged.waterFlowRate)) ? Number(merged.waterFlowRate) : 1),

    entityShadowsDisable: !!merged.entityShadowsDisable,
    heightmapShadowsEnabled: merged.heightmapShadowsEnabled !== false,
    structureTriangleAdmissionMode: normalizeStructureTriangleAdmissionMode(merged.structureTriangleAdmissionMode),
    structureTriangleCutoutEnabled: !!merged.structureTriangleCutoutEnabled,
    structureTriangleCutoutWidth: normalizeStructureTriangleCutoutSpan(merged.structureTriangleCutoutWidth),
    structureTriangleCutoutHeight: normalizeStructureTriangleCutoutSpan(merged.structureTriangleCutoutHeight),
    structureTriangleCutoutAlpha: normalizeStructureTriangleCutoutAlpha(merged.structureTriangleCutoutAlpha),
    tileRenderRadius: Math.max(-12, Math.min(12, Math.round(Number(merged.tileRenderRadius) || 0))),
    worldAtlasMode: normalizeWorldAtlasMode(merged.worldAtlasMode),

    paletteSwapEnabled: !!merged.paletteSwapEnabled,
    darknessMaskDebugDisabled: !!merged.darknessMaskDebugDisabled,
    lightColorModeOverride: normalizeLightColorModeOverride(merged.lightColorModeOverride),
    lightStrengthOverride: normalizeLightStrengthOverride(merged.lightStrengthOverride),
    paletteGroup: normalizedPaletteGroup,
    paletteId: resolvePaletteIdForGroup(normalizedPaletteGroup, merged.paletteId),
    paletteSWeightPercent: normalizePaletteRemapWeightPercent(merged.paletteSWeightPercent),
    paletteDarknessPercent: normalizePaletteRemapWeightPercent(merged.paletteDarknessPercent),

    disableVisualCompiledCutoutCache: !!merged.disableVisualCompiledCutoutCache,
    mapOverlaysDisabled: !!merged.mapOverlaysDisabled,
    rampFaces: !!merged.rampFaces,

    neutralBirdDisabled: !!merged.neutralBirdDisabled,
    neutralBirdForceState: NEUTRAL_BIRD_FORCE_STATES.includes(merged.neutralBirdForceState)
      ? merged.neutralBirdForceState
      : "NONE",
    neutralBirdDisableTransitions: !!merged.neutralBirdDisableTransitions,
    neutralBirdDebugRepickTarget: !!merged.neutralBirdDebugRepickTarget,

    hostileSpawnT0PowerPerSec: clampFinite(
      merged.hostileSpawnT0PowerPerSec,
      DEFAULT_HOSTILE_SPAWN_T0_POWER_PER_SEC,
      0,
      5,
    ),
    hostileSpawnT120PowerPerSec: clampFinite(
      merged.hostileSpawnT120PowerPerSec,
      DEFAULT_HOSTILE_SPAWN_T120_POWER_PER_SEC,
      0,
      8,
    ),
    hostileSpawnOvertimePowerPerSecSlope: clampFinite(
      merged.hostileSpawnOvertimePowerPerSecSlope,
      DEFAULT_HOSTILE_SPAWN_OVERTIME_POWER_PER_SEC_SLOPE,
      0,
      0.2,
    ),
    hostileSpawnT0LiveThreatCap: clampFinite(
      merged.hostileSpawnT0LiveThreatCap,
      DEFAULT_HOSTILE_SPAWN_T0_LIVE_THREAT_CAP,
      0,
      30,
    ),
    hostileSpawnT120LiveThreatCap: clampFinite(
      merged.hostileSpawnT120LiveThreatCap,
      DEFAULT_HOSTILE_SPAWN_T120_LIVE_THREAT_CAP,
      0,
      60,
    ),
    hostileSpawnOvertimeLiveThreatCapSlope: clampFinite(
      merged.hostileSpawnOvertimeLiveThreatCapSlope,
      DEFAULT_HOSTILE_SPAWN_OVERTIME_LIVE_THREAT_CAP_SLOPE,
      0,
      1,
    ),
    hostileSpawnHeatHealthFactor: clampFinite(
      merged.hostileSpawnHeatHealthFactor,
      DEFAULT_HOSTILE_SPAWN_HEAT_HEALTH_FACTOR,
      0,
      0.5,
    ),
    hostileSpawnHeatPowerPerSecFactor: clampFinite(
      merged.hostileSpawnHeatPowerPerSecFactor,
      DEFAULT_HOSTILE_SPAWN_HEAT_POWER_PER_SEC_FACTOR,
      0,
      0.5,
    ),
    hostileSpawnHeatThreatCapFactor: clampFinite(
      merged.hostileSpawnHeatThreatCapFactor,
      DEFAULT_HOSTILE_SPAWN_HEAT_THREAT_CAP_FACTOR,
      0,
      0.5,
    ),
    hostileSpawnStockpileMultiplier: clampFinite(
      merged.hostileSpawnStockpileMultiplier,
      DEFAULT_HOSTILE_SPAWN_STOCKPILE_MULTIPLIER,
      1,
      3,
    ),
    hostileSpawnBurstChancePerSpawnWindow: clampFinite(
      merged.hostileSpawnBurstChancePerSpawnWindow,
      DEFAULT_HOSTILE_SPAWN_BURST_CHANCE,
      0,
      1,
    ),
    hostileSpawnBurstExtraAttempts: clampRounded(
      merged.hostileSpawnBurstExtraAttempts,
      DEFAULT_HOSTILE_SPAWN_BURST_EXTRA_ATTEMPTS,
      0,
      5,
    ),
    hostileSpawnMinSpawnIntervalSec: clampFinite(
      merged.hostileSpawnMinSpawnIntervalSec,
      DEFAULT_HOSTILE_SPAWN_MIN_INTERVAL_SEC,
      0.1,
      10,
    ),
  };
}

export function patchSystemOverrides(base: SystemOverrides, patch: SystemOverridesPatch): SystemOverrides {
  return sanitizeSystemOverrides({
    ...base,
    ...patch,
  });
}
