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

// Existing
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
    "#0b0f1a",
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
    "#f4f4f4",
  ] as const,
};

// ----------------------------
// New imported palettes (10)
// ----------------------------

// Sunset theme (2)
export const SUNSET_8: PaletteDef = {
  id: "sunset_8",
  name: "Sunset 8 (Lospec)",
  // Source: lospec.com/palette-list/sunset-8
  colors: [
    "#ffff78",
    "#ffd647",
    "#ffc247",
    "#ffa936",
    "#ff8b6f",
    "#e67595",
    "#9a6390",
    "#464678",
  ] as const,
};

export const S_SUNSET7: PaletteDef = {
  id: "s_sunset7",
  name: "S-Sunset7 (Lospec)",
  // Source: lospec.com/palette-list/s-sunset7
  colors: [
    "#07102e",
    "#431480",
    "#981fab",
    "#f04181",
    "#f76c59",
    "#faaa5a",
    "#f0fac8",
  ] as const,
};

// Moonlight theme (2)
export const MOONLIGHT_15: PaletteDef = {
  id: "moonlight_15",
  name: "Moonlight 15 (Lospec)",
  // Source: lospec.com/palette-list/moonlight-15
  colors: [
    "#030206",
    "#070918",
    "#090f33",
    "#091e4d",
    "#083253",
    "#0d2f87",
    "#0a4ca0",
    "#2684ce",
    "#36b5f5",
    "#3afffb",
    "#83c16f",
    "#63a460",
    "#3d824e",
    "#2e6749",
    "#1f4b43",
  ] as const,
};

export const ST8_MOONLIGHT: PaletteDef = {
  id: "st8_moonlight",
  name: "ST 8 MoonLight (Lospec)",
  // Source: lospec.com/palette-list/st-8-moonlight
  colors: [
    "#0b0c0d",
    "#222426",
    "#363940",
    "#4c5359",
    "#667480",
    "#8598a6",
    "#a3becc",
    "#c3dce5",
  ] as const,
};

// Noir theme (2)
export const NOIRE_TRUTH: PaletteDef = {
  id: "noire_truth",
  name: "Noire Truth (Lospec)",
  // Source: lospec.com/palette-list/noire-truth
  colors: [
    "#c6baac",
    "#1e1c32",
  ] as const,
};

export const CHROMA_NOIR: PaletteDef = {
  id: "chroma_noir",
  name: "Chroma Noir (Lospec)",
  // Source: lospec.com/palette-list/chroma-noir
  colors: [
    "#0d0d0d",
    "#383838",
    "#4f4f4f",
    "#828282",
    "#b5b5b5",
    "#d9d9d9",
    "#4c2712",
    "#60361d",
    "#a86437",
    "#e67a30",
    "#4ae364",
    "#99e550",
    "#d151ee",
    "#f873e4",
    "#9c3a2b",
    "#e64e35",
    "#f25a5a",
    "#ad8830",
    "#f7c756",
    "#306082",
    "#639bff",
    "#4dcced",
  ] as const,
};

// Swamp theme (2)
export const SUNNY_SWAMP: PaletteDef = {
  id: "sunny_swamp",
  name: "SunnySwamp (Lospec)",
  // Source: lospec.com/palette-list/sunnyswamp
  colors: [
    "#dbd1b4",
    "#d1ad82",
    "#98a681",
    "#6a9490",
    "#667580",
  ] as const,
};

export const SWAMP_KIN: PaletteDef = {
  id: "swamp_kin",
  name: "Swamp Kin (Lospec)",
  // Source: lospec.com/palette-list/swamp-kin
  colors: [
    "#1dbb61",
    "#76e671",
    "#c4f2b5",
    "#e3e9f2",
    "#e2449e",
    "#89198e",
    "#3b0d4a",
    "#1c160d",
  ] as const,
};

// Desert theme (2)
export const COBALT_DESERT_7: PaletteDef = {
  id: "cobalt_desert_7",
  name: "Cobalt Desert 7 (Lospec)",
  // Source: lospec.com/palette-list/cobalt-desert-7
  colors: [
    "#0c061b",
    "#17225c",
    "#3a2c75",
    "#93238b",
    "#ca1750",
    "#f94d15",
    "#fe981e",
  ] as const,
};

export const LOST_IN_THE_DESERT: PaletteDef = {
  id: "lost_in_the_desert",
  name: "lost in the desert (Lospec)",
  // Source: lospec.com/palette-list/lost-in-the-desert
  colors: [
    "#151244",
    "#60117f",
    "#922a95",
    "#be7dbc",
    "#350828",
    "#7f6962",
    "#f9cb60",
    "#f9960f",
    "#bc2f01",
    "#680703",
  ] as const,
};

export const PALETTES: readonly PaletteDef[] = [
  DB32,
  DIVINATION,
  CYBERPUNK,

  // Imported pools
  SUNSET_8,
  S_SUNSET7,
  MOONLIGHT_15,
  ST8_MOONLIGHT,
  NOIRE_TRUTH,
  CHROMA_NOIR,
  SUNNY_SWAMP,
  SWAMP_KIN,
  COBALT_DESERT_7,
  LOST_IN_THE_DESERT,
] as const;

export function getPaletteById(id: string): PaletteDef {
  const found = PALETTES.find((p) => p.id === id);
  return found ?? DB32;
}
