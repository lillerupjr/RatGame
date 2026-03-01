// src/ui/theme.ts — centralised design-token system

export type UiTheme = {
  // Backgrounds
  bgBase: string;
  bgSurface: string;
  bgElevated: string;
  bgOverlay: string;

  // Text
  textPrimary: string;
  textMuted: string;
  textAccent: string;

  // Accent
  accent: string;
  accentSoft: string;
  accentGlow: string;

  // Borders
  borderSubtle: string;
  borderDefault: string;
  borderStrong: string;

  // Interaction states
  hoverBg: string;
  activeBg: string;
  focusBg: string;
  primaryBtnBg: string;
  primaryBtnHoverBg: string;

  // Semantic status
  positive: string;
  negative: string;

  // Font
  fontMono: string;

  // Shadows
  shadowSubtle: string;
  shadowMedium: string;
  shadowGlow: string;

  // Radius
  radiusSm: string;
  radiusMd: string;
  radiusPill: string;

  // Transitions
  transitionFast: string;
  transitionStandard: string;

  // Textures
  textureGridColor: string;
  textureGridSize: string;
  textureScanColor: string;
  textureVignette: string;
};

export const defaultTheme: UiTheme = {
  // Backgrounds
  bgBase: "#07111e",
  bgSurface: "#0a1628",
  bgElevated: "rgba(6, 16, 30, 0.9)",
  bgOverlay: "rgba(0, 0, 0, 0.85)",

  // Text
  textPrimary: "#d9f6ff",
  textMuted: "rgba(190, 226, 235, 0.65)",
  textAccent: "#76e8ff",

  // Accent
  accent: "#76e8ff",
  accentSoft: "rgba(118, 232, 255, 0.34)",
  accentGlow: "rgba(118, 232, 255, 0.28)",

  // Borders
  borderSubtle: "rgba(118, 232, 255, 0.08)",
  borderDefault: "rgba(118, 232, 255, 0.24)",
  borderStrong: "rgba(118, 232, 255, 0.72)",

  // Interaction states
  hoverBg: "rgba(118, 232, 255, 0.07)",
  activeBg: "rgba(118, 232, 255, 0.16)",
  focusBg: "rgba(118, 232, 255, 0.1)",
  primaryBtnBg: "rgba(118, 232, 255, 0.12)",
  primaryBtnHoverBg: "rgba(118, 232, 255, 0.2)",

  // Semantic status
  positive: "#4ade80",
  negative: "#f87171",

  // Font
  fontMono:
    '"IBM Plex Mono", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace',

  // Shadows
  shadowSubtle: "0 4px 14px rgba(0, 0, 0, 0.35)",
  shadowMedium: "0 26px 48px rgba(0, 0, 0, 0.42)",
  shadowGlow: "0 0 10px rgba(118, 232, 255, 0.28)",

  // Radius
  radiusSm: "8px",
  radiusMd: "12px",
  radiusPill: "9999px",

  // Transitions
  transitionFast: "80ms ease",
  transitionStandard: "120ms ease-out",

  // Textures
  textureGridColor: "rgba(136, 233, 255, 0.05)",
  textureGridSize: "42px",
  textureScanColor: "rgba(118, 232, 255, 0.06)",
  textureVignette:
    "radial-gradient(120% 95% at 50% 45%, transparent 56%, rgba(0, 0, 0, 0.45) 100%)",
};

/** Convert camelCase key to CSS custom property name: bgBase → --bg-base */
function toCustomProp(key: string): string {
  return "--" + key.replace(/[A-Z]/g, (ch) => "-" + ch.toLowerCase());
}

/** Apply every token in `theme` as a CSS custom property on :root. */
export function applyTheme(theme: UiTheme = defaultTheme): void {
  const style = document.documentElement.style;
  for (const key of Object.keys(theme) as (keyof UiTheme)[]) {
    style.setProperty(toCustomProp(key), theme[key]);
  }
}
