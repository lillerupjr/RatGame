import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";

export const ROAD_CENTER_MARKING_VARIANT_INDEX = 1;
export const LINE_WIDTH_PX = 12;
export const DOUBLE_LINE_GAP_PX = 0;
export const DOUBLE_LINE_OFFSET_TILES =
  (DOUBLE_LINE_GAP_PX * 0.5 + LINE_WIDTH_PX * 0.5) / KENNEY_TILE_WORLD;
