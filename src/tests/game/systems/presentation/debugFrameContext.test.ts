import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../../../userSettings";
import { buildDebugFrameContext } from "../../../../game/systems/presentation/debug/debugFrameContext";

describe("debugFrameContext", () => {
  it("enables the world debug pass for tile height map debug toggle", () => {
    expect(buildDebugFrameContext({
      ...DEFAULT_SETTINGS.debug,
      tileHeightMap: true,
    }).enabled).toBe(true);
  });
});
