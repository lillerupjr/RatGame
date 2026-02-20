import { DEFAULT_DEBUG_SETTINGS, type DebugSettings } from "./debugSettings";

export type RenderSettings = {
  entityShadowsEnabled: boolean;
  entityAnchorsEnabled: boolean;
  // Palette swap (Phase 1): apply at sprite load time, cached.
  paletteSwapEnabled: boolean;
  paletteId: "db32" | "divination" | "cyberpunk";
};

export type UserSettings = {
  debug: DebugSettings;
  render: RenderSettings;
};

export type UserSettingsPatch = {
  debug?: Partial<UserSettings["debug"]>;
  render?: Partial<UserSettings["render"]>;
};

export const DEFAULT_SETTINGS: UserSettings = {
  debug: { ...DEFAULT_DEBUG_SETTINGS },
  render: {
    entityShadowsEnabled: true,
    entityAnchorsEnabled: true,
    paletteSwapEnabled: false,
    paletteId: "db32",
  },
};

const LS_KEY = "ratgame:userSettings";

let currentSettings: UserSettings = DEFAULT_SETTINGS;

function mergeSettings(
  base: UserSettings,
  patch?: UserSettingsPatch,
): UserSettings {
  if (!patch) return base;

  return {
    ...base,
    debug: {
      ...base.debug,
      ...(patch.debug ?? {}),
    },
    render: {
      ...base.render,
      ...(patch.render ?? {}),
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
