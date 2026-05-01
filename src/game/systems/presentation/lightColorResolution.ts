import { hsvToRgb, hexToRgb, rgbToHsv, type Rgb } from "../../../engine/render/palette/colorMath";
import { getPaletteHsvAnchors } from "../../../engine/render/palette/palettes";
import { pickNearestPaletteHsvAnchor } from "../../../engine/render/palette/paletteSwap";

export type LightColorMode = "off" | "standard" | "palette";
export type LightStrength = "low" | "medium" | "high";

export const DEFAULT_STANDARD_LIGHT_COLOR = "#FFFB74";

const LIGHT_STRENGTH_MULTIPLIER: Record<LightStrength, number> = {
  low: 0.75,
  medium: 1,
  high: 1.25,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function mix(a: number, b: number, t: number): number {
  const weight = clamp01(t);
  return a * (1 - weight) + b * weight;
}

function toHexByte(value: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, "0").toUpperCase();
}

function rgbToHex(rgb: Rgb): string {
  return `#${toHexByte(rgb.r)}${toHexByte(rgb.g)}${toHexByte(rgb.b)}`;
}

export function normalizeLightColorMode(value: unknown): LightColorMode {
  if (value === "off" || value === "palette") return value;
  return "standard";
}

export function normalizeLightStrength(value: unknown): LightStrength {
  if (value === "low" || value === "high") return value;
  return "medium";
}

export type ResolvePaletteLightTintParams = {
  authoredColor?: string | null;
  paletteId: string;
  saturationWeight: number;
};

export function resolvePaletteLightTint(params: ResolvePaletteLightTintParams): string {
  const sourceRgb = hexToRgb(params.authoredColor ?? DEFAULT_STANDARD_LIGHT_COLOR);
  const sourceHsv = rgbToHsv(sourceRgb);
  const paletteHsvAnchors = getPaletteHsvAnchors(params.paletteId);
  const nearestPalette = pickNearestPaletteHsvAnchor(sourceHsv.h, paletteHsvAnchors);

  const remappedRgb = hsvToRgb({
    h: nearestPalette.h,
    s: mix(sourceHsv.s, nearestPalette.s, params.saturationWeight),
    v: sourceHsv.v,
  });
  return rgbToHex(remappedRgb);
}

export type ResolveLightColorAndIntensityParams = {
  colorMode?: LightColorMode | null;
  strength?: LightStrength | null;
  authoredColor?: string | null;
  baseIntensity: number;
  paletteId: string;
  saturationWeight: number;
};

export type ResolvedLightColorAndIntensity = {
  skip: boolean;
  color: string;
  intensity: number;
  colorMode: LightColorMode;
  strength: LightStrength;
};

export function resolveLightColorAndIntensity(
  params: ResolveLightColorAndIntensityParams,
): ResolvedLightColorAndIntensity {
  const colorMode = normalizeLightColorMode(params.colorMode);
  const strength = normalizeLightStrength(params.strength);

  if (colorMode === "off") {
    return {
      skip: true,
      color: DEFAULT_STANDARD_LIGHT_COLOR,
      intensity: 0,
      colorMode,
      strength,
    };
  }

  const color = colorMode === "palette"
    ? resolvePaletteLightTint({
        authoredColor: params.authoredColor,
        paletteId: params.paletteId,
        saturationWeight: params.saturationWeight,
      })
    : DEFAULT_STANDARD_LIGHT_COLOR;

  return {
    skip: false,
    color,
    intensity: Math.max(0, params.baseIntensity * LIGHT_STRENGTH_MULTIPLIER[strength]),
    colorMode,
    strength,
  };
}
