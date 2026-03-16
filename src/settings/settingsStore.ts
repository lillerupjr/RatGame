import type { AppSettings, StoredSettings } from "./settingsTypes";
import {
  DEFAULT_USER_SETTINGS,
  patchUserSettings,
  sanitizeUserSettings,
  type UserSettingsPatch,
} from "./userSettings";
import {
  DEFAULT_DEBUG_TOOLS_SETTINGS,
  patchDebugToolsSettings,
  sanitizeDebugToolsSettings,
  type DebugToolsSettingsPatch,
} from "./debugToolsSettings";
import {
  DEFAULT_SYSTEM_OVERRIDES,
  patchSystemOverrides,
  sanitizeSystemOverrides,
  type SystemOverridesPatch,
} from "./systemOverrides";

const STORAGE_KEY = "ratgame:settings:v1";
const SCHEMA_VERSION = 1;
const FORCE_SETTINGS_RESET = false;

let currentSettings: AppSettings = {
  user: { ...DEFAULT_USER_SETTINGS },
  debug: { ...DEFAULT_DEBUG_TOOLS_SETTINGS },
  system: { ...DEFAULT_SYSTEM_OVERRIDES },
};

function toStored(settings: AppSettings): StoredSettings {
  return {
    schemaVersion: SCHEMA_VERSION,
    user: settings.user,
    debug: settings.debug,
    system: settings.system,
  };
}

function sanitizeAppSettings(input: Partial<AppSettings> | undefined): AppSettings {
  return {
    user: sanitizeUserSettings(input?.user),
    debug: sanitizeDebugToolsSettings(input?.debug),
    system: sanitizeSystemOverrides(input?.system),
  };
}

function loadStoredSettings(): StoredSettings | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as StoredSettings;
  } catch {
    return undefined;
  }
}

function saveStoredSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStored(settings)));
  } catch {
    // ignore
  }
}

function clearStoredSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function initSettings(): Promise<AppSettings> {
  if (FORCE_SETTINGS_RESET) {
    clearStoredSettings();
  }

  const stored = loadStoredSettings();
  if (!stored || stored.schemaVersion !== SCHEMA_VERSION) {
    currentSettings = sanitizeAppSettings(undefined);
    saveStoredSettings(currentSettings);
    return currentSettings;
  }

  currentSettings = sanitizeAppSettings({
    user: stored.user,
    debug: stored.debug,
    system: stored.system,
  });
  saveStoredSettings(currentSettings);
  return currentSettings;
}

export function getSettings(): AppSettings {
  return currentSettings;
}

export function saveSettings(): void {
  saveStoredSettings(currentSettings);
}

export function updateUserSettings(patch: UserSettingsPatch): AppSettings {
  currentSettings = {
    ...currentSettings,
    user: patchUserSettings(currentSettings.user, patch),
  };
  saveStoredSettings(currentSettings);
  return currentSettings;
}

export function updateDebugToolsSettings(patch: DebugToolsSettingsPatch): AppSettings {
  currentSettings = {
    ...currentSettings,
    debug: patchDebugToolsSettings(currentSettings.debug, patch),
  };
  saveStoredSettings(currentSettings);
  return currentSettings;
}

export function updateSystemOverrides(patch: SystemOverridesPatch): AppSettings {
  currentSettings = {
    ...currentSettings,
    system: patchSystemOverrides(currentSettings.system, patch),
  };
  saveStoredSettings(currentSettings);
  return currentSettings;
}

export const saveUserSettings = updateUserSettings;
export const saveDebugToolsSettings = updateDebugToolsSettings;
export const saveSystemOverrides = updateSystemOverrides;

export function resetUserSettings(): AppSettings {
  currentSettings = {
    ...currentSettings,
    user: { ...DEFAULT_USER_SETTINGS },
  };
  saveStoredSettings(currentSettings);
  return currentSettings;
}

export function resetDebugToolsSettings(): AppSettings {
  currentSettings = {
    ...currentSettings,
    debug: { ...DEFAULT_DEBUG_TOOLS_SETTINGS },
  };
  saveStoredSettings(currentSettings);
  return currentSettings;
}

export function resetSystemOverrides(): AppSettings {
  currentSettings = {
    ...currentSettings,
    system: { ...DEFAULT_SYSTEM_OVERRIDES },
  };
  saveStoredSettings(currentSettings);
  return currentSettings;
}

export const resetDebugToolsToDefault = resetDebugToolsSettings;
export const resetSystemOverridesToDefault = resetSystemOverrides;

export function hardResetAllSettings(): AppSettings {
  clearStoredSettings();
  currentSettings = sanitizeAppSettings(undefined);
  saveStoredSettings(currentSettings);
  return currentSettings;
}

export { FORCE_SETTINGS_RESET, SCHEMA_VERSION, STORAGE_KEY };
