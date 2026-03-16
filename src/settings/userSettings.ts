import type { UserSettings, VerticalTilesMode, VerticalTilesViewportClass } from "./settingsTypes";
export type { VerticalTilesMode, VerticalTilesViewportClass } from "./settingsTypes";

export const DEFAULT_VISIBLE_VERTICAL_TILES_PHONE = 7;
export const DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP = 12;
export const DEFAULT_VISIBLE_VERTICAL_TILES = DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP;
export const MIN_VISIBLE_VERTICAL_TILES = 2;
export const MAX_VISIBLE_VERTICAL_TILES = 24;
export const DEFAULT_VERTICAL_TILES_MODE: VerticalTilesMode = "auto";

export const DEFAULT_USER_SETTINGS: UserSettings = {
  game: {
    userModeEnabled: true,
    healthOrbSide: "left",
  },
  audio: {
    masterVolume: 1,
    musicVolume: 0.6,
    sfxVolume: 1,
    musicMuted: false,
    sfxMuted: false,
  },
  graphics: {
    performanceMode: false,
    deathSlowdownEnabled: true,
    cameraSmoothingEnabled: true,
    verticalTilesMode: DEFAULT_VERTICAL_TILES_MODE,
    verticalTilesUser: DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP,
    verticalTilesAutoPhone: DEFAULT_VISIBLE_VERTICAL_TILES_PHONE,
    verticalTilesAutoDesktop: DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP,
  },
};

export type UserSettingsPatch = Partial<{
  game: Partial<UserSettings["game"]>;
  audio: Partial<UserSettings["audio"]>;
  graphics: Partial<UserSettings["graphics"]>;
}>;

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
  graphicsSettings: Partial<UserSettings["graphics"]> | undefined,
  viewportWidth: number,
  viewportHeight: number,
): ResolvedVerticalTiles {
  const mode = normalizeVerticalTilesMode(graphicsSettings?.verticalTilesMode);
  const manual = clampVisibleVerticalTiles(Number(graphicsSettings?.verticalTilesUser ?? DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP));
  const autoPhone = clampVisibleVerticalTiles(Number(graphicsSettings?.verticalTilesAutoPhone ?? DEFAULT_VISIBLE_VERTICAL_TILES_PHONE));
  const autoDesktop = clampVisibleVerticalTiles(
    Number(graphicsSettings?.verticalTilesAutoDesktop ?? DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP),
  );
  const viewportClass = classifyVerticalTilesViewport(viewportWidth, viewportHeight);
  const effective = mode === "manual" ? manual : (viewportClass === "phone" ? autoPhone : autoDesktop);
  return { mode, viewportClass, effective, manual, autoPhone, autoDesktop };
}

function clamp01(v: unknown, fallback: number): number {
  const numeric = Number(v);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

export function sanitizeUserSettings(input: Partial<{
  game: Partial<UserSettings["game"]>;
  audio: Partial<UserSettings["audio"]>;
  graphics: Partial<UserSettings["graphics"]>;
}> | undefined): UserSettings {
  const merged: UserSettings = {
    game: {
      ...DEFAULT_USER_SETTINGS.game,
      ...(input?.game ?? {}),
    },
    audio: {
      ...DEFAULT_USER_SETTINGS.audio,
      ...(input?.audio ?? {}),
    },
    graphics: {
      ...DEFAULT_USER_SETTINGS.graphics,
      ...(input?.graphics ?? {}),
    },
  };

  return {
    game: {
      userModeEnabled: merged.game.userModeEnabled !== false,
      healthOrbSide: merged.game.healthOrbSide === "right" ? "right" : "left",
    },
    audio: {
      masterVolume: clamp01(merged.audio.masterVolume, DEFAULT_USER_SETTINGS.audio.masterVolume),
      musicVolume: clamp01(merged.audio.musicVolume, DEFAULT_USER_SETTINGS.audio.musicVolume),
      sfxVolume: clamp01(merged.audio.sfxVolume, DEFAULT_USER_SETTINGS.audio.sfxVolume),
      musicMuted: !!merged.audio.musicMuted,
      sfxMuted: !!merged.audio.sfxMuted,
    },
    graphics: {
      performanceMode: !!merged.graphics.performanceMode,
      deathSlowdownEnabled: merged.graphics.deathSlowdownEnabled !== false,
      cameraSmoothingEnabled: merged.graphics.cameraSmoothingEnabled !== false,
      verticalTilesMode: normalizeVerticalTilesMode(merged.graphics.verticalTilesMode),
      verticalTilesUser: clampVisibleVerticalTiles(merged.graphics.verticalTilesUser),
      verticalTilesAutoPhone: clampVisibleVerticalTiles(merged.graphics.verticalTilesAutoPhone),
      verticalTilesAutoDesktop: clampVisibleVerticalTiles(merged.graphics.verticalTilesAutoDesktop),
    },
  };
}

export function patchUserSettings(base: UserSettings, patch: UserSettingsPatch): UserSettings {
  return sanitizeUserSettings({
    game: {
      ...base.game,
      ...(patch.game ?? {}),
    },
    audio: {
      ...base.audio,
      ...(patch.audio ?? {}),
    },
    graphics: {
      ...base.graphics,
      ...(patch.graphics ?? {}),
    },
  });
}
