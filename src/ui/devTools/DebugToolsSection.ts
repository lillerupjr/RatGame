import type { DebugToolsSettings } from "../../settings/settingsTypes";
import {
  applyColumnMajorGridOrder,
  createSection,
  createSelectRow,
  createSliderRow,
  createThreeColumnGrid,
  createToggleRow,
} from "./devToolsSectionHelpers";
import {
  SHADOW_SUN_V1_HOUR_OPTIONS,
  getShadowSunV1LightingState,
  SHADOW_SUN_V1_MAX_ELEVATION_OVERRIDE_DEG,
  SHADOW_SUN_V1_MIN_ELEVATION_OVERRIDE_DEG,
  clampShadowSunElevationOverrideDeg,
  formatShadowSunTimeLabel,
  getShadowSunV1Model,
} from "../../shadowSunV1";
import {
  SHADOW_SUN_CYCLE_MODE_OPTIONS,
  SHADOW_SUN_DAY_CYCLE_BASE_RATE_LABEL,
  SHADOW_SUN_DAY_CYCLE_SPEED_MULTIPLIERS,
  SHADOW_SUN_DAY_CYCLE_STEPS_PER_DAY_OPTIONS,
  formatShadowSunCycleModeLabel,
  formatShadowSunDayCycleSpeedLabel,
  formatShadowSunDayCycleStepsPerDayLabel,
  getShadowSunDayCycleStepSpanMinutes,
} from "../../shadowSunDayCycle";
import {
  STATIC_LIGHTS_AUTOMATIC_OFF_HOUR,
  STATIC_LIGHTS_AUTOMATIC_ON_HOUR,
  STATIC_LIGHT_CYCLE_OVERRIDE_OPTIONS,
  formatStaticLightCycleOverrideLabel,
} from "../../staticLightCycle";

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
  const shadowSunDayCycleToggle = createToggleRow(
    section,
    "Continuous Sun Mode",
    (checked) => applyDebugPatch({ shadowSunDayCycleEnabled: checked }),
  );
  const shadowSunCycleModeSelect = createSelectRow(
    section,
    "Sun Cycle Mode",
    SHADOW_SUN_CYCLE_MODE_OPTIONS,
    formatShadowSunCycleModeLabel,
    (value) => applyDebugPatch({ shadowSunCycleMode: value }),
  );
  const shadowSunDayCycleSpeedSelect = createSelectRow(
    section,
    "Day Cycle Speed",
    SHADOW_SUN_DAY_CYCLE_SPEED_MULTIPLIERS,
    formatShadowSunDayCycleSpeedLabel,
    (value) => applyDebugPatch({ shadowSunDayCycleSpeedMultiplier: value }),
  );
  const shadowSunStepsPerDaySelect = createSelectRow(
    section,
    "Steps Per Day",
    SHADOW_SUN_DAY_CYCLE_STEPS_PER_DAY_OPTIONS,
    formatShadowSunDayCycleStepsPerDayLabel,
    (value) => applyDebugPatch({ shadowSunStepsPerDay: value }),
  );
  const staticLightCycleOverrideSelect = createSelectRow(
    section,
    "Static Lights",
    STATIC_LIGHT_CYCLE_OVERRIDE_OPTIONS,
    formatStaticLightCycleOverrideLabel,
    (value) => applyDebugPatch({ staticLightCycleOverride: value }),
  );
  const shadowSunAzimuthSlider = createSliderRow(
    section,
    "Sun Azimuth (deg)",
    -1,
    359,
    1,
    (value) => applyDebugPatch({ shadowSunAzimuthDeg: value }),
  );
  const sunElevationOverrideToggle = createToggleRow(
    section,
    "Sun Elevation Override",
    (checked) => applyDebugPatch({ sunElevationOverrideEnabled: checked }),
  );
  const sunElevationOverrideSlider = createSliderRow(
    section,
    "Sun Elevation (deg)",
    SHADOW_SUN_V1_MIN_ELEVATION_OVERRIDE_DEG,
    SHADOW_SUN_V1_MAX_ELEVATION_OVERRIDE_DEG,
    1,
    (value) => applyDebugPatch({ sunElevationOverrideDeg: value }),
  );

  const shadowCasterModeSelect = createSelectRow<DebugToolsSettings["shadowCasterMode"]>(
    section,
    "Shadow Caster",
    ["v6SweepShadow", "v6FaceSliceDebug"],
    (value) => (
      value === "v6SweepShadow"
        ? "V6 Sweep Shadow"
        : "V6 Face Slice Debug"
    ),
    (value) => applyDebugPatch({ shadowCasterMode: value }),
  );

  const shadowV6SemanticBucketSelect = createSelectRow<DebugToolsSettings["shadowV6SemanticBucket"]>(
    section,
    "V6 Semantic Bucket",
    ["EAST_WEST", "SOUTH_NORTH", "TOP"],
    (value) => value === "EAST_WEST" ? "East-West" : value === "SOUTH_NORTH" ? "South-North" : "Top",
    (value) => applyDebugPatch({ shadowV6SemanticBucket: value }),
  );

  const shadowV6StructureIndexSlider = createSliderRow(
    section,
    "V6 Structure Slot",
    0,
    127,
    1,
    (value) => applyDebugPatch({ shadowV6StructureIndex: value }),
  );
  const shadowV6SliceCountSlider = createSliderRow(
    section,
    "V6 Slice Thickness Px",
    1,
    32,
    1,
    (value) => applyDebugPatch({ shadowV6SliceCount: value }),
  );
  const shadowV6AllStructuresToggle = createToggleRow(
    section,
    "V6 Cast All Structures",
    (checked) => applyDebugPatch(
      checked
        ? { shadowV6AllStructures: true, shadowV6OneStructureOnly: false }
        : { shadowV6AllStructures: false },
    ),
  );
  const shadowV6OneStructureOnlyToggle = createToggleRow(
    section,
    "V6 Cast One Structure",
    (checked) => applyDebugPatch(
      checked
        ? { shadowV6OneStructureOnly: true, shadowV6AllStructures: false }
        : { shadowV6OneStructureOnly: false },
    ),
  );
  const shadowV6VerticalOnlyToggle = createToggleRow(
    section,
    "V6 Vertical Only",
    (checked) => applyDebugPatch({ shadowV6VerticalOnly: checked }),
  );
  const shadowV6TopOnlyToggle = createToggleRow(
    section,
    "V6 Top Only",
    (checked) => applyDebugPatch({ shadowV6TopOnly: checked }),
  );
  const shadowV6ForceRefreshToggle = createToggleRow(
    section,
    "V6 Force Refresh",
    (checked) => applyDebugPatch({ shadowV6ForceRefresh: checked }),
  );
  const shadowV6FaceSliceDebugOverlayToggle = createToggleRow(
    section,
    "V6 Face Slice Debug",
    (checked) => applyDebugPatch({ shadowV6FaceSliceDebugOverlay: checked }),
  );

  const shadowSunReadout = document.createElement("div");
  shadowSunReadout.style.padding = "2px 0 10px 0";
  shadowSunReadout.style.opacity = "0.85";
  shadowSunReadout.style.fontFamily = "var(--font-mono)";
  shadowSunReadout.style.fontSize = "11px";
  section.appendChild(shadowSunReadout);

  const syncShadowSunReadout = (debug: DebugToolsSettings) => {
    const lightingState = getShadowSunV1LightingState(debug.shadowSunTimeHour, {
      shadowSunAzimuthDeg: debug.shadowSunAzimuthDeg,
      sunElevationOverrideEnabled: debug.sunElevationOverrideEnabled,
      sunElevationOverrideDeg: debug.sunElevationOverrideDeg,
    });
    const sun = lightingState.sunModel;
    const f = sun.forward;
    const p = sun.projectionDirection;
    const modeLabel = debug.sunElevationOverrideEnabled ? "override:on" : "override:off";
    const azLabel = debug.shadowSunAzimuthDeg >= 0 ? ` az:${debug.shadowSunAzimuthDeg}deg` : " az:auto";
    const stepSpanMinutes = getShadowSunDayCycleStepSpanMinutes(debug.shadowSunStepsPerDay, debug.shadowSunCycleMode);
    const cycleLabel = debug.shadowSunDayCycleEnabled
      ? ` cycle:on mode:${formatShadowSunCycleModeLabel(debug.shadowSunCycleMode)} speed:${formatShadowSunDayCycleSpeedLabel(debug.shadowSunDayCycleSpeedMultiplier)} steps:${debug.shadowSunStepsPerDay} span:${stepSpanMinutes.toFixed(1)}m base:${SHADOW_SUN_DAY_CYCLE_BASE_RATE_LABEL} seed:${formatShadowSunTimeLabel(debug.shadowSunTimeHour)} continuous:on`
      : ` cycle:off manual:${formatShadowSunTimeLabel(debug.shadowSunTimeHour)}`;
    const lightCycleLabel = debug.staticLightCycleOverride === "automatic"
      ? ` lights:auto(${`${STATIC_LIGHTS_AUTOMATIC_ON_HOUR}`.padStart(2, "0")}:00-${`${STATIC_LIGHTS_AUTOMATIC_OFF_HOUR}`.padStart(2, "0")}:00)`
      : ` lights:${formatStaticLightCycleOverrideLabel(debug.staticLightCycleOverride).toLowerCase()}`;
    shadowSunReadout.textContent = `Sun ${sun.timeLabel}${azLabel} elev:${sun.elevationDeg.toFixed(1)}deg ambElev:${lightingState.ambientSunLighting.ambientElevationDeg.toFixed(1)}deg ambDark:${lightingState.ambientSunLighting.ambientDarkness01.toFixed(3)} ${modeLabel}${cycleLabel}${lightCycleLabel} dir:${sun.directionLabel} forward(${f.x.toFixed(3)}, ${f.y.toFixed(3)}, ${f.z.toFixed(3)}) proj(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`;
  };

  const syncSunElevationOverrideReadout = (debug: DebugToolsSettings): void => {
    const clamped = clampShadowSunElevationOverrideDeg(debug.sunElevationOverrideDeg);
    sunElevationOverrideSlider.value.textContent = `${clamped.toFixed(1)}`;
  };

  const syncV6SliderReadouts = (debug: DebugToolsSettings): void => {
    shadowV6StructureIndexSlider.value.textContent = `${Math.round(debug.shadowV6StructureIndex)}`;
    shadowV6SliceCountSlider.value.textContent = `${Math.round(debug.shadowV6SliceCount)}`;
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
    showStructureSlices: createToggleRow(
      grid,
      "Show Structure Slices",
      (checked) => applyDebugPatch({ showStructureSlices: checked }),
    ),
    structureTriangleFootprint: createToggleRow(
      grid,
      "Structure Semantic Faces",
      (checked) => applyDebugPatch({ structureTriangleFootprint: checked }),
    ),
    showStructureAnchors: createToggleRow(
      grid,
      "Show Structure Anchors",
      (checked) => applyDebugPatch({ showStructureAnchors: checked }),
    ),
    showStructureTriangleOwnershipSort: createToggleRow(
      grid,
      "Triangle Ownership/Sort",
      (checked) => applyDebugPatch({ showStructureTriangleOwnershipSort: checked }),
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
    sweepShadowDebug: createToggleRow(grid, "Sweep Shadow Debug", (checked) => applyDebugPatch({ sweepShadowDebug: checked })),
    tileHeightMap: createToggleRow(grid, "Show Tile Height Map", (checked) => applyDebugPatch({ tileHeightMap: checked })),
  };

  applyColumnMajorGridOrder(grid, 3);

  return {
    sync(debug) {
      shadowSunHourSelect.value = `${debug.shadowSunTimeHour}`;
      shadowSunDayCycleToggle.checked = !!debug.shadowSunDayCycleEnabled;
      shadowSunCycleModeSelect.value = debug.shadowSunCycleMode;
      shadowSunDayCycleSpeedSelect.value = `${debug.shadowSunDayCycleSpeedMultiplier}`;
      shadowSunStepsPerDaySelect.value = `${debug.shadowSunStepsPerDay}`;
      staticLightCycleOverrideSelect.value = debug.staticLightCycleOverride;
      shadowSunCycleModeSelect.disabled = !debug.shadowSunDayCycleEnabled;
      shadowSunDayCycleSpeedSelect.disabled = !debug.shadowSunDayCycleEnabled;
      shadowSunStepsPerDaySelect.disabled = !debug.shadowSunDayCycleEnabled;
      shadowSunCycleModeSelect.style.opacity = debug.shadowSunDayCycleEnabled ? "1" : "0.65";
      shadowSunDayCycleSpeedSelect.style.opacity = debug.shadowSunDayCycleEnabled ? "1" : "0.65";
      shadowSunStepsPerDaySelect.style.opacity = debug.shadowSunDayCycleEnabled ? "1" : "0.65";
      shadowSunAzimuthSlider.input.value = `${debug.shadowSunAzimuthDeg}`;
      shadowSunAzimuthSlider.value.textContent = debug.shadowSunAzimuthDeg >= 0 ? `${debug.shadowSunAzimuthDeg}` : "auto";
      sunElevationOverrideToggle.checked = !!debug.sunElevationOverrideEnabled;
      sunElevationOverrideSlider.input.value = `${clampShadowSunElevationOverrideDeg(debug.sunElevationOverrideDeg)}`;
      sunElevationOverrideSlider.input.disabled = !debug.sunElevationOverrideEnabled;
      sunElevationOverrideSlider.input.style.opacity = debug.sunElevationOverrideEnabled ? "1" : "0.65";
      sunElevationOverrideSlider.value.style.opacity = debug.sunElevationOverrideEnabled ? "1" : "0.65";
      shadowCasterModeSelect.value = debug.shadowCasterMode;
      shadowV6SemanticBucketSelect.value = debug.shadowV6SemanticBucket;
      shadowV6StructureIndexSlider.input.value = `${Math.round(debug.shadowV6StructureIndex)}`;
      shadowV6SliceCountSlider.input.value = `${Math.round(debug.shadowV6SliceCount)}`;
      shadowV6AllStructuresToggle.checked = !!debug.shadowV6AllStructures;
      shadowV6OneStructureOnlyToggle.checked = !!debug.shadowV6OneStructureOnly;
      shadowV6VerticalOnlyToggle.checked = !!debug.shadowV6VerticalOnly;
      shadowV6TopOnlyToggle.checked = !!debug.shadowV6TopOnly;
      shadowV6ForceRefreshToggle.checked = !!debug.shadowV6ForceRefresh;
      shadowV6FaceSliceDebugOverlayToggle.checked = !!debug.shadowV6FaceSliceDebugOverlay;
      const v6DebugViewActive = debug.shadowCasterMode === "v6FaceSliceDebug";
      shadowV6SemanticBucketSelect.disabled = !v6DebugViewActive;
      shadowV6SemanticBucketSelect.style.opacity = v6DebugViewActive ? "1" : "0.65";
      shadowV6StructureIndexSlider.input.disabled = !v6DebugViewActive;
      shadowV6SliceCountSlider.input.disabled = !v6DebugViewActive;
      shadowV6StructureIndexSlider.input.style.opacity = v6DebugViewActive ? "1" : "0.65";
      shadowV6SliceCountSlider.input.style.opacity = v6DebugViewActive ? "1" : "0.65";
      shadowV6StructureIndexSlider.value.style.opacity = v6DebugViewActive ? "1" : "0.65";
      shadowV6SliceCountSlider.value.style.opacity = v6DebugViewActive ? "1" : "0.65";
      shadowV6AllStructuresToggle.disabled = !v6DebugViewActive;
      shadowV6AllStructuresToggle.style.opacity = v6DebugViewActive ? "1" : "0.65";
      shadowV6OneStructureOnlyToggle.disabled = !v6DebugViewActive;
      shadowV6OneStructureOnlyToggle.style.opacity = v6DebugViewActive ? "1" : "0.65";
      shadowV6VerticalOnlyToggle.disabled = !v6DebugViewActive;
      shadowV6VerticalOnlyToggle.style.opacity = v6DebugViewActive ? "1" : "0.65";
      shadowV6TopOnlyToggle.disabled = !v6DebugViewActive;
      shadowV6TopOnlyToggle.style.opacity = v6DebugViewActive ? "1" : "0.65";
      shadowV6ForceRefreshToggle.disabled = !v6DebugViewActive;
      shadowV6ForceRefreshToggle.style.opacity = v6DebugViewActive ? "1" : "0.65";
      shadowV6FaceSliceDebugOverlayToggle.disabled = !v6DebugViewActive;
      if (shadowV6FaceSliceDebugOverlayToggle.parentElement) {
        shadowV6FaceSliceDebugOverlayToggle.parentElement.style.display = v6DebugViewActive ? "flex" : "none";
      }
      syncShadowSunReadout(debug);
      syncSunElevationOverrideReadout(debug);
      syncV6SliderReadouts(debug);
      for (const [key, input] of Object.entries(controls)) {
        input.checked = !!(debug as any)[key];
      }
    },
  };
}
