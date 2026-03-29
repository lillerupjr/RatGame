import type { PaletteId } from "./mapSkins";

export type AuthoredDelvePaletteEntry = {
  paletteId: PaletteId;
  saturationWeight: number;
  darkness: number;
  enabledForRandomDelvePicker: boolean;
};

export const AUTHORED_DELVE_PALETTE_ENTRIES: readonly AuthoredDelvePaletteEntry[] = [
  { paletteId: "db32", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
  { paletteId: "divination", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
  { paletteId: "cyberpunk", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
  { paletteId: "moonlight_15", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
  { paletteId: "st8_moonlight", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
  { paletteId: "chroma_noir", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
  { paletteId: "swamp_kin", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
  { paletteId: "lost_in_the_desert", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
  { paletteId: "endesga_16", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
  { paletteId: "sweetie_16", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
  { paletteId: "dawnbringer_16", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
  { paletteId: "night_16", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
  { paletteId: "reha_16", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
  { paletteId: "arne_16", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
  { paletteId: "lush_sunset", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
  { paletteId: "vaporhaze_16", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
  { paletteId: "sunset_cave_extended", saturationWeight: 0.75, darkness: 0.5, enabledForRandomDelvePicker: true },
] as const;
