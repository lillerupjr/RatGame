import { getUserSettings } from "../../userSettings";
import { getActiveMapSkinId, resolveMapSkin } from "../content/mapSkins";

/**
 * Returns the palette id that should be used for runtime map sprites right now.
 *
 * Priority:
 * 1) Dev override (if enabled)
 * 2) Active map skin paletteId
 * 3) db32
 */
export function resolveActivePaletteId(): "db32" | "divination" | "cyberpunk" {
  const s = getUserSettings();

  // Dev override: keep current toggle, but treat it as an override switch.
  if (s.render.paletteSwapEnabled && s.render.paletteId) {
    return s.render.paletteId;
  }

  const skinId = getActiveMapSkinId?.();
  if (skinId) {
    const skin = resolveMapSkin(skinId);
    const pid = skin?.paletteId;
    if (pid) return pid;
  }

  return "db32";
}
