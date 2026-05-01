import { TextStyle } from "pixi.js";

// ── Color constants ──────────────────────────────────────────────────────────
// Cyberpunk navy/cyan palette.
export const COLORS = {
  bg:          0x07111e,
  bgPanel:     0x0a1628,
  bgPanel2:    0x081422,
  border:      0x1b3a4a,   // cyan at ~0.18 alpha baked to solid
  borderGold:  0x3b7480,   // cyan at ~0.50 alpha
  gold:        0x76e8ff,   // cyan accent (replaces old gold)
  goldDim:     0x416e80,   // cyan at ~0.55 alpha
  text:        0xd9f6ff,
  textDim:     0x7b9399,   // bee2eb at ~0.65 alpha
  textMuted:   0x3d6872,   // bee2eb at ~0.32 alpha
  green:       0x4ade80,
  amber:       0xd49530,
  crimson:     0xa03020,
  magic:       0x4488cc,
  uncommon:    0x4ade80,
  rare:        0x76e8ff,
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
const FONT_MONO = "'IBM Plex Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace";

// ── Text style presets ───────────────────────────────────────────────────────
export const TEXT_STYLES = {
  title: new TextStyle({
    fontFamily: FONT_MONO,
    fontSize: 12,
    fontWeight: "700",
    fill: COLORS.gold,
    letterSpacing: 3.4,
  }),
  sectionHeader: new TextStyle({
    fontFamily: FONT_MONO,
    fontSize: 9,
    fill: COLORS.textMuted,
    letterSpacing: 1.3,
  }),
  body: new TextStyle({
    fontFamily: FONT_MONO,
    fontSize: 12,
    fill: COLORS.text,
  }),
  statLabel: new TextStyle({
    fontFamily: FONT_MONO,
    fontSize: 11,
    fill: COLORS.textDim,
    letterSpacing: 0.4,
  }),
  statValue: new TextStyle({
    fontFamily: FONT_MONO,
    fontSize: 12,
    fontWeight: "600",
    fill: COLORS.gold,
  }),
  muted: new TextStyle({
    fontFamily: FONT_MONO,
    fontSize: 11,
    fill: COLORS.textMuted,
  }),
  accent: new TextStyle({
    fontFamily: FONT_MONO,
    fontSize: 11,
    fill: COLORS.green,
    letterSpacing: 0.9,
  }),
  ringName: new TextStyle({
    fontFamily: FONT_MONO,
    fontSize: 13,
    fontWeight: "700",
    fill: COLORS.gold,
    letterSpacing: 0.7,
  }),
  ringFamily: new TextStyle({
    fontFamily: FONT_MONO,
    fontSize: 9,
    fill: COLORS.gold,
    letterSpacing: 1.4,
  }),
  drawerStat: new TextStyle({
    fontFamily: FONT_MONO,
    fontSize: 11,
    fill: COLORS.text,
    letterSpacing: 0.3,
  }),
  drawerAction: new TextStyle({
    fontFamily: FONT_MONO,
    fontSize: 11,
    fill: COLORS.textMuted,
    letterSpacing: 0.5,
  }),
  slotLabel: new TextStyle({
    fontFamily: FONT_MONO,
    fontSize: 10,
    fill: COLORS.textDim,
  }),
  equipProgress: new TextStyle({
    fontFamily: FONT_MONO,
    fontSize: 10,
    fill: COLORS.textMuted,
  }),
  charName: new TextStyle({
    fontFamily: FONT_MONO,
    fontSize: 18,
    fontWeight: "700",
    fill: COLORS.gold,
    letterSpacing: 1.1,
  }),
} as const;

export type TextPresetName = keyof typeof TEXT_STYLES;
