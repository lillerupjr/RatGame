import { TextStyle } from "pixi.js";

// ── Color constants ──────────────────────────────────────────────────────────
// Converted from the prototype's oklch palette to hex.
export const COLORS = {
  bg:          0x110d0b,
  bgPanel:     0x1a1512,
  bgPanel2:    0x1f1915,
  border:      0x3d2e1f,
  borderGold:  0x9a7940,
  gold:        0xd4a84a,
  goldDim:     0x8a6b30,
  text:        0xe0d0b8,
  textDim:     0x9a8870,
  textMuted:   0x645848,
  green:       0x3db55a,
  amber:       0xd49530,
  crimson:     0xa03020,
  magic:       0x4488cc,
  uncommon:    0x3db55a,
  rare:        0xd4a84a,
  legendary:   0xd06030,
  white:       0xffffff,
  black:       0x000000,
} as const;

// ── Spacing / layout tokens ──────────────────────────────────────────────────
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const RADII = {
  sm: 3,
  md: 6,
  lg: 10,
} as const;

// ── Font family ──────────────────────────────────────────────────────────────
const FONT_SERIF = "Cinzel, Georgia, serif";
const FONT_SANS = "'Segoe UI', system-ui, sans-serif";

// ── Text style presets ───────────────────────────────────────────────────────
export const TEXT_STYLES = {
  title: new TextStyle({
    fontFamily: FONT_SERIF,
    fontSize: 13,
    fontWeight: "700",
    fill: COLORS.gold,
    letterSpacing: 2.6,
  }),
  sectionHeader: new TextStyle({
    fontFamily: FONT_SERIF,
    fontSize: 9,
    fill: COLORS.textMuted,
    letterSpacing: 1.3,
  }),
  body: new TextStyle({
    fontFamily: FONT_SANS,
    fontSize: 12,
    fill: COLORS.text,
  }),
  statLabel: new TextStyle({
    fontFamily: FONT_SANS,
    fontSize: 11,
    fill: COLORS.textDim,
    letterSpacing: 0.4,
  }),
  statValue: new TextStyle({
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: "600",
    fill: COLORS.text,
  }),
  muted: new TextStyle({
    fontFamily: FONT_SANS,
    fontSize: 11,
    fill: COLORS.textMuted,
  }),
  accent: new TextStyle({
    fontFamily: FONT_SERIF,
    fontSize: 11,
    fill: COLORS.green,
    letterSpacing: 0.9,
  }),
  ringName: new TextStyle({
    fontFamily: FONT_SERIF,
    fontSize: 17,
    fontWeight: "700",
    fill: COLORS.gold,
    letterSpacing: 0.7,
  }),
  ringFamily: new TextStyle({
    fontFamily: FONT_SERIF,
    fontSize: 9,
    fill: COLORS.gold,
    letterSpacing: 1.4,
  }),
  drawerStat: new TextStyle({
    fontFamily: FONT_SANS,
    fontSize: 13,
    fill: COLORS.text,
    letterSpacing: 0.3,
  }),
  drawerAction: new TextStyle({
    fontFamily: FONT_SANS,
    fontSize: 11,
    fill: COLORS.textMuted,
    letterSpacing: 0.5,
  }),
  slotLabel: new TextStyle({
    fontFamily: FONT_SANS,
    fontSize: 10,
    fill: COLORS.textDim,
  }),
  equipProgress: new TextStyle({
    fontFamily: FONT_SANS,
    fontSize: 10,
    fill: COLORS.textMuted,
  }),
  charName: new TextStyle({
    fontFamily: FONT_SERIF,
    fontSize: 18,
    fontWeight: "700",
    fill: COLORS.gold,
    letterSpacing: 0.9,
  }),
} as const;

export type TextPresetName = keyof typeof TEXT_STYLES;
