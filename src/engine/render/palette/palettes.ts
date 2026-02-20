export type HexColor = `#${string}`;

export type PaletteDef = {
  id: string;
  name: string;
  colors: readonly HexColor[];
};

export const DB32: PaletteDef = {
  id: "db32",
  name: "DawnBringer 32",
  colors: [
    "#000000", "#222034", "#45283c", "#663931", "#8f563b", "#df7126", "#d9a066", "#eec39a",
    "#fbf236", "#99e550", "#6abe30", "#37946e", "#4b692f", "#524b24", "#323c39", "#3f3f74",
    "#306082", "#5b6ee1", "#639bff", "#5fcde4", "#cbdbfc", "#ffffff", "#9badb7", "#847e87",
    "#696a6a", "#595652", "#76428a", "#ac3232", "#d95763", "#d77bba", "#8f974a", "#8a6f30",
  ] as const,
};

export const DIVINATION: PaletteDef = {
  id: "divination",
  name: "Divination (Lospec)",
  // Source: lospec.com/palette-list/divination
  colors: [
    "#001c40",
    "#1e2a5f",
    "#235662",
    "#5464cf",
    "#cb8bf0",
    "#75d7da",
    "#9effb8",
  ] as const,
};

export const CYBERPUNK: PaletteDef = {
  id: "cyberpunk",
  name: "Cyberpunk Neon",
  // Carefully selected cyberpunk palette optimized for neon urban readability.
  colors: [
    "#0b0f1a", // deep shadow
    "#1a1c2c",
    "#5d275d",
    "#b13e53",
    "#ef7d57",
    "#ffcd75",

    "#a7f070",
    "#38b764",
    "#257179",

    "#29366f",
    "#3b5dc9",
    "#41a6f6",
    "#73eff7",

    "#f4f4f4", // highlight
  ] as const,
};

// ------------------------------------------------------------
// New 16-color palettes (Lospec)
// ------------------------------------------------------------

export const ENDESGA_16: PaletteDef = {
  id: "endesga_16",
  name: "Endesga 16",
  colors: [
    "#e4a672", "#b86f50", "#743f39", "#3f2832",
    "#9e2835", "#e53b44", "#fb922b", "#ffe762",
    "#63c64d", "#327345", "#193d3f", "#4f6781",
    "#afbfd2", "#ffffff", "#2ce8f5", "#0484d1",
  ] as const,
};

export const SWEETIE_16: PaletteDef = {
  id: "sweetie_16",
  name: "Sweetie 16",
  colors: [
    "#1a1c2c", "#5d275d", "#b13e53", "#ef7d57",
    "#ffcd75", "#a7f070", "#38b764", "#257179",
    "#29366f", "#3b5dc9", "#41a6f6", "#73eff7",
    "#f4f4f4", "#94b0c2", "#566c86", "#333c57",
  ] as const,
};

export const DAWNBRINGER_16: PaletteDef = {
  id: "dawnbringer_16",
  name: "DawnBringer 16",
  colors: [
    "#140c1c", "#442434", "#30346d", "#4e4a4e",
    "#854c30", "#346524", "#d04648", "#757161",
    "#597dce", "#d27d2c", "#8595a1", "#6daa2c",
    "#d2aa99", "#6dc2ca", "#dad45e", "#deeed6",
  ] as const,
};

export const NIGHT_16: PaletteDef = {
  id: "night_16",
  name: "Night 16",
  colors: [
    "#000000", "#1d2b53", "#7e2553", "#008751",
    "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
    "#ff004d", "#ffa300", "#ffec27", "#00e436",
    "#29adff", "#333033", "#767088", "#c5a3b3",
  ] as const,
};

export const FUN_16: PaletteDef = {
  id: "fun_16",
  name: "Fun16",
  colors: [
    "#2f0e1f", "#3c2d3b", "#3a4456", "#4a5888",
    "#4b6b8c", "#679cb2", "#7ac7c0", "#92e8c0",
    "#f7ffcd", "#fcd38c", "#e89c60", "#cb5c4d",
    "#7d2c4a", "#4c294f", "#341c27", "#241b2f",
  ] as const,
};

export const REHA_16: PaletteDef = {
  id: "reha_16",
  name: "Reha16",
  colors: [
    "#010e05", "#122303", "#2b2c21", "#3b3453",
    "#673d49", "#1e624e", "#943b38", "#8d6148",
    "#9b6e70", "#3b884c", "#b57e67", "#bc9b72",
    "#51b09d", "#d4b0a2", "#d3cfb1", "#f5e1e8",
  ] as const,
};

export const ARNE_16: PaletteDef = {
  id: "arne_16",
  name: "Arne 16",
  colors: [
    "#000000", "#1b2632", "#41596a", "#5b7d87",
    "#86a8a4", "#c0d1cc", "#ffffff", "#f6cbca",
    "#e39aac", "#b56e7f", "#7b425a", "#3d2d3f",
    "#f4b41b", "#f47e1b", "#e6482e", "#a93b3b",
  ] as const,
};

export const LUSH_SUNSET: PaletteDef = {
  id: "lush_sunset",
  name: "Lush Sunset",
  colors: [
    "#092f35", "#1e5a46", "#7d2b42", "#d64c2b",
    "#f08d1b", "#ffd34e", "#f7a18b", "#ffffff",
    "#1b0f1a", "#2a1d29", "#3b2b3a", "#51404b",
    "#6b5b65", "#8c7a83", "#b8a4aa", "#e6d4d8",
  ] as const,
};

export const VAPORHAZE_16: PaletteDef = {
  id: "vaporhaze_16",
  name: "Vaporhaze 16",
  colors: [
    "#0d0c1d", "#1f1d3a", "#3b2a5f", "#593196",
    "#7b42c5", "#a86ee3", "#e0b5ff", "#f7e8ff",
    "#1d4d4f", "#2d7a7e", "#3fb3b8", "#6ae3e8",
    "#a2fffd", "#ff4d7d", "#ffb85c", "#fff07a",
  ] as const,
};

export const SUNSET_CAVE_EXTENDED: PaletteDef = {
  id: "sunset_cave_extended",
  name: "Sunset Cave Extended",
  colors: [
    "#120317", "#2a0b3d", "#4e1b63", "#6d2b8b",
    "#8b3bb4", "#a64fe0", "#c27cff", "#e1b3ff",
    "#2b1b10", "#4d2a16", "#7a3f1f", "#b05c2b",
    "#e07b3a", "#ff9d4d", "#ffd37a", "#fff1c7",
  ] as const,
};

export const PALETTES: readonly PaletteDef[] = [
  DB32,
  DIVINATION,
  CYBERPUNK,

  ENDESGA_16,
  SWEETIE_16,
  DAWNBRINGER_16,
  NIGHT_16,
  FUN_16,
  REHA_16,
  ARNE_16,
  LUSH_SUNSET,
  VAPORHAZE_16,
  SUNSET_CAVE_EXTENDED,
] as const;

export function getPaletteById(id: string): PaletteDef {
  const found = PALETTES.find((p) => p.id === id);
  return found ?? DB32;
}
