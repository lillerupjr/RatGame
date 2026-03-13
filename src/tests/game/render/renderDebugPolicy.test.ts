import { describe, expect, it } from "vitest";
import {
  formatPaletteHudDebugText,
  shouldApplyAmbientDarknessOverlay,
  shouldShowPaletteHudDebugOverlay,
} from "../../../game/render/renderDebugPolicy";

describe("renderDebugPolicy", () => {
  describe("shouldShowPaletteHudDebugOverlay", () => {
    it("returns false when overlay flag is disabled", () => {
      expect(shouldShowPaletteHudDebugOverlay({
        render: { paletteHudDebugOverlayEnabled: false },
        game: { userModeEnabled: false },
      })).toBe(false);
    });

    it("returns true when overlay flag is enabled and user mode is off", () => {
      expect(shouldShowPaletteHudDebugOverlay({
        render: { paletteHudDebugOverlayEnabled: true },
        game: { userModeEnabled: false },
      })).toBe(true);
    });

    it("returns false when user mode is enabled", () => {
      expect(shouldShowPaletteHudDebugOverlay({
        render: { paletteHudDebugOverlayEnabled: true },
        game: { userModeEnabled: true },
      })).toBe(false);
    });
  });

  describe("shouldApplyAmbientDarknessOverlay", () => {
    it("returns true by default", () => {
      expect(shouldApplyAmbientDarknessOverlay({})).toBe(true);
    });

    it("returns false when darkness mask debug disable flag is true", () => {
      expect(shouldApplyAmbientDarknessOverlay({ darknessMaskDebugDisabled: true })).toBe(false);
    });
  });

  describe("formatPaletteHudDebugText", () => {
    it("formats palette id consistently", () => {
      expect(formatPaletteHudDebugText("db32")).toBe("Palette: db32");
    });
  });
});
