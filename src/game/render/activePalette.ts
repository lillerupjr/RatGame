import { normalizePaletteRemapWeightPercent } from "../../debugSettings";
import { getUserSettings } from "../../userSettings";
import { getActiveMapSkinPaletteEntry, getActiveMapSkinPaletteId } from "../content/mapSkins";
import type { PaletteSwapWeights } from "../../engine/render/palette/paletteSwap";

export type ActivePaletteId =
  string;

export type PaletteSwapWeightPercents = {
  sWeightPercent: number;
  darknessPercent: number;
};

/**
 * Returns the palette id that should be used for runtime map sprites right now.
 *
 * Priority:
 * 1) Dev override (if enabled)
 * 2) Active map skin chosen palette entry
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
  const settings = getUserSettings();
  if (settings.render.paletteSwapEnabled && settings.render.paletteId) {
    const debug = settings.debug;
    return {
      sWeightPercent: normalizePaletteRemapWeightPercent(debug.paletteSWeightPercent),
      darknessPercent: normalizePaletteRemapWeightPercent(debug.paletteDarknessPercent),
    };
  }

  const authoredEntry = getActiveMapSkinPaletteEntry();
  return {
    sWeightPercent: normalizePaletteRemapWeightPercent(authoredEntry.saturationWeight * 100),
    darknessPercent: normalizePaletteRemapWeightPercent(authoredEntry.darkness * 100),
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
