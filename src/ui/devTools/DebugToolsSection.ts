import type { DebugToolsSettings } from "../../settings/settingsTypes";
import {
  applyColumnMajorGridOrder,
  createSection,
  createThreeColumnGrid,
  createToggleRow,
} from "./devToolsSectionHelpers";

export type DebugToolsSectionController = {
  sync(debug: DebugToolsSettings): void;
};

export function mountDebugToolsSection(
  root: HTMLElement,
  applyDebugPatch: (patch: Partial<DebugToolsSettings>) => void,
): DebugToolsSectionController {
  const section = createSection(
    root,
    "SECTION 1 - Debug Tools",
    "Visualization and diagnostics only. These controls write to settings.debug and default to OFF.",
  );

  const grid = createThreeColumnGrid(section);

  const controls = {
    grid: createToggleRow(grid, "Show Grid", (checked) => applyDebugPatch({ grid: checked })),
    walkMask: createToggleRow(grid, "Show Walk Mask", (checked) => applyDebugPatch({ walkMask: checked })),
    blockedTiles: createToggleRow(grid, "Show Blocked Tiles", (checked) => applyDebugPatch({ blockedTiles: checked })),
    ramps: createToggleRow(grid, "Show Ramps", (checked) => applyDebugPatch({ ramps: checked })),
    colliders: createToggleRow(grid, "Show Colliders", (checked) => applyDebugPatch({ colliders: checked })),
    slices: createToggleRow(grid, "Show Slices", (checked) => applyDebugPatch({ slices: checked })),
    occluders: createToggleRow(grid, "Show Occluders", (checked) => applyDebugPatch({ occluders: checked })),
    decals: createToggleRow(grid, "Show Decals", (checked) => applyDebugPatch({ decals: checked })),
    structureHeights: createToggleRow(grid, "Show Structure Heights", (checked) => applyDebugPatch({ structureHeights: checked })),
    spriteBounds: createToggleRow(grid, "Show Sprite Bounds", (checked) => applyDebugPatch({ spriteBounds: checked })),
    structureTriangleFootprint: createToggleRow(
      grid,
      "Structure Triangle Footprint",
      (checked) => applyDebugPatch({ structureTriangleFootprint: checked }),
    ),
    projectileFaces: createToggleRow(grid, "Show Projectile Faces", (checked) => applyDebugPatch({ projectileFaces: checked })),
    triggers: createToggleRow(grid, "Show Trigger Zones", (checked) => applyDebugPatch({ triggers: checked })),
    debugRoadSemantic: createToggleRow(grid, "Show Road Semantics", (checked) => applyDebugPatch({ debugRoadSemantic: checked })),
    entityAnchorOverlay: createToggleRow(grid, "Entity Anchor Overlay", (checked) => applyDebugPatch({ entityAnchorOverlay: checked })),
    enemyAimOverlay: createToggleRow(grid, "Enemy Aim Overlay", (checked) => applyDebugPatch({ enemyAimOverlay: checked })),
    lootGoblinOverlay: createToggleRow(grid, "Loot Goblin Overlay", (checked) => applyDebugPatch({ lootGoblinOverlay: checked })),
    dpsMeter: createToggleRow(grid, "DPS Meter", (checked) => applyDebugPatch({ dpsMeter: checked })),
    pauseDebugCards: createToggleRow(grid, "Pause Debug Cards", (checked) => applyDebugPatch({ pauseDebugCards: checked })),
    pauseCsvControls: createToggleRow(grid, "Pause CSV Controls", (checked) => applyDebugPatch({ pauseCsvControls: checked })),
    neutralBirdDrawDebug: createToggleRow(grid, "Neutral Bird Draw Debug", (checked) => applyDebugPatch({ neutralBirdDrawDebug: checked })),
    objectivesShowZoneBounds: createToggleRow(grid, "Objective Zone Bounds", (checked) => applyDebugPatch({ objectivesShowZoneBounds: checked })),
    entityAnchorsEnabled: createToggleRow(grid, "Render Entity Anchors", (checked) => applyDebugPatch({ entityAnchorsEnabled: checked })),
    renderPerfCountersEnabled: createToggleRow(grid, "Render Perf Counters", (checked) => applyDebugPatch({ renderPerfCountersEnabled: checked })),
    paletteHudDebugOverlayEnabled: createToggleRow(grid, "Palette HUD Debug Overlay", (checked) => applyDebugPatch({ paletteHudDebugOverlayEnabled: checked })),
  };

  applyColumnMajorGridOrder(grid, 3);

  return {
    sync(debug) {
      for (const [key, input] of Object.entries(controls)) {
        input.checked = !!(debug as any)[key];
      }
    },
  };
}
