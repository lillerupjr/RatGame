import { DEFAULT_DEBUG_SETTINGS, type DebugSettings } from "./debugSettings";
import { DEFAULT_SPAWN_TUNING } from "./game/balance/spawnTuningDefaults";

export type RenderSettings = {
  entityShadowsDisable: boolean;
  entityAnchorsEnabled: boolean;
  renderPerfCountersEnabled: boolean;
  performanceMode: boolean;
  tileRenderRadius: number;
  // Palette swap (Phase 1): apply at sprite load time, cached.
  paletteSwapEnabled: boolean;
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
  },
  render: {
    entityShadowsDisable: false,
    entityAnchorsEnabled: false,
    renderPerfCountersEnabled: false,
    performanceMode: false,
    tileRenderRadius: 3,
    paletteSwapEnabled: false,
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
