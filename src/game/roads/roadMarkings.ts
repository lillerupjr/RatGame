import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";

export const ROAD_CENTER_MARKING_VARIANT_INDEX = 1;
export const ROAD_STOP_BAR_VARIANT_INDEX = 2;
export const ROAD_CROSSING_VARIANT_INDEX = 3;
export const ROAD_CROSSING_FULL_VARIANT_INDEX = 5;
// One shared stopbar crossing offset (tile units), applied along tile direction.
export const ROAD_STOP_CROSSING_OFFSET_TILES = -0.40;
export const LINE_WIDTH_PX = 12;
export const DOUBLE_LINE_GAP_PX = 0;
export const DOUBLE_LINE_OFFSET_TILES =
  (DOUBLE_LINE_GAP_PX * 0.5 + LINE_WIDTH_PX * 0.5) / KENNEY_TILE_WORLD;
