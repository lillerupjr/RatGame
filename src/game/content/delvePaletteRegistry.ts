import type { PaletteId } from "./mapSkins";

export type AuthoredDelvePaletteEntry = {
  paletteId: PaletteId;
  saturationWeight: number;
  darkness: number;
  enabledForRandomDelvePicker: boolean;
};

export const AUTHORED_DELVE_PALETTE_ENTRIES: readonly AuthoredDelvePaletteEntry[] = [
  { paletteId: "db32", saturationWeight: 0.0, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "divination", saturationWeight: 0.50, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "cyberpunk", saturationWeight: 0.50, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "moonlight_15", saturationWeight: 0.75, darkness: 0.0, enabledForRandomDelvePicker: false },
  { paletteId: "st8_moonlight", saturationWeight: 0.75, darkness: 0.0, enabledForRandomDelvePicker: false },
  { paletteId: "chroma_noir", saturationWeight: 0.75, darkness: 0.0, enabledForRandomDelvePicker: false },
  { paletteId: "swamp_kin", saturationWeight: 0.75, darkness: 0.0, enabledForRandomDelvePicker: false },
  { paletteId: "lost_in_the_desert", saturationWeight: 0.75, darkness: 0.0, enabledForRandomDelvePicker: false },
  { paletteId: "endesga_16", saturationWeight: 0.25, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "sweetie_16", saturationWeight: 0.75, darkness: 0.0, enabledForRandomDelvePicker: false },
  { paletteId: "dawnbringer_16", saturationWeight: 0.50, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "night_16", saturationWeight: 0.75, darkness: 0.0, enabledForRandomDelvePicker: false },
  { paletteId: "fun_16", saturationWeight: 0.50, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "reha_16", saturationWeight: 0.75, darkness: 0.0, enabledForRandomDelvePicker: false },
  { paletteId: "arne_16", saturationWeight: 0.75, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "lush_sunset", saturationWeight: 0.50, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "vaporhaze_16", saturationWeight: 0.75, darkness: 0.0, enabledForRandomDelvePicker: false },
  { paletteId: "sunset_cave_extended", saturationWeight: 0.25, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "midnight_ablaze", saturationWeight: 0.25, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "blessing", saturationWeight: 0.50, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "hollow", saturationWeight: 0.50, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "berry_nebula", saturationWeight: 0.25, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "cyclope6", saturationWeight: 0.25, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "bloodmoon21", saturationWeight: 0.0, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "blk_aqu4", saturationWeight: 0.50, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "dustbyte", saturationWeight: 0.50, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "hydrangea_11", saturationWeight: 0.75, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "fiery_plague_gb", saturationWeight: 0.25, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "leopolds_dreams", saturationWeight: 0.50, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "look_of_horror", saturationWeight: 0.50, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "aquaverse", saturationWeight: 0.25, darkness: 0.0, enabledForRandomDelvePicker: true },
  { paletteId: "sunraze", saturationWeight: 0.25, darkness: 0.0, enabledForRandomDelvePicker: true },
] as const;
