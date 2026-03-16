import { hexToRgb, rgbToHsv, type Hsv } from "./colorMath";

export type HexColor = `#${string}`;

export type PaletteGroup = "live" | "test";

export const PALETTE_GROUPS: readonly PaletteGroup[] = ["live", "test"] as const;

export function normalizePaletteGroup(value: unknown): PaletteGroup {
  return value === "test" ? "test" : "live";
}

export type PaletteDef = {
  id: string;
  name: string;
  group: PaletteGroup;
  source?: "built_in" | "lospec";
  colors: readonly HexColor[];
};

export const DB32: PaletteDef = {
  id: "db32",
  name: "DawnBringer 32",
  group: "live",
  source: "built_in",
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
  group: "live",
  source: "lospec",
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
  group: "live",
  source: "built_in",
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

export const ENDESGA_16: PaletteDef = {
  id: "endesga_16",
  name: "Endesga 16",
  group: "live",
  source: "lospec",
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
  group: "live",
  source: "lospec",
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
  group: "live",
  source: "lospec",
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
  group: "live",
  source: "lospec",
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
  group: "live",
  source: "lospec",
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
  group: "live",
  source: "lospec",
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
  group: "live",
  source: "lospec",
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
  group: "live",
  source: "lospec",
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
  group: "live",
  source: "lospec",
  colors: [
    "#0d0c1d", "#1f1d3a", "#3b2a5f", "#593196",
    "#7b42c5", "#a86ee3", "#e0b5ff", "#f7e8ff",
    "#1d4d4f", "#2d7a7e", "#3fb3b8", "#6ae3e8",
    "#a2fffd", "#ff4d7d", "#ffb85c", "#fff07a",
  ] as const,
};

export const SUNSET_CAVE_EXTENDED: PaletteDef = {
  id: "sunset_cave_extended",
  name: "SCE",
  group: "live",
  source: "lospec",
  colors: [
    "#120317", "#2a0b3d", "#4e1b63", "#6d2b8b",
    "#8b3bb4", "#a64fe0", "#c27cff", "#e1b3ff",
    "#2b1b10", "#4d2a16", "#7a3f1f", "#b05c2b",
    "#e07b3a", "#ff9d4d", "#ffd37a", "#fff1c7",
  ] as const,
};

export const MIDNIGHT_ABLAZE: PaletteDef = {
  id: "midnight_ablaze",
  name: "Midnight ablaze",
  group: "test",
  source: "lospec",
  colors: [
    "#ff8274", // rgb(255, 130, 116)
    "#d53c6a", // rgb(213, 60, 106)
    "#7c183c", // rgb(124, 24, 60)
    "#460e2b", // rgb(70, 14, 43)
    "#31051e", // rgb(49, 5, 30)
    "#1f0510", // rgb(31, 5, 16)
    "#130208", // rgb(19, 2, 8)
  ] as const,
};

export const BLESSING: PaletteDef = {
  id: "blessing",
  name: "Blessing",
  group: "test",
  source: "lospec",
  colors: [
    "#74569b", // rgb(116, 86, 155)
    "#96fbc7", // rgb(150, 251, 199)
    "#f7ffae", // rgb(247, 255, 174)
    "#ffb3cb", // rgb(255, 179, 203)
    "#d8bfd8", // rgb(216, 191, 216)
  ] as const,
};

export const HOLLOW: PaletteDef = {
  id: "hollow",
  name: "Hollow",
  group: "test",
  source: "lospec",
  colors: [
    "#0f0f1b", // rgb(15, 15, 27)
    "#565a75", // rgb(86, 90, 117)
    "#c6b7be", // rgb(198, 183, 190)
    "#fafbf6", // rgb(250, 251, 246)
  ] as const,
};

export const BERRY_NEBULA: PaletteDef = {
  id: "berry_nebula",
  name: "Berry Nebula",
  group: "test",
  source: "lospec",
  colors: [
    "#6ceded", // rgb(108, 237, 237)
    "#6cb9c9", // rgb(108, 185, 201)
    "#6d85a5", // rgb(109, 133, 165)
    "#6e5181", // rgb(110, 81, 129)
    "#6f1d5c", // rgb(111, 29, 92)
    "#4f1446", // rgb(79, 20, 70)
    "#2e0a30", // rgb(46, 10, 48)
    "#0d001a", // rgb(13, 0, 26)
  ] as const,
};

export const CYCLOPE6: PaletteDef = {
  id: "cyclope6",
  name: "Cyclope6",
  group: "test",
  source: "lospec",
  colors: [
    "#411d31", // rgb(65, 29, 49)
    "#631b34", // rgb(99, 27, 52)
    "#32535f", // rgb(50, 83, 95)
    "#0b8a8f", // rgb(11, 138, 143)
    "#0eaf9b", // rgb(14, 175, 155)
    "#30e1b9", // rgb(48, 225, 185)
  ] as const,
};

export const BLOODMOON21: PaletteDef = {
  id: "bloodmoon21",
  name: "BloodMoon21",
  group: "test",
  source: "lospec",
  colors: [
    "#130310",
    "#1d0518",
    "#270721",
    "#3c0921",
    "#520b20",
    "#7d0f1f",
    "#a8141d",
    "#d3181c",
    "#ff252b",
  ] as const,
};

export const BLK_AQU4: PaletteDef = {
  id: "blk_aqu4",
  name: "BLK AQU4",
  group: "test",
  source: "lospec",
  colors: [
    "#0a0f14",
    "#1a2a2f",
    "#2e5963",
    "#49a6a6",
  ] as const,
};

export const DUSTBYTE: PaletteDef = {
  id: "dustbyte",
  name: "dustbyte",
  group: "test",
  source: "lospec",
  colors: [
    "#1b1a1f",
    "#3a2d3f",
    "#6a4a5b",
    "#a86f6f",
    "#d6a37a",
    "#f2d3a0",
  ] as const,
};

export const HYDRANGEA_11: PaletteDef = {
  id: "hydrangea_11",
  name: "Hydrangea 11",
  group: "test",
  source: "lospec",
  colors: [
    "#1e1c3a",
    "#3a2c6d",
    "#5a4bb3",
    "#7c6fe5",
    "#a8a4ff",
    "#d1d1ff",
    "#f1eaff",
    "#c6b7ff",
    "#9d8ff7",
    "#7466d8",
    "#4a4aa3",
  ] as const,
};

export const FIERY_PLAGUE_GB: PaletteDef = {
  id: "fiery_plague_gb",
  name: "Fiery Plague GB",
  group: "test",
  source: "lospec",
  colors: [
    "#1b0c0c",
    "#5a1e1e",
    "#a33b2f",
    "#ff7a3d",
  ] as const,
};

export const LEOPOLDS_DREAMS: PaletteDef = {
  id: "leopolds_dreams",
  name: "Leopold's Dreams",
  group: "test",
  source: "lospec",
  colors: [
    "#120c2c",
    "#2a1f4f",
    "#513b8f",
    "#7f6ad6",
    "#b0a6ff",
    "#e2dcff",
  ] as const,
};

export const LOOK_OF_HORROR: PaletteDef = {
  id: "look_of_horror",
  name: "Look of Horror",
  group: "test",
  source: "lospec",
  colors: [
    "#0b0b0b",
    "#1a1a1a",
    "#3a1f1f",
    "#6a2323",
    "#a52a2a",
    "#e84545",
  ] as const,
};

export const AQUAVERSE: PaletteDef = {
  id: "aquaverse",
  name: "Aquaverse",
  group: "test",
  source: "lospec",
  colors: [
    "#0c1b2a",
    "#153e5c",
    "#1f6f8b",
    "#2aa7b8",
    "#7dd0d6",
    "#d0f4f7",
  ] as const,
};

export const SUNRAZE: PaletteDef = {
  id: "sunraze",
  name: "Sunraze",
  group: "test",
  source: "lospec",
  colors: [
    "#1b0c1b",
    "#3a1e3a",
    "#5b2e5b",
    "#7a3f7a",
    "#a04aa0",
    "#d06ad0",
    "#ff8cff",
    "#ffb38c",
    "#ff7a5a",
    "#ff4a3a",
    "#ff2a1f",
    "#d11c1c",
    "#8c1111",
    "#4a0707",
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
  MIDNIGHT_ABLAZE,
  BLESSING,
  HOLLOW,
  BERRY_NEBULA,
  CYCLOPE6,
  BLOODMOON21,
  BLK_AQU4,
  DUSTBYTE,
  HYDRANGEA_11,
  FIERY_PLAGUE_GB,
  LEOPOLDS_DREAMS,
  LOOK_OF_HORROR,
  AQUAVERSE,
  SUNRAZE,
] as const;

const paletteHueAnchorsById = new Map<string, readonly number[]>();
const paletteHsvAnchorsById = new Map<string, readonly PaletteHsvAnchor[]>();

export type PaletteHsvAnchor = Readonly<Pick<Hsv, "h" | "s" | "v">>;

export function getPalettesByGroup(group: PaletteGroup): readonly PaletteDef[] {
  return PALETTES.filter((palette) => palette.group === group);
}

export function getFirstPaletteInGroup(group: PaletteGroup): PaletteDef {
  const palettes = getPalettesByGroup(group);
  return palettes[0] ?? DB32;
}

export function getNextPaletteInGroup(currentId: string, group: PaletteGroup): PaletteDef {
  const palettes = getPalettesByGroup(group);
  if (palettes.length === 0) return DB32;

  const index = palettes.findIndex((palette) => palette.id === currentId);
  if (index < 0) return palettes[0];

  return palettes[(index + 1) % palettes.length];
}

export function isPaletteIdInGroup(id: string, group: PaletteGroup): boolean {
  return getPalettesByGroup(group).some((palette) => palette.id === id);
}

export function getPaletteById(id: string): PaletteDef {
  const found = PALETTES.find((p) => p.id === id);
  return found ?? DB32;
}

export function getPaletteHueAnchors(id: string): readonly number[] {
  const palette = getPaletteById(id);
  const cached = paletteHueAnchorsById.get(palette.id);
  if (cached) return cached;

  const anchors = Object.freeze(
    getPaletteHsvAnchors(palette.id).map((anchor) => anchor.h),
  ) as readonly number[];
  paletteHueAnchorsById.set(palette.id, anchors);
  return anchors;
}

export function getPaletteHsvAnchors(id: string): readonly PaletteHsvAnchor[] {
  const palette = getPaletteById(id);
  const cached = paletteHsvAnchorsById.get(palette.id);
  if (cached) return cached;

  const anchors = Object.freeze(
    palette.colors.map((hex) => {
      const hsv = rgbToHsv(hexToRgb(hex));
      return Object.freeze({
        h: hsv.h,
        s: hsv.s,
        v: hsv.v,
      });
    }),
  ) as readonly PaletteHsvAnchor[];
  paletteHsvAnchorsById.set(palette.id, anchors);
  return anchors;
}
