import { normalizePaletteRemapWeightPercent } from "../../debugSettings";
import { getUserSettings } from "../../userSettings";
import { getActiveMapSkinPaletteId } from "../content/mapSkins";
import type { PaletteSwapWeights } from "../../engine/render/palette/paletteSwap";

export type ActivePaletteId =
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
  | "sunset_cave_extended";

export type PaletteSwapWeightPercents = {
  sWeightPercent: number;
  darknessPercent: number;
};

/**
 * Returns the palette id that should be used for runtime map sprites right now.
 *
 * Priority:
 * 1) Dev override (if enabled)
 * 2) Active map skin chosen palette (pool pick or paletteId)
 * 3) db32
 */
export function resolveActivePaletteId(): ActivePaletteId {
  const s = getUserSettings();

  // Dev override
  if (s.render.paletteSwapEnabled && s.render.paletteId) {
    return s.render.paletteId;
  }

  return getActiveMapSkinPaletteId();
}

export function resolveActivePaletteSwapWeightPercents(): PaletteSwapWeightPercents {
  const debug = getUserSettings().debug;
  return {
    sWeightPercent: normalizePaletteRemapWeightPercent(debug.paletteSWeightPercent),
    darknessPercent: normalizePaletteRemapWeightPercent(debug.paletteDarknessPercent),
  };
}

export function resolveActivePaletteSwapWeights(): PaletteSwapWeights {
  const percents = resolveActivePaletteSwapWeightPercents();
  return {
    sWeight: percents.sWeightPercent / 100,
    darkness: percents.darknessPercent / 100,
  };
}

export function buildPaletteVariantKey(
  paletteId: string,
  percents: PaletteSwapWeightPercents,
): string {
  return `${paletteId}@@sw:${percents.sWeightPercent}@@dk:${percents.darknessPercent}`;
}

export function resolvePaletteVariantKeyForPaletteId(paletteId: string): string {
  return buildPaletteVariantKey(paletteId, resolveActivePaletteSwapWeightPercents());
}

export function resolveActivePaletteVariantKey(): string {
  return resolvePaletteVariantKeyForPaletteId(resolveActivePaletteId());
}
