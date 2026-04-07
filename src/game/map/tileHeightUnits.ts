import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { HEIGHT_UNIT_PX } from "../content/buildings";

export type TileHeightGrid = {
    originTx: number;
    originTy: number;
    width: number;
    height: number;
    version: string;
    heights: Float32Array;
};

export const TILE_HEIGHT_PER_RENDER_HEIGHT_UNIT = HEIGHT_UNIT_PX / KENNEY_TILE_WORLD;

export function renderHeightUnitsToTileHeight(heightUnits: number): number {
  return heightUnits * TILE_HEIGHT_PER_RENDER_HEIGHT_UNIT;
}

export function pixelHeightToTileHeight(pixelHeight: number): number {
  return pixelHeight / KENNEY_TILE_WORLD;
}

export function formatTileHeight(value: number): string {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-3) return `${rounded}`;
  return value.toFixed(2).replace(/\.?0+$/, "");
}
