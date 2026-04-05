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
export const DEFAULT_XP_LEVEL_BASE = 50;
export const DEFAULT_XP_LEVEL_GROWTH = 1.2;

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
  };
}

export function patchSystemOverrides(base: SystemOverrides, patch: SystemOverridesPatch): SystemOverrides {
  return sanitizeSystemOverrides({
    ...base,
    ...patch,
  });
}
