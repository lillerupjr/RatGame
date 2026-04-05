import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FORCE_SETTINGS_RESET,
  SCHEMA_VERSION,
  STORAGE_KEY,
  getSettings,
  hardResetAllSettings,
  initSettings,
  resetDebugToolsSettings,
  resetSystemOverrides,
  resetUserSettings,
  updateDebugToolsSettings,
  updateSystemOverrides,
  updateUserSettings,
} from "../../settings/settingsStore";

const localStorageSpy = {
  getItem: vi.fn<(key: string) => string | null>(),
  setItem: vi.fn<(key: string, value: string) => void>(),
  removeItem: vi.fn<(key: string) => void>(),
};

describe("settingsStore", () => {
  beforeEach(() => {
    localStorageSpy.getItem.mockReset();
    localStorageSpy.setItem.mockReset();
    localStorageSpy.removeItem.mockReset();
    (globalThis as any).localStorage = localStorageSpy;
    hardResetAllSettings();
  });

  it("creates fresh defaults when storage is missing", async () => {
    localStorageSpy.getItem.mockReturnValue(null);

    const settings = await initSettings();

    expect(settings.user.game.userModeEnabled).toBe(true);
    expect(settings.debug.grid).toBe(false);
    expect(settings.system.godMode).toBe(false);
    expect(localStorageSpy.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.stringContaining(`\"schemaVersion\":${SCHEMA_VERSION}`),
    );
  });

  it("resets all buckets on schema mismatch", async () => {
    localStorageSpy.getItem.mockReturnValue(JSON.stringify({
      schemaVersion: SCHEMA_VERSION + 99,
      user: { game: { userModeEnabled: false, healthOrbSide: "right" } },
      debug: { grid: true },
      system: { godMode: true },
    }));

    const settings = await initSettings();

    expect(settings.user.game.userModeEnabled).toBe(true);
    expect(settings.debug.grid).toBe(false);
    expect(settings.system.godMode).toBe(false);
  });

  it("updates user/debug/system buckets independently", () => {
    updateUserSettings({ game: { userModeEnabled: false } });
    updateDebugToolsSettings({ grid: true });
    updateSystemOverrides({
      godMode: true,
      gameSpeed: 1.25,
      hostileSpawnHeatPowerPerSecFactor: 0.21,
    });

    const settings = getSettings();
    expect(settings.user.game.userModeEnabled).toBe(false);
    expect(settings.debug.grid).toBe(true);
    expect(settings.system.godMode).toBe(true);
    expect(settings.system.gameSpeed).toBe(1.25);
    expect(settings.system.hostileSpawnHeatPowerPerSecFactor).toBe(0.21);
  });

  it("supports per-bucket resets and hard reset", () => {
    updateUserSettings({ game: { userModeEnabled: false } });
    updateDebugToolsSettings({ grid: true });
    updateSystemOverrides({ godMode: true, hostileSpawnBurstChancePerSpawnWindow: 0.42 });

    resetUserSettings();
    expect(getSettings().user.game.userModeEnabled).toBe(true);

    resetDebugToolsSettings();
    expect(getSettings().debug.grid).toBe(false);

    resetSystemOverrides();
    expect(getSettings().system.godMode).toBe(false);
    expect(getSettings().system.hostileSpawnBurstChancePerSpawnWindow).toBe(0.16);

    updateSystemOverrides({ godMode: true });
    const afterHardReset = hardResetAllSettings();
    expect(afterHardReset.system.godMode).toBe(false);
  });

  it("keeps force-reset flag disabled by default", () => {
    expect(FORCE_SETTINGS_RESET).toBe(false);
  });
});
