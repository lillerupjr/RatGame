import type { RenderKey } from "../worldRenderOrdering";

export type RenderPass = "GROUND" | "WORLD" | "SCREEN";

export type CommandKind =
  | "sprite"
  | "decal"
  | "triangle"
  | "primitive"
  | "light"
  | "overlay"
  | "debug";

export type CommandStage = "slice" | "band" | "tail";

export type CommandData = {
  variant: string;
  stage?: CommandStage;
  zBand?: number | "FIRST";
  [key: string]: unknown;
};

export interface RenderCommand {
  pass: RenderPass;
  key: RenderKey;
  kind: CommandKind;
  data: CommandData;
}

export interface RenderFrame {
  ground: RenderCommand[];
  world: RenderCommand[];
  screen: RenderCommand[];
}
