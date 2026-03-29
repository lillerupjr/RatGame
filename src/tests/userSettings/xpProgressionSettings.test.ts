import { beforeEach, describe, expect, it } from "vitest";
import { createWorld } from "../../engine/world/world";
import { stageDocks } from "../../game/content/stages";
import { getSettings, hardResetAllSettings } from "../../settings/settingsStore";
import { getUserSettings, updateUserSettings } from "../../userSettings";

describe("userSettings xp progression merge", () => {
  beforeEach(() => {
    hardResetAllSettings();
  });

  it("exposes default xp progression values through the legacy wrapper", () => {
    const game = getUserSettings().game;

    expect(game.xpLevelBase).toBe(50);
    expect(game.xpLevelGrowth).toBe(1.2);
  });

  it("maps legacy game patches into system overrides and new runs", () => {
    updateUserSettings({
      game: {
        xpLevelBase: 83.2 as any,
        xpLevelGrowth: 1.27 as any,
      },
    } as any);

    const settings = getSettings();
    expect(settings.system.xpLevelBase).toBe(83);
    expect(settings.system.xpLevelGrowth).toBe(1.27);
    expect(getUserSettings().game.xpLevelBase).toBe(83);
    expect(getUserSettings().game.xpLevelGrowth).toBe(1.27);

    const world = createWorld({ seed: 99, stage: stageDocks });
    expect(world.run.xpToNextLevel).toBe(83);
  });
});
