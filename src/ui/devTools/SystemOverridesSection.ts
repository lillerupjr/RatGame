import {
  getFirstPaletteInGroup,
  getPalettesByGroup,
  normalizePaletteGroup,
  PALETTE_GROUPS,
} from "../../engine/render/palette/palettes";
import {
  NEUTRAL_BIRD_FORCE_STATES,
  PALETTE_REMAP_WEIGHT_OPTIONS,
  STATIC_RELIGHT_TARGET_DARKNESS_OPTIONS,
} from "../../settings/systemOverrides";
import type { SystemOverrides } from "../../settings/settingsTypes";
import {
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
  const spawnGrid = createSubsectionGrid(section, "Spawn / Director Overrides");
  const aiGrid = createSubsectionGrid(section, "AI Overrides");

  const entityShadowsDisable = createToggleRow(renderingGrid, "Disable Entity Shadows", (checked) => {
    applySystemPatch({ entityShadowsDisable: checked });
  });
  const staticRelightEnabled = createToggleRow(renderingGrid, "Static Relight Enabled", (checked) => {
    applySystemPatch({ staticRelightEnabled: checked });
  });
  const structureTriangleGeometryEnabled = createToggleRow(renderingGrid, "Structure Triangle Geometry", (checked) => {
    applySystemPatch({ structureTriangleGeometryEnabled: checked });
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
  const staticRelightStrengthPercent = createSelectRow(
    lightingGrid,
    "Static Relight Strength",
    PALETTE_REMAP_WEIGHT_OPTIONS,
    (value) => `${value}%`,
    (value) => applySystemPatch({ staticRelightStrengthPercent: value as SystemOverrides["staticRelightStrengthPercent"] }),
  );
  const staticRelightTargetDarknessPercent = createSelectRow(
    lightingGrid,
    "Static Relight Target Darkness",
    STATIC_RELIGHT_TARGET_DARKNESS_OPTIONS,
    (value) => `${value}%`,
    (value) => applySystemPatch({ staticRelightTargetDarknessPercent: value as SystemOverrides["staticRelightTargetDarknessPercent"] }),
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
  const waterFlowRate = createSliderRow(gameplayGrid, "Water Flow", 0.25, 4, 0.05, (value) => {
    applySystemPatch({ waterFlowRate: value });
  });
  const forceSpawnOverride = createToggleRow(gameplayGrid, "Force Spawn Override", (checked) => {
    applySystemPatch({ forceSpawnOverride: checked });
  });

  const spawnBase = createSliderRow(spawnGrid, "Spawn Base", 0.2, 4.0, 0.05, (value) => {
    applySystemPatch({ spawnBase: value });
  });
  const spawnPerDepth = createSliderRow(spawnGrid, "Spawn/Depth", 0.8, 1.5, 0.01, (value) => {
    applySystemPatch({ spawnPerDepth: value });
  });
  const hpBase = createSliderRow(spawnGrid, "HP Base", 0.2, 4.0, 0.05, (value) => {
    applySystemPatch({ hpBase: value });
  });
  const hpPerDepth = createSliderRow(spawnGrid, "HP/Depth", 0.8, 1.5, 0.01, (value) => {
    applySystemPatch({ hpPerDepth: value });
  });
  const pressureAt0Sec = createSliderRow(spawnGrid, "Pressure T0", 0.1, 3.0, 0.01, (value) => {
    applySystemPatch({ pressureAt0Sec: value });
  });
  const pressureAt120Sec = createSliderRow(spawnGrid, "Pressure T120", 0.1, 3.0, 0.01, (value) => {
    applySystemPatch({ pressureAt120Sec: value });
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

  applyColumnMajorGridOrder(renderingGrid, 3);
  applyColumnMajorGridOrder(lightingGrid, 3);
  applyColumnMajorGridOrder(gameplayGrid, 3);
  applyColumnMajorGridOrder(spawnGrid, 3);
  applyColumnMajorGridOrder(aiGrid, 3);

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

  return {
    sync(system) {
      entityShadowsDisable.checked = system.entityShadowsDisable;
      staticRelightEnabled.checked = system.staticRelightEnabled;
      structureTriangleGeometryEnabled.checked = system.structureTriangleGeometryEnabled;
      structureTriangleAdmissionMode.value = system.structureTriangleAdmissionMode;
      structureTriangleCutoutEnabled.checked = system.structureTriangleCutoutEnabled;
      structureTriangleCutoutWidth.value = `${system.structureTriangleCutoutWidth}`;
      structureTriangleCutoutHeight.value = `${system.structureTriangleCutoutHeight}`;
      structureTriangleCutoutAlpha.value = `${system.structureTriangleCutoutAlpha}`;
      tileRenderRadius.value = `${system.tileRenderRadius}`;
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
      staticRelightStrengthPercent.value = `${system.staticRelightStrengthPercent}`;
      staticRelightTargetDarknessPercent.value = `${system.staticRelightTargetDarknessPercent}`;
      darknessMaskDebugDisabled.checked = system.darknessMaskDebugDisabled;

      gameSpeed.input.value = `${system.gameSpeed}`;
      gameSpeed.value.textContent = formatX(system.gameSpeed);
      godMode.checked = system.godMode;
      dmgMult.value = `${system.dmgMult}`;
      fireRateMult.value = `${system.fireRateMult}`;
      waterFlowRate.input.value = `${system.waterFlowRate}`;
      waterFlowRate.value.textContent = formatX(system.waterFlowRate);
      forceSpawnOverride.checked = system.forceSpawnOverride;

      spawnBase.input.value = `${system.spawnBase}`;
      spawnBase.value.textContent = system.spawnBase.toFixed(2);
      spawnPerDepth.input.value = `${system.spawnPerDepth}`;
      spawnPerDepth.value.textContent = system.spawnPerDepth.toFixed(2);
      hpBase.input.value = `${system.hpBase}`;
      hpBase.value.textContent = system.hpBase.toFixed(2);
      hpPerDepth.input.value = `${system.hpPerDepth}`;
      hpPerDepth.value.textContent = system.hpPerDepth.toFixed(2);
      pressureAt0Sec.input.value = `${system.pressureAt0Sec}`;
      pressureAt0Sec.value.textContent = system.pressureAt0Sec.toFixed(2);
      pressureAt120Sec.input.value = `${system.pressureAt120Sec}`;
      pressureAt120Sec.value.textContent = system.pressureAt120Sec.toFixed(2);

      neutralBirdDisabled.checked = system.neutralBirdDisabled;
      neutralBirdDisableTransitions.checked = system.neutralBirdDisableTransitions;
      neutralBirdForceState.value = system.neutralBirdForceState;
      neutralBirdDebugRepickTarget.checked = system.neutralBirdDebugRepickTarget;
    },
  };
}
