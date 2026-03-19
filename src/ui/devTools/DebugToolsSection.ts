import type { DebugToolsSettings } from "../../settings/settingsTypes";
import {
  applyColumnMajorGridOrder,
  createSection,
  createSelectRow,
  createThreeColumnGrid,
  createToggleRow,
} from "./devToolsSectionHelpers";
import { SHADOW_SUN_V1_HOUR_OPTIONS, getShadowSunV1Model } from "../../shadowSunV1";

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

  const shadowSunHourSelect = createSelectRow(
    section,
    "Shadow Sun Time",
    SHADOW_SUN_V1_HOUR_OPTIONS,
    (value) => `${`${value}`.padStart(2, "0")}:00`,
    (value) => applyDebugPatch({ shadowSunTimeHour: value }),
  );

  const shadowV1DebugGeometryModeSelect = createSelectRow<DebugToolsSettings["shadowV1DebugGeometryMode"]>(
    section,
    "Shadow V1 Debug Geometry",
    ["full", "capOnly", "connectorsOnly"],
    (value) => value === "capOnly" ? "Cap Only" : value === "connectorsOnly" ? "Connectors Only" : "Full",
    (value) => applyDebugPatch({ shadowV1DebugGeometryMode: value }),
  );

  const shadowCasterModeSelect = createSelectRow<DebugToolsSettings["shadowCasterMode"]>(
    section,
    "Shadow Caster",
    ["v5TriangleShadowMask", "v4SliceStrips", "v3HybridTriangles", "v2AlphaSilhouette", "v1Roof"],
    (value) => (
      value === "v1Roof"
        ? "V1 Roof"
        : value === "v2AlphaSilhouette"
          ? "V2 Alpha Silhouette"
          : value === "v3HybridTriangles"
            ? "V3 Hybrid Triangles"
            : value === "v4SliceStrips"
              ? "V4 Slice Strips"
              : "V5 Triangle Shadow Mask"
    ),
    (value) => applyDebugPatch({ shadowCasterMode: value }),
  );

  const shadowHybridDiagnosticModeSelect = createSelectRow<DebugToolsSettings["shadowHybridDiagnosticMode"]>(
    section,
    "Triangle Shadow Diagnostic",
    ["off", "solidShadowPass", "solidMainCanvas"],
    (value) => (
      value === "solidShadowPass"
        ? "Flat Fill (Shadow Pass)"
        : value === "solidMainCanvas"
          ? "Flat Fill (Main Canvas)"
          : "Warped (Shadow Pass)"
    ),
    (value) => applyDebugPatch({ shadowHybridDiagnosticMode: value }),
  );

  const shadowDebugModeSelect = createSelectRow<DebugToolsSettings["shadowDebugMode"]>(
    section,
    "V4 Shadow Draw Mode",
    ["warpedOnly", "flatOnly", "both"],
    (value) => (
      value === "flatOnly"
        ? "Flat Only"
        : value === "both"
          ? "Both"
          : "Warped Only"
    ),
    (value) => applyDebugPatch({ shadowDebugMode: value }),
  );

  const shadowV5DebugViewSelect = createSelectRow<DebugToolsSettings["shadowV5DebugView"]>(
    section,
    "V5 Mask Debug View",
    ["finalOnly", "topMask", "eastWestMask", "southNorthMask", "all"],
    (value) => (
      value === "topMask"
        ? "Top Mask"
        : value === "eastWestMask"
          ? "East-West Mask"
          : value === "southNorthMask"
            ? "South-North Mask"
            : value === "all"
              ? "All Masks"
              : "Final Only"
    ),
    (value) => applyDebugPatch({ shadowV5DebugView: value }),
  );

  const shadowV5TransformDebugModeSelect = createSelectRow<DebugToolsSettings["shadowV5TransformDebugMode"]>(
    section,
    "V5 Mask Transform",
    ["deformed", "raw"],
    (value) => value === "raw" ? "Raw Mask" : "Deformed Mask",
    (value) => applyDebugPatch({ shadowV5TransformDebugMode: value }),
  );

  const shadowSunReadout = document.createElement("div");
  shadowSunReadout.style.padding = "2px 0 10px 0";
  shadowSunReadout.style.opacity = "0.85";
  shadowSunReadout.style.fontFamily = "var(--font-mono)";
  shadowSunReadout.style.fontSize = "11px";
  section.appendChild(shadowSunReadout);

  const syncShadowSunReadout = (timeHour: number) => {
    const sun = getShadowSunV1Model(timeHour);
    const f = sun.forward;
    const p = sun.projectionDirection;
    shadowSunReadout.textContent = `Sun ${sun.timeLabel} elev:${sun.elevationDeg.toFixed(1)}deg dir:${sun.directionLabel} forward(${f.x.toFixed(3)}, ${f.y.toFixed(3)}, ${f.z.toFixed(3)}) proj(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`;
  };

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
      shadowSunHourSelect.value = `${debug.shadowSunTimeHour}`;
      shadowV1DebugGeometryModeSelect.value = debug.shadowV1DebugGeometryMode;
      shadowCasterModeSelect.value = debug.shadowCasterMode;
      shadowHybridDiagnosticModeSelect.value = debug.shadowHybridDiagnosticMode;
      shadowDebugModeSelect.value = debug.shadowDebugMode;
      shadowV5DebugViewSelect.value = debug.shadowV5DebugView;
      shadowV5TransformDebugModeSelect.value = debug.shadowV5TransformDebugMode;
      const v5DebugViewActive = debug.shadowCasterMode === "v5TriangleShadowMask";
      shadowV5DebugViewSelect.disabled = !v5DebugViewActive;
      shadowV5DebugViewSelect.style.opacity = v5DebugViewActive ? "1" : "0.65";
      shadowV5TransformDebugModeSelect.disabled = !v5DebugViewActive;
      shadowV5TransformDebugModeSelect.style.opacity = v5DebugViewActive ? "1" : "0.65";
      syncShadowSunReadout(debug.shadowSunTimeHour);
      for (const [key, input] of Object.entries(controls)) {
        input.checked = !!(debug as any)[key];
      }
    },
  };
}
