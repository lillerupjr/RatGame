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
  | "sunset_cave_extended"
{
  const s = getUserSettings();

  // Dev override: keep current toggle, but treat it as an override switch.
  if (s.render.paletteSwapEnabled && s.render.paletteId) {
    return s.render.paletteId;
  }

  return getActiveMapSkinPaletteId();
}
