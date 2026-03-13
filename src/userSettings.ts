import {
  DEFAULT_DEBUG_SETTINGS,
  normalizePaletteRemapWeightPercent,
  type DebugSettings,
} from "./debugSettings";
import { DEFAULT_SPAWN_TUNING } from "./game/balance/spawnTuningDefaults";

export type VerticalTilesMode = "auto" | "manual";
export type VerticalTilesViewportClass = "phone" | "desktop";

export const DEFAULT_VISIBLE_VERTICAL_TILES_PHONE = 6;
export const DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP = 9;
export const DEFAULT_VISIBLE_VERTICAL_TILES = DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP;
export const MIN_VISIBLE_VERTICAL_TILES = 2;
export const MAX_VISIBLE_VERTICAL_TILES = 24;
export const DEFAULT_VERTICAL_TILES_MODE: VerticalTilesMode = "auto";
export const MIN_GAME_SPEED = 0.5;
export const MAX_GAME_SPEED = 1.5;
export const DEFAULT_GAME_SPEED = 1.0;

export type RenderSettings = {
  entityShadowsDisable: boolean;
  entityAnchorsEnabled: boolean;
  renderPerfCountersEnabled: boolean;
  performanceMode: boolean;
  deathSlowdownEnabled: boolean;
  cameraSmoothingEnabled: boolean;
  verticalTilesMode?: VerticalTilesMode;
  verticalTilesUser?: number;
  verticalTilesAutoPhone?: number;
  verticalTilesAutoDesktop?: number;
  // Legacy key kept for localStorage compatibility.
  visibleVerticalTiles?: number;
  tileRenderRadius: number;
  // Palette swap (Phase 1): apply at sprite load time, cached.
  paletteSwapEnabled: boolean;
  // Dev-only HUD debug line for current resolved palette id.
  paletteHudDebugOverlayEnabled?: boolean;
  // Dev-only toggle to bypass final ambient darkness/tint screen overlay.
  darknessMaskDebugDisabled?: boolean;
  paletteId:
    | "db32"
    | "divination"
    | "cyberpunk"
    | "moonlight_15"
    | "st8_moonlight"
    | "chroma_noir"
    | "swamp_kin"
    | "lost_in_the_desert"
    | "endesga_16"
    | "sweetie_16"
    | "dawnbringer_16"
    | "night_16"
    | "fun_16"
    | "reha_16"
    | "arne_16"
    | "lush_sunset"
    | "vaporhaze_16"
    | "sunset_cave_extended";
  spawnBase: number;
  spawnPerDepth: number;
  hpBase: number;
  hpPerDepth: number;
  pressureAt0Sec: number;
  pressureAt120Sec: number;
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

export type UserSettings = {
  debug: DebugSettings;
  game: GameSettings;
  render: RenderSettings;
  audio: AudioPreferenceSettings;
};

export type UserSettingsPatch = {
  debug?: Partial<UserSettings["debug"]>;
  game?: Partial<UserSettings["game"]>;
  render?: Partial<UserSettings["render"]>;
  audio?: Partial<UserSettings["audio"]>;
};

export const DEFAULT_SETTINGS: UserSettings = {
  debug: { ...DEFAULT_DEBUG_SETTINGS },
  game: {
    userModeEnabled: true,
    healthOrbSide: "left",
    gameSpeed: DEFAULT_GAME_SPEED,
  },
  render: {
    entityShadowsDisable: false,
    entityAnchorsEnabled: false,
    renderPerfCountersEnabled: false,
    performanceMode: false,
    deathSlowdownEnabled: true,
    cameraSmoothingEnabled: true,
    verticalTilesMode: DEFAULT_VERTICAL_TILES_MODE,
    verticalTilesUser: DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP,
    verticalTilesAutoPhone: DEFAULT_VISIBLE_VERTICAL_TILES_PHONE,
    verticalTilesAutoDesktop: DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP,
    visibleVerticalTiles: DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP,
    tileRenderRadius: 3,
    paletteSwapEnabled: false,
    paletteHudDebugOverlayEnabled: false,
    darknessMaskDebugDisabled: false,
    paletteId: "db32",
    ...DEFAULT_SPAWN_TUNING,
  },
  audio: {
    masterVolume: 1,
    musicVolume: 0.6,
    sfxVolume: 1,
    musicMuted: false,
    sfxMuted: false,
  },
};

const LS_KEY = "ratgame:userSettings";

let currentSettings: UserSettings = DEFAULT_SETTINGS;

export function clampGameSpeed(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GAME_SPEED;
  return Math.max(MIN_GAME_SPEED, Math.min(MAX_GAME_SPEED, value));
}

export function clampVisibleVerticalTiles(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP;
  return Math.max(MIN_VISIBLE_VERTICAL_TILES, Math.min(MAX_VISIBLE_VERTICAL_TILES, Math.round(value)));
}

function normalizeVerticalTilesMode(value: unknown): VerticalTilesMode {
  return value === "manual" ? "manual" : "auto";
}

function classifyVerticalTilesViewport(viewportWidth: number, viewportHeight: number): VerticalTilesViewportClass {
  const width = Number.isFinite(viewportWidth) ? viewportWidth : Number.POSITIVE_INFINITY;
  const height = Number.isFinite(viewportHeight) ? viewportHeight : Number.POSITIVE_INFINITY;
  const coarsePointer = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(pointer: coarse)").matches;
  if (coarsePointer && (width <= 768 || height <= 500)) return "phone";
  return "desktop";
}

export type ResolvedVerticalTiles = {
  mode: VerticalTilesMode;
  viewportClass: VerticalTilesViewportClass;
  effective: number;
  manual: number;
  autoPhone: number;
  autoDesktop: number;
};

export function resolveVerticalTiles(
  renderSettings: Partial<RenderSettings> | undefined,
  viewportWidth: number,
  viewportHeight: number,
): ResolvedVerticalTiles {
  const modeRaw = renderSettings?.verticalTilesMode;
  const legacyVisible = Number(renderSettings?.visibleVerticalTiles);
  const mode = modeRaw === "auto" || modeRaw === "manual"
    ? modeRaw
    : (Number.isFinite(legacyVisible) ? "manual" : DEFAULT_VERTICAL_TILES_MODE);

  const manual = clampVisibleVerticalTiles(
    Number(renderSettings?.verticalTilesUser ?? renderSettings?.visibleVerticalTiles ?? DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP),
  );
  const autoPhone = clampVisibleVerticalTiles(
    Number(renderSettings?.verticalTilesAutoPhone ?? DEFAULT_VISIBLE_VERTICAL_TILES_PHONE),
  );
  const autoDesktop = clampVisibleVerticalTiles(
    Number(renderSettings?.verticalTilesAutoDesktop ?? DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP),
  );
  const viewportClass = classifyVerticalTilesViewport(viewportWidth, viewportHeight);
  const effective = mode === "manual"
    ? manual
    : (viewportClass === "phone" ? autoPhone : autoDesktop);
  return { mode, viewportClass, effective, manual, autoPhone, autoDesktop };
}

function mergeSettings(
  base: UserSettings,
  patch?: UserSettingsPatch,
): UserSettings {
  if (!patch) return base;

  const patchAny = patch as any;
  const debugPatch: Record<string, unknown> = { ...(patchAny.debug ?? {}) };
  const gamePatch: Record<string, unknown> = { ...(patchAny.game ?? {}) };
  const renderPatch: Record<string, unknown> = { ...(patchAny.render ?? {}) };
  const audioPatch: Record<string, unknown> = { ...(patchAny.audio ?? {}) };
  const neutralBirdPatch = (debugPatch.neutralBirdAI as Record<string, unknown> | undefined) ?? undefined;
  if (
    neutralBirdPatch
    && typeof neutralBirdPatch.disabled !== "boolean"
    && typeof neutralBirdPatch.enabled === "boolean"
  ) {
    neutralBirdPatch.disabled = !neutralBirdPatch.enabled;
    delete neutralBirdPatch.enabled;
    debugPatch.neutralBirdAI = neutralBirdPatch;
  }
  if (
    typeof renderPatch.entityShadowsDisable !== "boolean"
    && typeof renderPatch.entityShadowsEnabled === "boolean"
  ) {
    renderPatch.entityShadowsDisable = !renderPatch.entityShadowsEnabled;
  }
  if (renderPatch.visibleVerticalTiles !== undefined) {
    const clampedLegacy = clampVisibleVerticalTiles(Number(renderPatch.visibleVerticalTiles));
    renderPatch.visibleVerticalTiles = clampedLegacy;
    if (renderPatch.verticalTilesUser === undefined) {
      renderPatch.verticalTilesUser = clampedLegacy;
    }
    if (renderPatch.verticalTilesMode === undefined) {
      renderPatch.verticalTilesMode = "manual";
    }
  }
  if (renderPatch.verticalTilesMode !== undefined) {
    renderPatch.verticalTilesMode = normalizeVerticalTilesMode(renderPatch.verticalTilesMode);
  }
  if (renderPatch.verticalTilesUser !== undefined) {
    renderPatch.verticalTilesUser = clampVisibleVerticalTiles(Number(renderPatch.verticalTilesUser));
  }
  if (renderPatch.verticalTilesAutoPhone !== undefined) {
    renderPatch.verticalTilesAutoPhone = clampVisibleVerticalTiles(Number(renderPatch.verticalTilesAutoPhone));
  }
  if (renderPatch.verticalTilesAutoDesktop !== undefined) {
    renderPatch.verticalTilesAutoDesktop = clampVisibleVerticalTiles(Number(renderPatch.verticalTilesAutoDesktop));
  }
  if (gamePatch.gameSpeed !== undefined) {
    gamePatch.gameSpeed = clampGameSpeed(Number(gamePatch.gameSpeed));
  }
  if (debugPatch.paletteSWeightPercent !== undefined) {
    debugPatch.paletteSWeightPercent = normalizePaletteRemapWeightPercent(debugPatch.paletteSWeightPercent);
  }
  if (debugPatch.paletteVWeightPercent !== undefined) {
    debugPatch.paletteVWeightPercent = normalizePaletteRemapWeightPercent(debugPatch.paletteVWeightPercent);
  }

  return {
    ...base,
    debug: {
      ...base.debug,
      ...(debugPatch as Partial<UserSettings["debug"]>),
    },
    game: {
      ...base.game,
      ...(gamePatch as Partial<UserSettings["game"]>),
    },
    render: {
      ...base.render,
      ...(renderPatch as Partial<UserSettings["render"]>),
    },
    audio: {
      ...base.audio,
      ...(audioPatch as Partial<UserSettings["audio"]>),
    },
  };
}

async function loadLocalOverrides(): Promise<UserSettingsPatch | undefined> {
  try {
    const mod = await import(/* @vite-ignore */ "./userSettings.local");
    return (mod as any).default ?? (mod as any);
  } catch {
    return undefined;
  }
}

function loadFromLocalStorage(): UserSettingsPatch | undefined {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function saveToLocalStorage(settings: UserSettings): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export async function initUserSettings(): Promise<UserSettings> {
  const local = await loadLocalOverrides();
  const storage = loadFromLocalStorage();

  currentSettings = mergeSettings(
    mergeSettings(DEFAULT_SETTINGS, local),
    storage,
  );

  return currentSettings;
}

export function getUserSettings(): UserSettings {
  return currentSettings;
}

export function updateUserSettings(
  patch: UserSettingsPatch,
): UserSettings {
  currentSettings = mergeSettings(currentSettings, patch);

  saveToLocalStorage(currentSettings);

  return currentSettings;
}

export function isPauseDebugCardsEnabled(): boolean {
  return !!currentSettings.debug.pauseDebugCards;
}

export function isPauseCsvControlsEnabled(): boolean {
  return !!currentSettings.debug.pauseCsvControls;
}

export function isUserModeEnabled(): boolean {
  return !!currentSettings.game.userModeEnabled;
}
