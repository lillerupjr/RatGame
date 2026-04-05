import {
  getFirstPaletteInGroup,
  getPalettesByGroup,
  normalizePaletteGroup,
  PALETTE_GROUPS,
} from "../../engine/render/palette/palettes";
import {
  DEFAULT_HOSTILE_SPAWN_BURST_CHANCE,
  DEFAULT_HOSTILE_SPAWN_BURST_EXTRA_ATTEMPTS,
  DEFAULT_HOSTILE_SPAWN_HEAT_HEALTH_FACTOR,
  DEFAULT_HOSTILE_SPAWN_HEAT_POWER_PER_SEC_FACTOR,
  DEFAULT_HOSTILE_SPAWN_HEAT_THREAT_CAP_FACTOR,
  DEFAULT_HOSTILE_SPAWN_MIN_INTERVAL_SEC,
  DEFAULT_HOSTILE_SPAWN_OVERTIME_LIVE_THREAT_CAP_SLOPE,
  DEFAULT_HOSTILE_SPAWN_OVERTIME_POWER_PER_SEC_SLOPE,
  DEFAULT_HOSTILE_SPAWN_STOCKPILE_MULTIPLIER,
  DEFAULT_HOSTILE_SPAWN_T0_LIVE_THREAT_CAP,
  DEFAULT_HOSTILE_SPAWN_T0_POWER_PER_SEC,
  DEFAULT_HOSTILE_SPAWN_T120_LIVE_THREAT_CAP,
  DEFAULT_HOSTILE_SPAWN_T120_POWER_PER_SEC,
  NEUTRAL_BIRD_FORCE_STATES,
  PALETTE_REMAP_WEIGHT_OPTIONS,
  resolveEffectiveWorldAtlasMode,
} from "../../settings/systemOverrides";
import type { SystemOverrides } from "../../settings/settingsTypes";
import { getSettings } from "../../settings/settingsStore";
import { resolveRenderBackendSelection } from "../../game/systems/presentation/backend/renderBackendSelection";
import {
  getRenderableWebGLWorldSurface,
  getWebGLWorldSurfaceFailureReason,
} from "../../game/systems/presentation/backend/webglSurface";
import {
  applyButtonStyle,
  applyColumnMajorGridOrder,
  applySelectStyle,
  createSection,
  createSelectRow,
  createSliderRow,
  createSubsectionGrid,
  createToggleRow,
} from "./devToolsSectionHelpers";

export type SystemOverridesSectionController = {
  sync(system: SystemOverrides): void;
};

