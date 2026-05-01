import type { RenderSettings } from "../../userSettings";

type RenderDebugFlagSubset = Pick<
  RenderSettings,
  "paletteHudDebugOverlayEnabled" | "darknessMaskDebugDisabled"
>;

export function shouldShowPaletteHudDebugOverlay(settings: {
  render: Partial<RenderDebugFlagSubset>;
  game?: { userModeEnabled?: boolean };
}): boolean {
  return settings.render.paletteHudDebugOverlayEnabled === true
    && settings.game?.userModeEnabled !== true;
}

export function shouldApplyAmbientDarknessOverlay(
  render: Partial<Pick<RenderSettings, "darknessMaskDebugDisabled">>,
): boolean {
  return render.darknessMaskDebugDisabled !== true;
}

export function formatPaletteHudDebugText(paletteId: string): string {
  return `Palette: ${paletteId}`;
}
