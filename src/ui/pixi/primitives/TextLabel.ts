import { Text } from "pixi.js";
import { TEXT_STYLES, type TextPresetName } from "../pixiTheme";

export function createTextLabel(text: string, preset: TextPresetName): Text {
  return new Text({ text, style: TEXT_STYLES[preset].clone() });
}