export function mountSystemOverridesSection(
  root: HTMLElement,
  applySystemPatch: (patch: Partial<SystemOverrides>) => void,
): SystemOverridesSectionController {
  const section = createSection(
    root,
    "SECTION 2 - System Overrides",
    "Runtime behavior modifiers. These controls are dangerous and write to settings.system only.",
    true,
  );

  const renderingGrid = createSubsectionGrid(section, "Rendering Overrides");
  const lightingGrid = createSubsectionGrid(section, "Lighting / Palette Overrides");
  const gameplayGrid = createSubsectionGrid(section, "Gameplay Overrides");
  const aiGrid = createSubsectionGrid(section, "AI Overrides");
  const hostileSpawnGrid = createSubsectionGrid(section, "Hostile Spawn Overrides");

  const entityShadowsDisable = createToggleRow(renderingGrid, "Disable Entity Shadows", (checked) => {
    applySystemPatch({ entityShadowsDisable: checked });
  });
  const structureTriangleAdmissionMode = createSelectRow<SystemOverrides["structureTriangleAdmissionMode"]>(
    renderingGrid,
    "Structure Triangle Admission",
    import.meta.env.DEV ? ["hybrid", "viewport", "renderDistance", "compare"] : ["hybrid", "viewport", "renderDistance"],
    (value) => value,
    (value) => applySystemPatch({ structureTriangleAdmissionMode: value }),
  );
  const structureTriangleCutoutEnabled = createToggleRow(renderingGrid, "Structure Triangle Cutout", (checked) => {
    applySystemPatch({ structureTriangleCutoutEnabled: checked });
  });
  const structureTriangleCutoutWidth = createSelectRow(
    renderingGrid,
    "Structure Cutout Width",
    [0, 1, 2, 3, 4, 5, 6, 8, 10, 12] as const,
    (value) => `${value}`,
    (value) => applySystemPatch({ structureTriangleCutoutWidth: value }),
  );
  const structureTriangleCutoutHeight = createSelectRow(
    renderingGrid,
    "Structure Cutout Height",
    [0, 1, 2, 3, 4, 5, 6, 8, 10, 12] as const,
    (value) => `${value}`,
    (value) => applySystemPatch({ structureTriangleCutoutHeight: value }),
  );
  const structureTriangleCutoutAlpha = createSelectRow(
    renderingGrid,
    "Structure Cutout Alpha",
    [0, 0.1, 0.2, 0.3, 0.4, 0.45, 0.5, 0.6, 0.75, 0.9, 1] as const,
    (value) => `${Math.round(value * 100)}%`,
    (value) => applySystemPatch({ structureTriangleCutoutAlpha: value }),
  );
  const tileRenderRadius = createSelectRow(
    renderingGrid,
    "Tile Render Radius",
    [-12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const,
    (value) => `${value}`,
    (value) => applySystemPatch({ tileRenderRadius: value }),
  );
  const worldAtlasMode = createSelectRow<SystemOverrides["worldAtlasMode"]>(
    renderingGrid,
    "World Atlas Mode",
    ["auto", "dual", "shared"],
    (value) => value,
    (value) => applySystemPatch({ worldAtlasMode: value }),
  );
  const worldAtlasEffectiveRow = document.createElement("label");
  worldAtlasEffectiveRow.style.display = "flex";
  worldAtlasEffectiveRow.style.alignItems = "center";
  worldAtlasEffectiveRow.style.justifyContent = "space-between";
  worldAtlasEffectiveRow.style.gap = "10px";
  worldAtlasEffectiveRow.style.padding = "3px 0";
  const worldAtlasEffectiveLabel = document.createElement("span");
  worldAtlasEffectiveLabel.textContent = "World Atlas Effective";
  const worldAtlasEffectiveValue = document.createElement("span");
  worldAtlasEffectiveValue.style.opacity = "0.85";
  worldAtlasEffectiveValue.style.fontWeight = "700";
  worldAtlasEffectiveRow.appendChild(worldAtlasEffectiveLabel);
  worldAtlasEffectiveRow.appendChild(worldAtlasEffectiveValue);
  renderingGrid.appendChild(worldAtlasEffectiveRow);
  const disableVisualCompiledCutoutCache = createToggleRow(renderingGrid, "Disable Compiled Cutout Cache", (checked) => {
    applySystemPatch({ disableVisualCompiledCutoutCache: checked });
  });
  const mapOverlaysDisabled = createToggleRow(renderingGrid, "Disable Map Overlays", (checked) => {
    applySystemPatch({ mapOverlaysDisabled: checked });
  });
  const rampFaces = createToggleRow(renderingGrid, "Show Ramp Faces", (checked) => {
    applySystemPatch({ rampFaces: checked });
  });

  const paletteSwapEnabled = createToggleRow(lightingGrid, "Palette Override Enabled", (checked) => {
    applySystemPatch({ paletteSwapEnabled: checked });
  });
  const paletteGroup = createSelectRow(lightingGrid, "Palette Group", PALETTE_GROUPS, (value) => value, (value) => {
    const firstPalette = getFirstPaletteInGroup(value).id;
    applySystemPatch({ paletteGroup: value, paletteId: firstPalette });
  });
  const paletteId = document.createElement("select");
  applySelectStyle(paletteId);
  const paletteIdRow = document.createElement("label");
  paletteIdRow.style.display = "flex";
  paletteIdRow.style.alignItems = "center";
  paletteIdRow.style.justifyContent = "space-between";
  paletteIdRow.style.gap = "10px";
  paletteIdRow.style.padding = "3px 0";
  const paletteIdLabel = document.createElement("span");
  paletteIdLabel.textContent = "Palette";
  paletteIdRow.appendChild(paletteIdLabel);
  paletteIdRow.appendChild(paletteId);
  lightingGrid.appendChild(paletteIdRow);

  const lightColorMode = createSelectRow<SystemOverrides["lightColorModeOverride"]>(
    lightingGrid,
    "Light Mode",
    ["authored", "off", "standard", "palette"],
    (value) => value,
    (value) => applySystemPatch({ lightColorModeOverride: value }),
  );
  const lightStrength = createSelectRow<SystemOverrides["lightStrengthOverride"]>(
    lightingGrid,
    "Light Strength",
    ["authored", "low", "medium", "high"],
    (value) => value,
    (value) => applySystemPatch({ lightStrengthOverride: value }),
  );
  const paletteSWeightPercent = createSelectRow(
    lightingGrid,
    "Palette Saturation Weight",
    PALETTE_REMAP_WEIGHT_OPTIONS,
    (value) => `${value}%`,
    (value) => applySystemPatch({ paletteSWeightPercent: value as SystemOverrides["paletteSWeightPercent"] }),
  );
  const paletteDarknessPercent = createSelectRow(
    lightingGrid,
    "Palette Darkness",
    PALETTE_REMAP_WEIGHT_OPTIONS,
    (value) => `${value}%`,
    (value) => applySystemPatch({ paletteDarknessPercent: value as SystemOverrides["paletteDarknessPercent"] }),
  );
  const darknessMaskDebugDisabled = createToggleRow(lightingGrid, "Disable Darkness Mask", (checked) => {
    applySystemPatch({ darknessMaskDebugDisabled: checked });
  });

  const gameSpeed = createSliderRow(gameplayGrid, "Game Speed", 0.5, 1.5, 0.05, (value) => {
    applySystemPatch({ gameSpeed: value });
  });
  const godMode = createToggleRow(gameplayGrid, "God Mode", (checked) => {
    applySystemPatch({ godMode: checked });
  });
  const dmgMult = createSelectRow(
    gameplayGrid,
    "Damage Mult",
    [0.25, 0.5, 1, 2, 5, 10] as const,
    (value) => `${value}x`,
    (value) => applySystemPatch({ dmgMult: value }),
  );
  const fireRateMult = createSelectRow(
    gameplayGrid,
    "Fire Rate Mult",
    [0.25, 0.5, 1, 2, 5, 10] as const,
    (value) => `${value}x`,
    (value) => applySystemPatch({ fireRateMult: value }),
  );
  const xpLevelBase = createSliderRow(gameplayGrid, "XP Base", 1, 500, 1, (value) => {
    applySystemPatch({ xpLevelBase: value });
  });
  const xpLevelGrowth = createSliderRow(gameplayGrid, "XP Growth", 1, 3, 0.05, (value) => {
    applySystemPatch({ xpLevelGrowth: value });
  });
  const waterFlowRate = createSliderRow(gameplayGrid, "Water Flow", 0.25, 4, 0.05, (value) => {
    applySystemPatch({ waterFlowRate: value });
  });
  const forceSpawnOverride = createToggleRow(gameplayGrid, "Force Spawn Override", (checked) => {
    applySystemPatch({ forceSpawnOverride: checked });
  });

  const neutralBirdDisabled = createToggleRow(aiGrid, "Disable Neutral Bird AI", (checked) => {
    applySystemPatch({ neutralBirdDisabled: checked });
  });
  const neutralBirdDisableTransitions = createToggleRow(aiGrid, "Disable Bird Transitions", (checked) => {
    applySystemPatch({ neutralBirdDisableTransitions: checked });
  });
  const neutralBirdForceState = createSelectRow(
    aiGrid,
    "Bird Force State",
    NEUTRAL_BIRD_FORCE_STATES,
    (value) => value,
    (value) => applySystemPatch({ neutralBirdForceState: value }),
  );
  const neutralBirdDebugRepickTarget = createToggleRow(aiGrid, "Bird Repick Target Debug", (checked) => {
    applySystemPatch({ neutralBirdDebugRepickTarget: checked });
  });

  const hostileSpawnT0PowerPerSec = createSliderRow(hostileSpawnGrid, "t0 Power/sec", 0, 5, 0.05, (value) => {
    applySystemPatch({ hostileSpawnT0PowerPerSec: value });
  });
  const hostileSpawnT120PowerPerSec = createSliderRow(hostileSpawnGrid, "t120 Power/sec", 0, 8, 0.05, (value) => {
    applySystemPatch({ hostileSpawnT120PowerPerSec: value });
  });
  const hostileSpawnOvertimePowerPerSecSlope = createSliderRow(hostileSpawnGrid, "Overtime Power Slope", 0, 0.2, 0.002, (value) => {
    applySystemPatch({ hostileSpawnOvertimePowerPerSecSlope: value });
  });
  const hostileSpawnT0LiveThreatCap = createSliderRow(hostileSpawnGrid, "t0 Threat Cap", 0, 30, 0.5, (value) => {
    applySystemPatch({ hostileSpawnT0LiveThreatCap: value });
  });
  const hostileSpawnT120LiveThreatCap = createSliderRow(hostileSpawnGrid, "t120 Threat Cap", 0, 60, 0.5, (value) => {
    applySystemPatch({ hostileSpawnT120LiveThreatCap: value });
  });
  const hostileSpawnOvertimeLiveThreatCapSlope = createSliderRow(hostileSpawnGrid, "Overtime Cap Slope", 0, 1, 0.01, (value) => {
    applySystemPatch({ hostileSpawnOvertimeLiveThreatCapSlope: value });
  });
  const hostileSpawnHeatHealthFactor = createSliderRow(hostileSpawnGrid, "Heat Health Factor", 0, 0.5, 0.01, (value) => {
    applySystemPatch({ hostileSpawnHeatHealthFactor: value });
  });
  const hostileSpawnHeatPowerPerSecFactor = createSliderRow(hostileSpawnGrid, "Heat Power Factor", 0, 0.5, 0.01, (value) => {
    applySystemPatch({ hostileSpawnHeatPowerPerSecFactor: value });
  });
  const hostileSpawnHeatThreatCapFactor = createSliderRow(hostileSpawnGrid, "Heat Cap Factor", 0, 0.5, 0.01, (value) => {
    applySystemPatch({ hostileSpawnHeatThreatCapFactor: value });
  });
  const hostileSpawnStockpileMultiplier = createSliderRow(hostileSpawnGrid, "Stockpile Mult", 1, 3, 0.05, (value) => {
    applySystemPatch({ hostileSpawnStockpileMultiplier: value });
  });
  const hostileSpawnBurstChancePerSpawnWindow = createSliderRow(hostileSpawnGrid, "Burst Chance", 0, 1, 0.01, (value) => {
    applySystemPatch({ hostileSpawnBurstChancePerSpawnWindow: value });
  });
  const hostileSpawnBurstExtraAttempts = createSliderRow(hostileSpawnGrid, "Burst Extra Attempts", 0, 5, 1, (value) => {
    applySystemPatch({ hostileSpawnBurstExtraAttempts: value });
  });
  const hostileSpawnMinSpawnIntervalSec = createSliderRow(hostileSpawnGrid, "Min Spawn Interval", 0.1, 10, 0.05, (value) => {
    applySystemPatch({ hostileSpawnMinSpawnIntervalSec: value });
  });
  const hostileSpawnResetBtn = document.createElement("button");
  hostileSpawnResetBtn.type = "button";
  hostileSpawnResetBtn.textContent = "Reset Hostile Spawn";
  applyButtonStyle(hostileSpawnResetBtn);
  hostileSpawnResetBtn.style.marginTop = "6px";
  hostileSpawnGrid.parentElement?.appendChild(hostileSpawnResetBtn);

  applyColumnMajorGridOrder(renderingGrid, 3);
  applyColumnMajorGridOrder(lightingGrid, 3);
  applyColumnMajorGridOrder(gameplayGrid, 3);
  applyColumnMajorGridOrder(aiGrid, 3);
  applyColumnMajorGridOrder(hostileSpawnGrid, 3);

  const rebuildPaletteOptions = (groupRaw: string, selectedIdRaw: string): string => {
    const group = normalizePaletteGroup(groupRaw);
    const selectedId = typeof selectedIdRaw === "string" ? selectedIdRaw : "";
    const palettes = getPalettesByGroup(group);
    const nextSelected = palettes.some((palette) => palette.id === selectedId)
      ? selectedId
      : (palettes[0]?.id ?? "db32");

    paletteId.replaceChildren();
    for (let i = 0; i < palettes.length; i++) {
      const palette = palettes[i];
      const opt = document.createElement("option");
      opt.value = palette.id;
      opt.textContent = `${palette.name} (${palette.id})`;
      paletteId.appendChild(opt);
    }
    paletteId.value = nextSelected;
    return nextSelected;
  };

  paletteGroup.addEventListener("change", () => {
    const group = normalizePaletteGroup(paletteGroup.value);
    const nextId = rebuildPaletteOptions(group, paletteId.value);
    applySystemPatch({ paletteGroup: group, paletteId: nextId });
  });

  paletteId.addEventListener("change", () => {
    const group = normalizePaletteGroup(paletteGroup.value);
    const nextId = rebuildPaletteOptions(group, paletteId.value);
    applySystemPatch({ paletteGroup: group, paletteId: nextId });
  });

  const formatX = (v: number) => `${v.toFixed(2)}x`;
  const formatScalar = (v: number) => v.toFixed(2);
  const formatSlope = (v: number) => v.toFixed(3);

  hostileSpawnResetBtn.addEventListener("click", () => {
    applySystemPatch({
      hostileSpawnT0PowerPerSec: DEFAULT_HOSTILE_SPAWN_T0_POWER_PER_SEC,
      hostileSpawnT120PowerPerSec: DEFAULT_HOSTILE_SPAWN_T120_POWER_PER_SEC,
      hostileSpawnOvertimePowerPerSecSlope: DEFAULT_HOSTILE_SPAWN_OVERTIME_POWER_PER_SEC_SLOPE,
      hostileSpawnT0LiveThreatCap: DEFAULT_HOSTILE_SPAWN_T0_LIVE_THREAT_CAP,
      hostileSpawnT120LiveThreatCap: DEFAULT_HOSTILE_SPAWN_T120_LIVE_THREAT_CAP,
      hostileSpawnOvertimeLiveThreatCapSlope: DEFAULT_HOSTILE_SPAWN_OVERTIME_LIVE_THREAT_CAP_SLOPE,
      hostileSpawnHeatHealthFactor: DEFAULT_HOSTILE_SPAWN_HEAT_HEALTH_FACTOR,
      hostileSpawnHeatPowerPerSecFactor: DEFAULT_HOSTILE_SPAWN_HEAT_POWER_PER_SEC_FACTOR,
      hostileSpawnHeatThreatCapFactor: DEFAULT_HOSTILE_SPAWN_HEAT_THREAT_CAP_FACTOR,
      hostileSpawnStockpileMultiplier: DEFAULT_HOSTILE_SPAWN_STOCKPILE_MULTIPLIER,
      hostileSpawnBurstChancePerSpawnWindow: DEFAULT_HOSTILE_SPAWN_BURST_CHANCE,
      hostileSpawnBurstExtraAttempts: DEFAULT_HOSTILE_SPAWN_BURST_EXTRA_ATTEMPTS,
      hostileSpawnMinSpawnIntervalSec: DEFAULT_HOSTILE_SPAWN_MIN_INTERVAL_SEC,
    });
  });

  return {
    sync(system) {
      entityShadowsDisable.checked = system.entityShadowsDisable;
      structureTriangleAdmissionMode.value = system.structureTriangleAdmissionMode;
      structureTriangleCutoutEnabled.checked = system.structureTriangleCutoutEnabled;
      structureTriangleCutoutWidth.value = `${system.structureTriangleCutoutWidth}`;
      structureTriangleCutoutHeight.value = `${system.structureTriangleCutoutHeight}`;
      structureTriangleCutoutAlpha.value = `${system.structureTriangleCutoutAlpha}`;
      tileRenderRadius.value = `${system.tileRenderRadius}`;
      worldAtlasMode.value = system.worldAtlasMode;
      {
        const settings = getSettings();
        const canvas = document.getElementById("c") as HTMLCanvasElement | null;
        const webglSurface = canvas ? getRenderableWebGLWorldSurface(canvas) : null;
        const backendSelection = resolveRenderBackendSelection(
          { renderBackend: settings.debug.renderBackend },
          webglSurface,
          canvas ? getWebGLWorldSurfaceFailureReason(canvas) : null,
        );
        const backend = backendSelection.selectedBackend;
        const effective = resolveEffectiveWorldAtlasMode(system.worldAtlasMode, backend);
        worldAtlasEffectiveValue.textContent = `${effective} (backend:${backend})`;
      }
      disableVisualCompiledCutoutCache.checked = system.disableVisualCompiledCutoutCache;
      mapOverlaysDisabled.checked = system.mapOverlaysDisabled;
      rampFaces.checked = system.rampFaces;

      paletteSwapEnabled.checked = system.paletteSwapEnabled;
      paletteGroup.value = normalizePaletteGroup(system.paletteGroup);
      paletteId.value = rebuildPaletteOptions(system.paletteGroup, system.paletteId);
      lightColorMode.value = system.lightColorModeOverride;
      lightStrength.value = system.lightStrengthOverride;
      paletteSWeightPercent.value = `${system.paletteSWeightPercent}`;
      paletteDarknessPercent.value = `${system.paletteDarknessPercent}`;
      darknessMaskDebugDisabled.checked = system.darknessMaskDebugDisabled;

      gameSpeed.input.value = `${system.gameSpeed}`;
      gameSpeed.value.textContent = formatX(system.gameSpeed);
      godMode.checked = system.godMode;
      dmgMult.value = `${system.dmgMult}`;
      fireRateMult.value = `${system.fireRateMult}`;
      xpLevelBase.input.value = `${system.xpLevelBase}`;
      xpLevelBase.value.textContent = `${Math.round(system.xpLevelBase)}`;
      xpLevelGrowth.input.value = `${system.xpLevelGrowth}`;
      xpLevelGrowth.value.textContent = system.xpLevelGrowth.toFixed(2);
      waterFlowRate.input.value = `${system.waterFlowRate}`;
      waterFlowRate.value.textContent = formatX(system.waterFlowRate);
      forceSpawnOverride.checked = system.forceSpawnOverride;

      neutralBirdDisabled.checked = system.neutralBirdDisabled;
      neutralBirdDisableTransitions.checked = system.neutralBirdDisableTransitions;
      neutralBirdForceState.value = system.neutralBirdForceState;
      neutralBirdDebugRepickTarget.checked = system.neutralBirdDebugRepickTarget;

      hostileSpawnT0PowerPerSec.input.value = `${system.hostileSpawnT0PowerPerSec}`;
      hostileSpawnT0PowerPerSec.value.textContent = formatScalar(system.hostileSpawnT0PowerPerSec);
      hostileSpawnT120PowerPerSec.input.value = `${system.hostileSpawnT120PowerPerSec}`;
      hostileSpawnT120PowerPerSec.value.textContent = formatScalar(system.hostileSpawnT120PowerPerSec);
      hostileSpawnOvertimePowerPerSecSlope.input.value = `${system.hostileSpawnOvertimePowerPerSecSlope}`;
      hostileSpawnOvertimePowerPerSecSlope.value.textContent = formatSlope(system.hostileSpawnOvertimePowerPerSecSlope);
      hostileSpawnT0LiveThreatCap.input.value = `${system.hostileSpawnT0LiveThreatCap}`;
      hostileSpawnT0LiveThreatCap.value.textContent = formatScalar(system.hostileSpawnT0LiveThreatCap);
      hostileSpawnT120LiveThreatCap.input.value = `${system.hostileSpawnT120LiveThreatCap}`;
      hostileSpawnT120LiveThreatCap.value.textContent = formatScalar(system.hostileSpawnT120LiveThreatCap);
      hostileSpawnOvertimeLiveThreatCapSlope.input.value = `${system.hostileSpawnOvertimeLiveThreatCapSlope}`;
      hostileSpawnOvertimeLiveThreatCapSlope.value.textContent = formatSlope(system.hostileSpawnOvertimeLiveThreatCapSlope);
      hostileSpawnHeatHealthFactor.input.value = `${system.hostileSpawnHeatHealthFactor}`;
      hostileSpawnHeatHealthFactor.value.textContent = formatScalar(system.hostileSpawnHeatHealthFactor);
      hostileSpawnHeatPowerPerSecFactor.input.value = `${system.hostileSpawnHeatPowerPerSecFactor}`;
      hostileSpawnHeatPowerPerSecFactor.value.textContent = formatScalar(system.hostileSpawnHeatPowerPerSecFactor);
      hostileSpawnHeatThreatCapFactor.input.value = `${system.hostileSpawnHeatThreatCapFactor}`;
      hostileSpawnHeatThreatCapFactor.value.textContent = formatScalar(system.hostileSpawnHeatThreatCapFactor);
      hostileSpawnStockpileMultiplier.input.value = `${system.hostileSpawnStockpileMultiplier}`;
      hostileSpawnStockpileMultiplier.value.textContent = formatScalar(system.hostileSpawnStockpileMultiplier);
      hostileSpawnBurstChancePerSpawnWindow.input.value = `${system.hostileSpawnBurstChancePerSpawnWindow}`;
      hostileSpawnBurstChancePerSpawnWindow.value.textContent = formatScalar(system.hostileSpawnBurstChancePerSpawnWindow);
      hostileSpawnBurstExtraAttempts.input.value = `${system.hostileSpawnBurstExtraAttempts}`;
      hostileSpawnBurstExtraAttempts.value.textContent = `${Math.round(system.hostileSpawnBurstExtraAttempts)}`;
      hostileSpawnMinSpawnIntervalSec.input.value = `${system.hostileSpawnMinSpawnIntervalSec}`;
      hostileSpawnMinSpawnIntervalSec.value.textContent = formatScalar(system.hostileSpawnMinSpawnIntervalSec);
    },
  };
}
