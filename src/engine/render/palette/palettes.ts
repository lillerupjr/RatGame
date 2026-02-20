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

export const PALETTES: readonly PaletteDef[] = [DB32, DIVINATION] as const;

export function getPaletteById(id: string): PaletteDef {
  const found = PALETTES.find((p) => p.id === id);
  return found ?? DB32;
}
