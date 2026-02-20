import { getUserSettings } from "../../userSettings";
import { getActiveMapSkinPaletteId } from "../content/mapSkins";

/**
 * Returns the palette id that should be used for runtime map sprites right now.
 *
 * Priority:
 * 1) Dev override (if enabled)
 * 2) Active map skin chosen palette (pool pick or paletteId)
 * 3) db32
 */
export function resolveActivePaletteId():
  | "db32"
  | "divination"
  | "cyberpunk"
  | "sunset_8"
  | "s_sunset7"
  | "moonlight_15"
  | "st8_moonlight"
  | "noire_truth"
  | "chroma_noir"
  | "sunny_swamp"
  | "swamp_kin"
  | "cobalt_desert_7"
  | "lost_in_the_desert"
{
  const s = getUserSettings();

  // Dev override: keep current toggle, but treat it as an override switch.
  if (s.render.paletteSwapEnabled && s.render.paletteId) {
    return s.render.paletteId;
  }

  return getActiveMapSkinPaletteId();
}
