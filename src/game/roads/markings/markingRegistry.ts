export type RoadMarkingFeaturePreset = {
  center: boolean;
  edge: boolean;
  divider: boolean;
};

const WIDTH_PRESETS: Record<number, RoadMarkingFeaturePreset> = {
  1: { center: false, edge: false, divider: false }, // 0 lane
  2: { center: false, edge: true, divider: false },  // 1 lane
  3: { center: true, edge: true, divider: false },   // 2 lanes
  4: { center: true, edge: true, divider: false },   // temporary 2-lane treatment
  5: { center: true, edge: true, divider: true },    // 4 lanes
};

export function resolveMarkingPresetForWidth(widthTiles: number): RoadMarkingFeaturePreset {
  const w = Math.max(1, widthTiles | 0);
  if (WIDTH_PRESETS[w]) return WIDTH_PRESETS[w];
  if (w > 5) return WIDTH_PRESETS[2];
  return WIDTH_PRESETS[1];
}
