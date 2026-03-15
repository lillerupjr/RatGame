// src/main.ts
import { createGame, precomputeStaticMapData } from "./game/game";
import { AppState, RunState, createAppStateController } from "./game/app/appState";
import { createLoadingController } from "./game/app/loadingFlow";
import { renderLoadingScreen } from "./game/app/loadingScreen";
import { collectFloorDependencies } from "./game/loading/dependencyCollector";
import { primeAudio } from "./game/audio/audioManager";
import { setMusicMuted, setMusicVolume, setSfxMuted, setSfxVolume } from "./game/audio/audioSettings";
import { resolveActivePaletteId } from "./game/render/activePalette";
import { getSpriteByIdForPalette } from "./engine/render/sprites/renderSprites";
import {
  getFirstPaletteInGroup,
  getNextPaletteInGroup,
  getPalettesByGroup,
  normalizePaletteGroup,
  PALETTE_GROUPS,
} from "./engine/render/palette/palettes";
import { attachCanvasAutoResize } from "./engine/render/pixelPerfect";
import { getDomRefs } from "./ui/domRefs";
import { applyTheme } from "./ui/theme";
import { wireMenus } from "./ui/menuWiring";
import {
  DEBUG_TOGGLE_DEFINITIONS,
  NEUTRAL_BIRD_FORCE_STATES,
  PALETTE_REMAP_WEIGHT_OPTIONS,
  STATIC_RELIGHT_TARGET_DARKNESS_OPTIONS,
  makeAllDebugOffSettings,
  normalizeStaticRelightTargetDarknessPercent,
  type BooleanDebugSettingKey,
} from "./debugSettings";
import { getUserSettings, initUserSettings, updateUserSettings } from "./userSettings";
import { mountPauseMenu } from "./ui/pause/pauseMenu";
import { togglePause } from "./game/app/pauseController";
import { mountSettingsPanel } from "./ui/settings/settingsPanel";
import { STARTER_RELIC_BY_CHARACTER, validateStarterRelics } from "./game/content/starterRelics";
import { installStandaloneViewportFix } from "./game/app/viewportSizing";
import { buildPaletteSnapshotArtifactFromCanvas } from "./game/paletteLab/snapshotThumbnail";
import { getPaletteSnapshotRecord, savePaletteSnapshotArtifact } from "./game/paletteLab/snapshotStorage";
import { mountSnapshotViewerPalettePanel } from "./ui/paletteLab/snapshotViewerPalettePanel";

type DevSettingsUiController = {
  open(): void;
  close(): void;
  toggle(): void;
};

function installDevSettingsUi(): DevSettingsUiController {
  const settingsMenu = document.getElementById("settingsMenu") as HTMLDivElement | null;
  const settingsPanel = settingsMenu?.querySelector(".panel") as HTMLDivElement | null;
  const settingsBackBtn = settingsPanel?.querySelector("#settingsBackBtn") as HTMLButtonElement | null;
  const noopController: DevSettingsUiController = {
    open() {},
    close() {},
    toggle() {},
  };
  if (!settingsPanel) return noopController;

  const applyDevButtonStyle = (btn: HTMLButtonElement, variant: "primary" | "secondary" = "secondary") => {
    btn.style.border = "1px solid var(--border-default)";
    btn.style.borderRadius = "0";
    btn.style.background = variant === "primary" ? "var(--primary-btn-bg)" : "var(--focus-bg)";
    btn.style.color = "var(--text-primary)";
    btn.style.fontFamily = "var(--font-mono)";
    btn.style.fontWeight = "700";
    btn.style.cursor = "pointer";
  };

  const applyDevSelectStyle = (select: HTMLSelectElement) => {
    select.style.background = "var(--focus-bg)";
    select.style.color = "var(--text-primary)";
    select.style.border = "1px solid var(--border-default)";
    select.style.borderRadius = "0";
    select.style.fontFamily = "var(--font-mono)";
    select.style.setProperty("color-scheme", "dark");
  };

  const debugLayerToggleBtn = document.createElement("button");
  debugLayerToggleBtn.type = "button";
  debugLayerToggleBtn.textContent = "Dev Tools";
  debugLayerToggleBtn.style.marginTop = "10px";
  debugLayerToggleBtn.style.width = "100%";
  debugLayerToggleBtn.style.minHeight = "36px";
  applyDevButtonStyle(debugLayerToggleBtn, "primary");

  const layer = document.createElement("div");
  layer.hidden = true;
  layer.style.position = "fixed";
  layer.style.inset = "0";
  layer.style.display = "grid";
  layer.style.placeItems = "center";
  layer.style.background = "var(--bg-overlay)";
  layer.style.boxSizing = "border-box";
  layer.style.padding = "var(--overlay-pad-top) var(--overlay-pad-right) var(--overlay-pad-bottom) var(--overlay-pad-left)";
  layer.style.zIndex = "10000";

  const panel = document.createElement("div");
  panel.style.width = "min(980px, 100%)";
  panel.style.maxHeight = "100%";
  panel.style.overflowY = "auto";
  panel.style.padding = "12px";
  panel.style.border = "1px solid var(--border-default)";
  panel.style.borderRadius = "0";
  panel.style.background = "linear-gradient(180deg, var(--bg-elevated), var(--focus-bg))";
  panel.style.color = "var(--text-primary)";
  panel.style.font = "12px var(--font-mono)";
  panel.style.boxShadow = "inset 0 0 0 1px var(--border-subtle), var(--shadow-medium)";
  panel.style.boxSizing = "border-box";
  layer.appendChild(panel);
  document.body.appendChild(layer);

  if (settingsBackBtn) {
    settingsPanel.insertBefore(debugLayerToggleBtn, settingsBackBtn);
  } else {
    settingsPanel.appendChild(debugLayerToggleBtn);
  }

  const headerRow = document.createElement("div");
  headerRow.style.display = "flex";
  headerRow.style.alignItems = "center";
  headerRow.style.justifyContent = "space-between";
  headerRow.style.gap = "10px";
  headerRow.style.marginBottom = "8px";
  panel.appendChild(headerRow);

  const title = document.createElement("div");
  title.textContent = "Debug Tools";
  title.style.fontWeight = "700";
  headerRow.appendChild(title);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.style.padding = "4px 10px";
  applyDevButtonStyle(closeBtn);
  headerRow.appendChild(closeBtn);

  type SettingsDebug = ReturnType<typeof getUserSettings>["debug"];
  type SettingsRender = ReturnType<typeof getUserSettings>["render"];
  const checks = new Map<BooleanDebugSettingKey, HTMLInputElement>();
  const debugToggleGrid = document.createElement("div");
  debugToggleGrid.style.display = "grid";
  debugToggleGrid.style.gridTemplateColumns = "1fr 1fr";
  debugToggleGrid.style.columnGap = "14px";
  debugToggleGrid.style.rowGap = "2px";
  panel.appendChild(debugToggleGrid);

  const prettyLabelByKey: Partial<Record<BooleanDebugSettingKey, string>> = {
    grid: "Show Grid",
    walkMask: "Show Walk Mask",
    blockedTiles: "Show Blocked Tiles",
    ramps: "Show Ramps",
    colliders: "Show Colliders",
    slices: "Show Slices",
    occluders: "Show Occluders",
    decals: "Show Decals",
    structureHeights: "Show Structure Heights",
    spriteBounds: "Show Sprite Bounds",
    projectileFaces: "Show Projectile Faces",
    triggers: "Show Trigger Zones",
    debugRoadSemantic: "Show Road Semantics",
    mapOverlaysDisabled: "Disable Map Overlays",
    rampFaces: "Show Ramp Faces",
    forceSpawnOverride: "Force Spawn Override",
    godMode: "God Mode",
    entityAnchorOverlay: "Show Entity Anchors",
    enemyAimOverlay: "Enemy Aim Overlay",
    lootGoblinOverlay: "Loot Goblin Overlay",
    pauseDebugCards: "Pause Debug Cards",
    pauseCsvControls: "Pause CSV Controls",
    dpsMeter: "DPS Meter",
  };

  const addToggle = (key: BooleanDebugSettingKey, label: string) => {
    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = "10px";
    row.style.padding = "4px 0";
    row.style.cursor = "pointer";

    const text = document.createElement("span");
    text.textContent = prettyLabelByKey[key] ?? label;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.addEventListener("change", () => {
      updateUserSettings({ debug: { [key]: input.checked } });
    });

    row.appendChild(text);
    row.appendChild(input);
    debugToggleGrid.appendChild(row);
    checks.set(key, input);
  };

  for (let i = 0; i < DEBUG_TOGGLE_DEFINITIONS.length; i++) {
    addToggle(DEBUG_TOGGLE_DEFINITIONS[i].key, DEBUG_TOGGLE_DEFINITIONS[i].label);
  }

  const renderTitle = document.createElement("div");
  renderTitle.textContent = "Render";
  renderTitle.style.fontWeight = "700";
  renderTitle.style.marginTop = "10px";
  renderTitle.style.marginBottom = "4px";
  panel.appendChild(renderTitle);

  const entityShadowsRow = document.createElement("label");
  entityShadowsRow.style.display = "flex";
  entityShadowsRow.style.alignItems = "center";
  entityShadowsRow.style.justifyContent = "space-between";
  entityShadowsRow.style.gap = "10px";
  entityShadowsRow.style.padding = "4px 0";
  const entityShadowsText = document.createElement("span");
  entityShadowsText.textContent = "Disable Entity Shadows";
  const entityShadowsInput = document.createElement("input");
  entityShadowsInput.type = "checkbox";
  entityShadowsInput.addEventListener("change", () => {
    updateUserSettings({
      render: {
        entityShadowsDisable: entityShadowsInput.checked,
      },
    });
  });
  entityShadowsRow.appendChild(entityShadowsText);
  entityShadowsRow.appendChild(entityShadowsInput);
  panel.appendChild(entityShadowsRow);

  const entityAnchorsRow = document.createElement("label");
  entityAnchorsRow.style.display = "flex";
  entityAnchorsRow.style.alignItems = "center";
  entityAnchorsRow.style.justifyContent = "space-between";
  entityAnchorsRow.style.gap = "10px";
  entityAnchorsRow.style.padding = "4px 0";
  const entityAnchorsText = document.createElement("span");
  entityAnchorsText.textContent = "Entity Anchors";
  const entityAnchorsInput = document.createElement("input");
  entityAnchorsInput.type = "checkbox";
  entityAnchorsInput.addEventListener("change", () => {
    updateUserSettings({
      render: {
        entityAnchorsEnabled: entityAnchorsInput.checked,
      },
    });
  });
  entityAnchorsRow.appendChild(entityAnchorsText);
  entityAnchorsRow.appendChild(entityAnchorsInput);
  panel.appendChild(entityAnchorsRow);

  const renderPerfCountersRow = document.createElement("label");
  renderPerfCountersRow.style.display = "flex";
  renderPerfCountersRow.style.alignItems = "center";
  renderPerfCountersRow.style.justifyContent = "space-between";
  renderPerfCountersRow.style.gap = "10px";
  renderPerfCountersRow.style.padding = "4px 0";
  const renderPerfCountersText = document.createElement("span");
  renderPerfCountersText.textContent = "Render Perf Counters";
  const renderPerfCountersInput = document.createElement("input");
  renderPerfCountersInput.type = "checkbox";
  renderPerfCountersInput.addEventListener("change", () => {
    updateUserSettings({
      render: {
        renderPerfCountersEnabled: renderPerfCountersInput.checked,
      },
    });
  });
  renderPerfCountersRow.appendChild(renderPerfCountersText);
  renderPerfCountersRow.appendChild(renderPerfCountersInput);
  panel.appendChild(renderPerfCountersRow);

  const staticRelightPocRow = document.createElement("label");
  staticRelightPocRow.style.display = "flex";
  staticRelightPocRow.style.alignItems = "center";
  staticRelightPocRow.style.justifyContent = "space-between";
  staticRelightPocRow.style.gap = "10px";
  staticRelightPocRow.style.padding = "4px 0";
  const staticRelightPocText = document.createElement("span");
  staticRelightPocText.textContent = "Static Relight POC";
  const staticRelightPocInput = document.createElement("input");
  staticRelightPocInput.type = "checkbox";
  staticRelightPocInput.addEventListener("change", () => {
    updateUserSettings({
      render: {
        staticRelightPocEnabled: staticRelightPocInput.checked,
      },
    });
  });
  staticRelightPocRow.appendChild(staticRelightPocText);
  staticRelightPocRow.appendChild(staticRelightPocInput);
  panel.appendChild(staticRelightPocRow);

  const paletteSwapRow = document.createElement("label");
  paletteSwapRow.style.display = "flex";
  paletteSwapRow.style.alignItems = "center";
  paletteSwapRow.style.justifyContent = "space-between";
  paletteSwapRow.style.gap = "10px";
  paletteSwapRow.style.padding = "4px 0";
  const paletteSwapText = document.createElement("span");
  paletteSwapText.textContent = "Palette Override";
  const paletteSwapInput = document.createElement("input");
  paletteSwapInput.type = "checkbox";
  paletteSwapInput.addEventListener("change", () => {
    updateUserSettings({
      render: {
        paletteSwapEnabled: paletteSwapInput.checked,
      },
    });
  });
  paletteSwapRow.appendChild(paletteSwapText);
  paletteSwapRow.appendChild(paletteSwapInput);
  panel.appendChild(paletteSwapRow);

  const paletteGroupRow = document.createElement("label");
  paletteGroupRow.style.display = "flex";
  paletteGroupRow.style.alignItems = "center";
  paletteGroupRow.style.justifyContent = "space-between";
  paletteGroupRow.style.gap = "10px";
  paletteGroupRow.style.padding = "4px 0";
  const paletteGroupText = document.createElement("span");
  paletteGroupText.textContent = "Palette Group";
  const paletteGroupSelect = document.createElement("select");
  applyDevSelectStyle(paletteGroupSelect);
  for (let i = 0; i < PALETTE_GROUPS.length; i++) {
    const group = PALETTE_GROUPS[i];
    const opt = document.createElement("option");
    opt.value = group;
    opt.textContent = group;
    paletteGroupSelect.appendChild(opt);
  }
  paletteGroupRow.appendChild(paletteGroupText);
  paletteGroupRow.appendChild(paletteGroupSelect);
  panel.appendChild(paletteGroupRow);

  const paletteIdRow = document.createElement("label");
  paletteIdRow.style.display = "flex";
  paletteIdRow.style.alignItems = "center";
  paletteIdRow.style.justifyContent = "space-between";
  paletteIdRow.style.gap = "10px";
  paletteIdRow.style.padding = "4px 0";
  const paletteIdText = document.createElement("span");
  paletteIdText.textContent = "Palette";
  const paletteIdSelect = document.createElement("select");
  applyDevSelectStyle(paletteIdSelect);
  const rebuildPaletteOptions = (groupRaw: string, selectedIdRaw: string): string => {
    const group = normalizePaletteGroup(groupRaw);
    const selectedId = typeof selectedIdRaw === "string" ? selectedIdRaw : "";
    const palettes = getPalettesByGroup(group);
    const nextSelected = palettes.some((palette) => palette.id === selectedId)
      ? selectedId
      : (palettes[0]?.id ?? "db32");

    paletteIdSelect.replaceChildren();
    for (let i = 0; i < palettes.length; i++) {
      const palette = palettes[i];
      const opt = document.createElement("option");
      opt.value = palette.id;
      opt.textContent = `${palette.name} (${palette.id})`;
      paletteIdSelect.appendChild(opt);
    }
    paletteIdSelect.value = nextSelected;
    return nextSelected;
  };

  paletteGroupSelect.addEventListener("change", () => {
    const group = normalizePaletteGroup(paletteGroupSelect.value);
    const currentPaletteId = getUserSettings().render.paletteId;
    const nextPaletteId = rebuildPaletteOptions(group, currentPaletteId);
    updateUserSettings({
      render: {
        paletteGroup: group,
        paletteId: nextPaletteId,
      },
    });
  });
  paletteIdSelect.addEventListener("change", () => {
    const group = normalizePaletteGroup(paletteGroupSelect.value);
    const nextPaletteId = rebuildPaletteOptions(group, paletteIdSelect.value);
    updateUserSettings({
      render: {
        paletteGroup: group,
        paletteId: nextPaletteId,
      },
    });
  });
  paletteIdRow.appendChild(paletteIdText);
  paletteIdRow.appendChild(paletteIdSelect);
  panel.appendChild(paletteIdRow);

  const createPaletteWeightSelect = (
    label: string,
    onChange: (value: SettingsDebug["paletteSWeightPercent"]) => void,
  ): HTMLSelectElement => {
    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = "10px";
    row.style.padding = "4px 0";

    const text = document.createElement("span");
    text.textContent = label;

    const select = document.createElement("select");
    applyDevSelectStyle(select);
    for (let i = 0; i < PALETTE_REMAP_WEIGHT_OPTIONS.length; i++) {
      const weight = PALETTE_REMAP_WEIGHT_OPTIONS[i];
      const opt = document.createElement("option");
      opt.value = `${weight}`;
      opt.textContent = `${weight}%`;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => {
      const value = Number.parseInt(select.value, 10);
      onChange((Number.isFinite(value) ? value : 0) as SettingsDebug["paletteSWeightPercent"]);
    });

    row.appendChild(text);
    row.appendChild(select);
    panel.appendChild(row);
    return select;
  };

  const paletteSWeightSelect = createPaletteWeightSelect("Palette Saturation Weight", (value) => {
    updateUserSettings({
      debug: {
        paletteSWeightPercent: value,
      },
    });
  });
  const paletteDarknessSelect = createPaletteWeightSelect("Palette Darkness", (value) => {
    updateUserSettings({
      debug: {
        paletteDarknessPercent: value,
      },
    });
  });
  const staticRelightStrengthSelect = createPaletteWeightSelect("Static Relight Strength", (value) => {
    updateUserSettings({
      debug: {
        staticRelightStrengthPercent: value,
      },
    });
  });
  const staticRelightTargetDarknessRow = document.createElement("label");
  staticRelightTargetDarknessRow.style.display = "flex";
  staticRelightTargetDarknessRow.style.alignItems = "center";
  staticRelightTargetDarknessRow.style.justifyContent = "space-between";
  staticRelightTargetDarknessRow.style.gap = "10px";
  staticRelightTargetDarknessRow.style.padding = "4px 0";
  const staticRelightTargetDarknessText = document.createElement("span");
  staticRelightTargetDarknessText.textContent = "Static Relight Target Darkness";
  const staticRelightTargetDarknessSelect = document.createElement("select");
  applyDevSelectStyle(staticRelightTargetDarknessSelect);
  for (let i = 0; i < STATIC_RELIGHT_TARGET_DARKNESS_OPTIONS.length; i++) {
    const optionValue = STATIC_RELIGHT_TARGET_DARKNESS_OPTIONS[i];
    const opt = document.createElement("option");
    opt.value = `${optionValue}`;
    opt.textContent = `${optionValue}%`;
    staticRelightTargetDarknessSelect.appendChild(opt);
  }
  staticRelightTargetDarknessSelect.addEventListener("change", () => {
    const value = Number.parseInt(staticRelightTargetDarknessSelect.value, 10);
    updateUserSettings({
      debug: {
        staticRelightTargetDarknessPercent: normalizeStaticRelightTargetDarknessPercent(value),
      },
    });
  });
  staticRelightTargetDarknessRow.appendChild(staticRelightTargetDarknessText);
  staticRelightTargetDarknessRow.appendChild(staticRelightTargetDarknessSelect);
  panel.appendChild(staticRelightTargetDarknessRow);

  const lightColorModeRow = document.createElement("label");
  lightColorModeRow.style.display = "flex";
  lightColorModeRow.style.alignItems = "center";
  lightColorModeRow.style.justifyContent = "space-between";
  lightColorModeRow.style.gap = "10px";
  lightColorModeRow.style.padding = "4px 0";
  const lightColorModeText = document.createElement("span");
  lightColorModeText.textContent = "Light Mode";
  const lightColorModeSelect = document.createElement("select");
  applyDevSelectStyle(lightColorModeSelect);
  const lightColorModeOptions: Array<{
    value: SettingsRender["lightColorModeOverride"];
    label: string;
  }> = [
    { value: "authored", label: "Authored" },
    { value: "off", label: "Off" },
    { value: "standard", label: "Standard" },
    { value: "palette", label: "Palette" },
  ];
  for (let i = 0; i < lightColorModeOptions.length; i++) {
    const optionDef = lightColorModeOptions[i];
    const opt = document.createElement("option");
    opt.value = optionDef.value;
    opt.textContent = optionDef.label;
    lightColorModeSelect.appendChild(opt);
  }
  lightColorModeSelect.addEventListener("change", () => {
    updateUserSettings({
      render: {
        lightColorModeOverride: lightColorModeSelect.value as SettingsRender["lightColorModeOverride"],
      },
    });
  });
  lightColorModeRow.appendChild(lightColorModeText);
  lightColorModeRow.appendChild(lightColorModeSelect);
  panel.appendChild(lightColorModeRow);

  const lightStrengthRow = document.createElement("label");
  lightStrengthRow.style.display = "flex";
  lightStrengthRow.style.alignItems = "center";
  lightStrengthRow.style.justifyContent = "space-between";
  lightStrengthRow.style.gap = "10px";
  lightStrengthRow.style.padding = "4px 0";
  const lightStrengthText = document.createElement("span");
  lightStrengthText.textContent = "Light Strength";
  const lightStrengthSelect = document.createElement("select");
  applyDevSelectStyle(lightStrengthSelect);
  const lightStrengthOptions: Array<{
    value: SettingsRender["lightStrengthOverride"];
    label: string;
  }> = [
    { value: "authored", label: "Authored" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ];
  for (let i = 0; i < lightStrengthOptions.length; i++) {
    const optionDef = lightStrengthOptions[i];
    const opt = document.createElement("option");
    opt.value = optionDef.value;
    opt.textContent = optionDef.label;
    lightStrengthSelect.appendChild(opt);
  }
  lightStrengthSelect.addEventListener("change", () => {
    updateUserSettings({
      render: {
        lightStrengthOverride: lightStrengthSelect.value as SettingsRender["lightStrengthOverride"],
      },
    });
  });
  lightStrengthRow.appendChild(lightStrengthText);
  lightStrengthRow.appendChild(lightStrengthSelect);
  panel.appendChild(lightStrengthRow);

  const paletteHudDebugOverlayRow = document.createElement("label");
  paletteHudDebugOverlayRow.style.display = "flex";
  paletteHudDebugOverlayRow.style.alignItems = "center";
  paletteHudDebugOverlayRow.style.justifyContent = "space-between";
  paletteHudDebugOverlayRow.style.gap = "10px";
  paletteHudDebugOverlayRow.style.padding = "4px 0";
  const paletteHudDebugOverlayText = document.createElement("span");
  paletteHudDebugOverlayText.textContent = "Palette HUD Debug Overlay";
  const paletteHudDebugOverlayInput = document.createElement("input");
  paletteHudDebugOverlayInput.type = "checkbox";
  paletteHudDebugOverlayInput.addEventListener("change", () => {
    updateUserSettings({
      render: {
        paletteHudDebugOverlayEnabled: paletteHudDebugOverlayInput.checked,
      },
    });
  });
  paletteHudDebugOverlayRow.appendChild(paletteHudDebugOverlayText);
  paletteHudDebugOverlayRow.appendChild(paletteHudDebugOverlayInput);
  panel.appendChild(paletteHudDebugOverlayRow);

  const darknessMaskDebugRow = document.createElement("label");
  darknessMaskDebugRow.style.display = "flex";
  darknessMaskDebugRow.style.alignItems = "center";
  darknessMaskDebugRow.style.justifyContent = "space-between";
  darknessMaskDebugRow.style.gap = "10px";
  darknessMaskDebugRow.style.padding = "4px 0";
  const darknessMaskDebugText = document.createElement("span");
  darknessMaskDebugText.textContent = "Disable Darkness Mask";
  const darknessMaskDebugInput = document.createElement("input");
  darknessMaskDebugInput.type = "checkbox";
  darknessMaskDebugInput.addEventListener("change", () => {
    updateUserSettings({
      render: {
        darknessMaskDebugDisabled: darknessMaskDebugInput.checked,
      },
    });
  });
  darknessMaskDebugRow.appendChild(darknessMaskDebugText);
  darknessMaskDebugRow.appendChild(darknessMaskDebugInput);
  panel.appendChild(darknessMaskDebugRow);

  const waterFlowRow = document.createElement("div");
  waterFlowRow.style.display = "flex";
  waterFlowRow.style.flexDirection = "column";
  waterFlowRow.style.gap = "4px";
  waterFlowRow.style.padding = "6px 0";
  const waterFlowTop = document.createElement("div");
  waterFlowTop.style.display = "flex";
  waterFlowTop.style.alignItems = "center";
  waterFlowTop.style.justifyContent = "space-between";
  waterFlowTop.style.gap = "10px";
  const waterFlowText = document.createElement("span");
  waterFlowText.textContent = "Water Flow";
  const waterFlowValue = document.createElement("span");
  waterFlowValue.textContent = "1.00x";
  const waterFlowInput = document.createElement("input");
  waterFlowInput.type = "range";
  waterFlowInput.min = "0.25";
  waterFlowInput.max = "4";
  waterFlowInput.step = "0.05";
  waterFlowInput.value = "1";
  waterFlowInput.addEventListener("input", () => {
    const value = Number.parseFloat(waterFlowInput.value) || 1;
    waterFlowValue.textContent = `${value.toFixed(2)}x`;
    updateUserSettings({
      debug: {
        waterFlowRate: value,
      },
    });
  });
  waterFlowTop.appendChild(waterFlowText);
  waterFlowTop.appendChild(waterFlowValue);
  waterFlowRow.appendChild(waterFlowTop);
  waterFlowRow.appendChild(waterFlowInput);
  panel.appendChild(waterFlowRow);

  const dmgMultRow = document.createElement("div");
  dmgMultRow.style.display = "flex";
  dmgMultRow.style.alignItems = "center";
  dmgMultRow.style.justifyContent = "space-between";
  dmgMultRow.style.gap = "10px";
  dmgMultRow.style.padding = "4px 0";
  const dmgMultText = document.createElement("span");
  dmgMultText.textContent = "Damage Mult";
  const dmgMultBtn = document.createElement("button");
  dmgMultBtn.type = "button";
  applyDevButtonStyle(dmgMultBtn);
  dmgMultBtn.addEventListener("click", () => {
    const s = getUserSettings().debug;
    const next = s.dmgMult === 10 ? 1 : 10;
    updateUserSettings({ debug: { dmgMult: next } });
    dmgMultBtn.textContent = `${next}x`;
  });
  dmgMultRow.appendChild(dmgMultText);
  dmgMultRow.appendChild(dmgMultBtn);
  panel.appendChild(dmgMultRow);

  const fireRateMultRow = document.createElement("div");
  fireRateMultRow.style.display = "flex";
  fireRateMultRow.style.alignItems = "center";
  fireRateMultRow.style.justifyContent = "space-between";
  fireRateMultRow.style.gap = "10px";
  fireRateMultRow.style.padding = "4px 0";
  const fireRateMultText = document.createElement("span");
  fireRateMultText.textContent = "Fire Rate Mult";
  const fireRateMultBtn = document.createElement("button");
  fireRateMultBtn.type = "button";
  applyDevButtonStyle(fireRateMultBtn);
  fireRateMultBtn.addEventListener("click", () => {
    const s = getUserSettings().debug;
    const next = s.fireRateMult === 10 ? 1 : 10;
    updateUserSettings({ debug: { fireRateMult: next } });
    fireRateMultBtn.textContent = `${next}x`;
  });
  fireRateMultRow.appendChild(fireRateMultText);
  fireRateMultRow.appendChild(fireRateMultBtn);
  panel.appendChild(fireRateMultRow);

  const birdTitle = document.createElement("div");
  birdTitle.textContent = "Neutral Bird AI";
  birdTitle.style.fontWeight = "700";
  birdTitle.style.marginTop = "10px";
  birdTitle.style.marginBottom = "4px";
  panel.appendChild(birdTitle);

  const birdEnabledRow = document.createElement("label");
  birdEnabledRow.style.display = "flex";
  birdEnabledRow.style.alignItems = "center";
  birdEnabledRow.style.justifyContent = "space-between";
  birdEnabledRow.style.gap = "10px";
  birdEnabledRow.style.padding = "4px 0";
  const birdEnabledText = document.createElement("span");
  birdEnabledText.textContent = "Disable Neutral Bird AI";
  const birdEnabledInput = document.createElement("input");
  birdEnabledInput.type = "checkbox";
  birdEnabledInput.addEventListener("change", () => {
    updateUserSettings({
      debug: {
        neutralBirdAI: {
          ...getUserSettings().debug.neutralBirdAI,
          disabled: birdEnabledInput.checked,
        },
      },
    });
  });
  birdEnabledRow.appendChild(birdEnabledText);
  birdEnabledRow.appendChild(birdEnabledInput);
  panel.appendChild(birdEnabledRow);

  const birdDisableTransitionsRow = document.createElement("label");
  birdDisableTransitionsRow.style.display = "flex";
  birdDisableTransitionsRow.style.alignItems = "center";
  birdDisableTransitionsRow.style.justifyContent = "space-between";
  birdDisableTransitionsRow.style.gap = "10px";
  birdDisableTransitionsRow.style.padding = "4px 0";
  const birdDisableTransitionsText = document.createElement("span");
  birdDisableTransitionsText.textContent = "Disable Transitions";
  const birdDisableTransitionsInput = document.createElement("input");
  birdDisableTransitionsInput.type = "checkbox";
  birdDisableTransitionsInput.addEventListener("change", () => {
    updateUserSettings({
      debug: {
        neutralBirdAI: {
          ...getUserSettings().debug.neutralBirdAI,
          disableTransitions: birdDisableTransitionsInput.checked,
        },
      },
    });
  });
  birdDisableTransitionsRow.appendChild(birdDisableTransitionsText);
  birdDisableTransitionsRow.appendChild(birdDisableTransitionsInput);
  panel.appendChild(birdDisableTransitionsRow);

  const birdDrawDebugRow = document.createElement("label");
  birdDrawDebugRow.style.display = "flex";
  birdDrawDebugRow.style.alignItems = "center";
  birdDrawDebugRow.style.justifyContent = "space-between";
  birdDrawDebugRow.style.gap = "10px";
  birdDrawDebugRow.style.padding = "4px 0";
  const birdDrawDebugText = document.createElement("span");
  birdDrawDebugText.textContent = "Draw Debug";
  const birdDrawDebugInput = document.createElement("input");
  birdDrawDebugInput.type = "checkbox";
  birdDrawDebugInput.addEventListener("change", () => {
    updateUserSettings({
      debug: {
        neutralBirdAI: {
          ...getUserSettings().debug.neutralBirdAI,
          drawDebug: birdDrawDebugInput.checked,
        },
      },
    });
  });
  birdDrawDebugRow.appendChild(birdDrawDebugText);
  birdDrawDebugRow.appendChild(birdDrawDebugInput);
  panel.appendChild(birdDrawDebugRow);

  const birdForceStateRow = document.createElement("label");
  birdForceStateRow.style.display = "flex";
  birdForceStateRow.style.alignItems = "center";
  birdForceStateRow.style.justifyContent = "space-between";
  birdForceStateRow.style.gap = "10px";
  birdForceStateRow.style.padding = "4px 0";
  const birdForceStateText = document.createElement("span");
  birdForceStateText.textContent = "Force State";
  const birdForceStateSelect = document.createElement("select");
  applyDevSelectStyle(birdForceStateSelect);
  for (let i = 0; i < NEUTRAL_BIRD_FORCE_STATES.length; i++) {
    const opt = document.createElement("option");
    opt.value = NEUTRAL_BIRD_FORCE_STATES[i];
    opt.textContent = NEUTRAL_BIRD_FORCE_STATES[i];
    birdForceStateSelect.appendChild(opt);
  }
  birdForceStateSelect.addEventListener("change", () => {
    updateUserSettings({
      debug: {
        neutralBirdAI: {
          ...getUserSettings().debug.neutralBirdAI,
          forceState: birdForceStateSelect.value as SettingsDebug["neutralBirdAI"]["forceState"],
        },
      },
    });
  });
  birdForceStateRow.appendChild(birdForceStateText);
  birdForceStateRow.appendChild(birdForceStateSelect);
  panel.appendChild(birdForceStateRow);

  const birdRepickTargetRow = document.createElement("label");
  birdRepickTargetRow.style.display = "flex";
  birdRepickTargetRow.style.alignItems = "center";
  birdRepickTargetRow.style.justifyContent = "space-between";
  birdRepickTargetRow.style.gap = "10px";
  birdRepickTargetRow.style.padding = "4px 0";
  const birdRepickTargetText = document.createElement("span");
  birdRepickTargetText.textContent = "Repick Target Debug";
  const birdRepickTargetInput = document.createElement("input");
  birdRepickTargetInput.type = "checkbox";
  birdRepickTargetInput.addEventListener("change", () => {
    updateUserSettings({
      debug: {
        neutralBirdAI: {
          ...getUserSettings().debug.neutralBirdAI,
          debugRepickTarget: birdRepickTargetInput.checked,
        },
      },
    });
  });
  birdRepickTargetRow.appendChild(birdRepickTargetText);
  birdRepickTargetRow.appendChild(birdRepickTargetInput);
  panel.appendChild(birdRepickTargetRow);

  const offAllBtn = document.createElement("button");
  offAllBtn.type = "button";
  offAllBtn.textContent = "Turn Off All";
  offAllBtn.style.marginTop = "10px";
  offAllBtn.style.width = "100%";
  offAllBtn.style.height = "30px";
  applyDevButtonStyle(offAllBtn);
  offAllBtn.addEventListener("click", () => {
    updateUserSettings({
      debug: makeAllDebugOffSettings(),
      render: {
        entityShadowsDisable: false,
        entityAnchorsEnabled: false,
        renderPerfCountersEnabled: false,
        performanceMode: false,
        staticRelightPocEnabled: false,
        paletteSwapEnabled: false,
        paletteHudDebugOverlayEnabled: false,
        darknessMaskDebugDisabled: false,
        lightColorModeOverride: "authored",
        lightStrengthOverride: "authored",
      },
    });
    syncFromSettings();
  });
  panel.appendChild(offAllBtn);

  const syncFromSettings = () => {
    const s = getUserSettings();
    for (let i = 0; i < DEBUG_TOGGLE_DEFINITIONS.length; i++) {
      const def = DEBUG_TOGGLE_DEFINITIONS[i];
      checks.get(def.key)!.checked = s.debug[def.key];
    }
    birdEnabledInput.checked = s.debug.neutralBirdAI.disabled;
    birdDisableTransitionsInput.checked = s.debug.neutralBirdAI.disableTransitions;
    birdDrawDebugInput.checked = s.debug.neutralBirdAI.drawDebug;
    birdForceStateSelect.value = s.debug.neutralBirdAI.forceState;
    birdRepickTargetInput.checked = s.debug.neutralBirdAI.debugRepickTarget;
    waterFlowInput.value = `${s.debug.waterFlowRate}`;
    waterFlowValue.textContent = `${s.debug.waterFlowRate.toFixed(2)}x`;
    paletteSWeightSelect.value = `${s.debug.paletteSWeightPercent}`;
    paletteDarknessSelect.value = `${s.debug.paletteDarknessPercent}`;
    staticRelightStrengthSelect.value = `${s.debug.staticRelightStrengthPercent}`;
    staticRelightTargetDarknessSelect.value = `${s.debug.staticRelightTargetDarknessPercent}`;
    dmgMultBtn.textContent = `${s.debug.dmgMult}x`;
    fireRateMultBtn.textContent = `${s.debug.fireRateMult}x`;
    entityShadowsInput.checked = s.render.entityShadowsDisable;
    entityAnchorsInput.checked = s.render.entityAnchorsEnabled;
    renderPerfCountersInput.checked = s.render.renderPerfCountersEnabled;
    staticRelightPocInput.checked = s.render.staticRelightPocEnabled === true;
    paletteSwapInput.checked = s.render.paletteSwapEnabled;
    paletteGroupSelect.value = normalizePaletteGroup(s.render.paletteGroup);
    paletteIdSelect.value = rebuildPaletteOptions(s.render.paletteGroup, s.render.paletteId);
    lightColorModeSelect.value = s.render.lightColorModeOverride;
    lightStrengthSelect.value = s.render.lightStrengthOverride;
    paletteHudDebugOverlayInput.checked = s.render.paletteHudDebugOverlayEnabled === true;
    darknessMaskDebugInput.checked = s.render.darknessMaskDebugDisabled === true;
    const isUserMode = !!(s as any).game?.userModeEnabled;
    debugLayerToggleBtn.hidden = isUserMode;
    if (isUserMode) setOpen(false);
  };

  const setOpen = (open: boolean) => {
    layer.hidden = !open;
    if (open) syncFromSettings();
  };

  layer.addEventListener("click", (ev) => {
    if (ev.target === layer) setOpen(false);
  });
  closeBtn.addEventListener("click", () => setOpen(false));
  debugLayerToggleBtn.addEventListener("click", () => {
    setOpen(layer.hidden);
  });
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("ratgame:settings-changed", syncFromSettings as EventListener);
  }
  syncFromSettings();

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(layer.hidden),
  };
}

async function bootstrap() {
  // Prevent any menu screen flash before the BOOT loading loop takes over.
  const prebootHideIds = [
    "welcomeScreen",
    "mainMenu",
    "characterSelect",
    "mapMenu",
    "paletteLabMenu",
    "innkeeperMenu",
    "settingsMenu",
    "creditsMenu",
    "menu",
    "hud",
    "vitalsOrbRoot",
    "map",
    "levelup",
    "end",
    "dialogBar",
  ];
  for (let i = 0; i < prebootHideIds.length; i++) {
    const el = document.getElementById(prebootHideIds[i]) as HTMLElement | null;
    if (el) el.hidden = true;
  }

  await initUserSettings();
  if (import.meta.env.DEV) {
    validateStarterRelics();
    console.debug("[starterRelics] mapping", STARTER_RELIC_BY_CHARACTER);
  }
  const audioPrefs = getUserSettings().audio;
  const master = Math.max(0, Math.min(1, Number.isFinite(audioPrefs.masterVolume) ? audioPrefs.masterVolume : 1));
  const music = Math.max(0, Math.min(1, Number.isFinite(audioPrefs.musicVolume) ? audioPrefs.musicVolume : 0.6));
  const sfx = Math.max(0, Math.min(1, Number.isFinite(audioPrefs.sfxVolume) ? audioPrefs.sfxVolume : 1));
  setMusicMuted(!!audioPrefs.musicMuted);
  setSfxMuted(!!audioPrefs.sfxMuted);
  setMusicVolume(master * music);
  setSfxVolume(master * sfx);
  const hasPersistedSettings = !!localStorage.getItem("ratgame:userSettings");
  const isPhoneLikeViewport = window.matchMedia("(pointer: coarse)").matches
    && (window.matchMedia("(max-width: 768px)").matches || window.matchMedia("(max-height: 500px)").matches);
  if (!hasPersistedSettings && isPhoneLikeViewport && !getUserSettings().render.performanceMode) {
    updateUserSettings({ render: { performanceMode: true } });
  }
  const devSettingsUi = installDevSettingsUi();

  const refs = getDomRefs();
  applyTheme();
  const mainSettingsPanel = mountSettingsPanel({
    host: refs.mainSettingsHostEl,
    initialTab: "GAME",
    onUserModeChanged: () => {
      window.dispatchEvent(new Event("ratgame:settings-changed"));
    },
    onPerformanceModeChanged: () => {
      window.dispatchEvent(new Event("resize"));
    },
  });
  window.addEventListener("ratgame:settings-changed", () => {
    mainSettingsPanel.refresh();
  });
  refs.settingsBtn.addEventListener("click", () => {
    mainSettingsPanel.refresh();
  });
  window.addEventListener("ratgame:open-dev-tools", () => {
    mainSettingsPanel.refresh();
    devSettingsUi.open();
  });
  const canvas = refs.canvas;
  const uiCanvas = refs.uiCanvas;
  const detachStandaloneViewportFix = installStandaloneViewportFix();
  const rawCtx = canvas.getContext("2d");
  if (!rawCtx) throw new Error("Canvas 2D context not available");
  const ctx = rawCtx;
  const uiRawCtx = uiCanvas.getContext("2d");
  if (!uiRawCtx) throw new Error("UI canvas 2D context not available");
  const uiCtx = uiRawCtx;
  const rootStyle = document.documentElement.style;

  const syncUiSafeRect = () => {
    const world = game.getWorld() as any;
    const safe = world?.cameraSafeRect as
      | { x: number; y: number; width: number; height: number }
      | undefined;
    const x = Math.floor(safe?.x ?? 0);
    const y = Math.floor(safe?.y ?? 0);
    const w = Math.max(1, Math.floor(safe?.width ?? window.innerWidth));
    const h = Math.max(1, Math.floor(safe?.height ?? window.innerHeight));
    rootStyle.setProperty("--safe-x", `${x}px`);
    rootStyle.setProperty("--safe-y", `${y}px`);
    rootStyle.setProperty("--safe-w", `${w}px`);
    rootStyle.setProperty("--safe-h", `${h}px`);
  };

  const syncCanvasResolutionMetadata = () => {
    uiCanvas.dataset.effectiveDpr = canvas.dataset.effectiveDpr;
    uiCanvas.dataset.pixelScale = canvas.dataset.pixelScale;
  };
  const detachWorldCanvasAutoResize = attachCanvasAutoResize(canvas, ctx, syncCanvasResolutionMetadata);
  const detachUiCanvasAutoResize = attachCanvasAutoResize(uiCanvas, uiCtx, syncCanvasResolutionMetadata);
  syncCanvasResolutionMetadata();
  window.addEventListener("beforeunload", () => {
    detachStandaloneViewportFix();
    detachWorldCanvasAutoResize();
    detachUiCanvasAutoResize();
  }, { once: true });

  const game = createGame({
    canvas,
    ctx,
    uiCanvas,
    uiCtx,
    hud: refs.hud,
    ui: refs.ui,
  });

  syncUiSafeRect();

  const returnToPaletteLabMenu = (sublineText: string) => {
    appStateController.setRunState(RunState.PLAYING);
    appStateController.setAppState(AppState.MENU);
    game.quitRunToMenu();
    refs.welcomeScreen.hidden = true;
    refs.mainMenuEl.hidden = true;
    refs.characterSelectEl.hidden = true;
    refs.mapMenuEl.hidden = true;
    refs.paletteLabMenuEl.hidden = false;
    refs.innkeeperMenuEl.hidden = true;
    refs.settingsMenuEl.hidden = true;
    refs.creditsMenuEl.hidden = true;
    refs.ui.menuEl.hidden = true;
    refs.ui.mapEl.root.hidden = true;
    refs.ui.levelupEl.root.hidden = true;
    refs.ui.endEl.root.hidden = true;
    refs.ui.dialogEl.root.hidden = true;
    refs.hud.root.hidden = true;
    refs.hud.vitalsOrbRoot.hidden = true;
    refs.paletteLabSublineEl.textContent = sublineText;
  };

  wireMenus(refs, {
    previewMap: game.previewMap,
    reloadCurrentMapForDebug: game.reloadCurrentMapForDebug,
    startRun: game.startRun,
    startDeterministicRun: game.startDeterministicRun,
    startSandboxRun: game.startSandboxRun,
    openPaletteSnapshot: async (snapshotId: string) => {
      const snapshot = await getPaletteSnapshotRecord(snapshotId);
      if (!snapshot) {
        throw new Error(`Palette snapshot "${snapshotId}" was not found.`);
      }
      game.openPaletteSnapshotRecord(snapshot);
    },
  });
  const snapshotViewerPalettePanel = mountSnapshotViewerPalettePanel({
    onClose: () => {
      returnToPaletteLabMenu("Returned from snapshot viewer.");
    },
    onRerollSeed: () => {
      game.rerollPaletteSnapshotViewerSeed();
    },
  });
  let pauseCogBtn: HTMLButtonElement | null = null;

  function syncUiForAppState(appState: AppState, runState: RunState): void {
    if (appState === AppState.BOOT || appState === AppState.LOADING) {
      game.setMobileControlsEnabled(false);
      refs.welcomeScreen.hidden = true;
      refs.mainMenuEl.hidden = true;
      refs.characterSelectEl.hidden = true;
      refs.mapMenuEl.hidden = true;
      refs.paletteLabMenuEl.hidden = true;
      refs.innkeeperMenuEl.hidden = true;
      refs.settingsMenuEl.hidden = true;
      refs.creditsMenuEl.hidden = true;
      refs.ui.menuEl.hidden = true;
      refs.hud.root.hidden = true;
      refs.hud.vitalsOrbRoot.hidden = true;
      refs.ui.mapEl.root.hidden = true;
      refs.ui.levelupEl.root.hidden = true;
      refs.ui.endEl.root.hidden = true;
      refs.ui.dialogEl.root.hidden = true;
      if (pauseCogBtn) pauseCogBtn.hidden = true;
      return;
    }
    if (appState === AppState.MENU) {
      game.setMobileControlsEnabled(false);
      refs.ui.menuEl.hidden = true;
      refs.hud.root.hidden = true;
      refs.hud.vitalsOrbRoot.hidden = true;
      refs.ui.levelupEl.root.hidden = true;
      refs.ui.endEl.root.hidden = true;
      refs.ui.dialogEl.root.hidden = true;
      if (pauseCogBtn) pauseCogBtn.hidden = true;

      if (!refs.ui.mapEl.root.hidden) {
        refs.welcomeScreen.hidden = true;
        refs.mainMenuEl.hidden = true;
        refs.characterSelectEl.hidden = true;
        refs.mapMenuEl.hidden = true;
        refs.paletteLabMenuEl.hidden = true;
        refs.innkeeperMenuEl.hidden = true;
        refs.settingsMenuEl.hidden = true;
        refs.creditsMenuEl.hidden = true;
        return;
      }

      const hasVisibleMenuScreen =
        !refs.welcomeScreen.hidden
        || !refs.mainMenuEl.hidden
        || !refs.characterSelectEl.hidden
        || !refs.mapMenuEl.hidden
        || !refs.paletteLabMenuEl.hidden
        || !refs.innkeeperMenuEl.hidden
        || !refs.settingsMenuEl.hidden
        || !refs.creditsMenuEl.hidden
        || !refs.ui.mapEl.root.hidden;

      if (!hasVisibleMenuScreen) {
        refs.welcomeScreen.hidden = false;
      }
      return;
    }
    if (appState === AppState.RUN) {
      const w = game.getWorld();
      const isMapOpen = w.state === "MAP" || !refs.ui.mapEl.root.hidden;
      const isPauseOpen = runState === RunState.PAUSED || !refs.ui.menuEl.hidden;
      const isEndOpen = !refs.ui.endEl.root.hidden;
      const isLevelupOpen = !refs.ui.levelupEl.root.hidden;
      const isDialogOpen = !refs.ui.dialogEl.root.hidden;
      const vendorRoot = document.getElementById("vendorShop");
      const relicRewardRoot = document.getElementById("relicReward");
      const isVendorOpen = !!vendorRoot && !vendorRoot.hidden;
      const isRelicRewardOpen = !!relicRewardRoot && !relicRewardRoot.hidden;
      const isAnyBlockingOverlayOpen =
        isMapOpen
        || isPauseOpen
        || isEndOpen
        || isLevelupOpen
        || isDialogOpen
        || isVendorOpen
        || isRelicRewardOpen;

      game.setMobileControlsEnabled(runState === RunState.PLAYING && !isAnyBlockingOverlayOpen);
      refs.welcomeScreen.hidden = true;
      refs.mainMenuEl.hidden = true;
      refs.characterSelectEl.hidden = true;
      refs.mapMenuEl.hidden = true;
      refs.paletteLabMenuEl.hidden = true;
      refs.innkeeperMenuEl.hidden = true;
      refs.settingsMenuEl.hidden = true;
      refs.creditsMenuEl.hidden = true;
      refs.ui.menuEl.hidden = runState !== RunState.PAUSED;
      refs.hud.root.hidden = isMapOpen;
      refs.hud.vitalsOrbRoot.hidden = runState === RunState.PAUSED || isMapOpen;
      if (isEndOpen) {
        refs.hud.root.hidden = true;
        refs.hud.vitalsOrbRoot.hidden = true;
      }
      if (pauseCogBtn) pauseCogBtn.hidden = isMapOpen;
    }
  }

  const appStateController = createAppStateController();
  let bootProgress = 0;
  let activeStartIntent: ReturnType<typeof game.consumePendingStartIntent> = null;
  let activeFloorIntent: ReturnType<typeof game.consumePendingFloorLoadIntent> = null;
  let loadingDoneNextState: AppState = AppState.RUN;
  let loadingDoneFramePending = false;
  let cachedDeps: ReturnType<typeof collectFloorDependencies> | null = null;
  let firstRunDiagPending = false;
  let wasPausedVisible = false;

  const pauseMenu = mountPauseMenu({
    root: refs.ui.menuEl,
    actions: {
      onResume: () => {
        appStateController.setRunState(RunState.PLAYING);
        pauseMenu.setVisible(false);
        wasPausedVisible = false;
      },
      onQuitRun: () => {
        appStateController.setRunState(RunState.PLAYING);
        appStateController.setAppState(AppState.MENU);
        activeStartIntent = null;
        activeFloorIntent = null;
        loadingDoneFramePending = false;
        syncUiForAppState(AppState.MENU, appStateController.runState);
        pauseMenu.setVisible(false);
        wasPausedVisible = false;
        devSettingsUi.close();
        game.quitRunToMenu();
      },
      onOpenDevTools: () => {
        devSettingsUi.open();
      },
      onSavePaletteSnapshot: (snapshotDraft) => {
        void buildPaletteSnapshotArtifactFromCanvas(snapshotDraft, refs.canvas)
          .then(async (artifact) => {
            const world = game.getWorld() as any;
            if (!world || typeof world !== "object") return;
            world.paletteSnapshotArtifact = artifact;
            world.paletteSnapshotSavedRecord = await savePaletteSnapshotArtifact(artifact);
            world.paletteSnapshotSaveError = null;
          })
          .catch((err) => {
            const world = game.getWorld() as any;
            if (world && typeof world === "object") {
              world.paletteSnapshotSaveError =
                err instanceof Error ? err.message : "Failed to capture or store snapshot.";
            }
            console.error("[palette-snapshot] Failed to capture or store snapshot.", err);
          });
      },
    },
  });

  pauseCogBtn = document.createElement("button");
  pauseCogBtn.type = "button";
  pauseCogBtn.textContent = "⚙";
  pauseCogBtn.title = "Pause";
  pauseCogBtn.style.position = "fixed";
  pauseCogBtn.style.top = "12px";
  pauseCogBtn.style.right = "12px";
  pauseCogBtn.style.zIndex = "9999";
  pauseCogBtn.style.width = "34px";
  pauseCogBtn.style.height = "34px";
  pauseCogBtn.style.border = "1px solid rgba(255,255,255,0.25)";
  pauseCogBtn.style.borderRadius = "8px";
  pauseCogBtn.style.background = "rgba(20,20,20,0.8)";
  pauseCogBtn.style.color = "#fff";
  pauseCogBtn.style.cursor = "pointer";
  pauseCogBtn.style.pointerEvents = "auto";
  pauseCogBtn.hidden = true;
  pauseCogBtn.addEventListener("click", () => {
    if (appStateController.appState !== AppState.RUN) return;
    togglePause(appStateController, appStateController.appState);
  });
  document.body.appendChild(pauseCogBtn);
  const loadingController = createLoadingController({
    compileMap: async () => {
      cachedDeps = null;
      if (activeStartIntent) {
        game.prepareStartMap(activeStartIntent);
        return;
      }
      if (activeFloorIntent) {
        game.beginFloorLoad(activeFloorIntent);
      }
    },
    precomputeStaticMap: async () => {
      precomputeStaticMapData();
    },
    prewarmDependencies: async () => {
      if (activeStartIntent) {
        await game.prewarmActiveMapSpritesForCurrentPalette();
        return true;
      }
      if (activeFloorIntent) {
        await game.prewarmFloorLoadSprites();
        return true;
      }
      return true;
    },
    primeAudio: async () => {
      const deps = cachedDeps ?? collectFloorDependencies();
      await primeAudio(deps.audioIds);
    },
    spawnEntities: async () => {
      if (activeStartIntent) {
        game.performPreparedStartIntent(activeStartIntent);
        return;
      }
      if (activeFloorIntent) {
        game.finalizeFloorLoad();
      }
    },
    finalize: async () => {
      activeStartIntent = null;
      activeFloorIntent = null;
    },
  });

  const bootTick = () => {
    if (bootProgress < 0.5) {
      game.preloadBootAssets();
      bootProgress = 0.5;
      return;
    }
    bootProgress = 1;
    appStateController.setAppState(AppState.MENU);
  };

  // Runtime render/debug toggles (works outside dev panel too).
  const cyclePaletteRemapWeight = (
    currentValue: (typeof PALETTE_REMAP_WEIGHT_OPTIONS)[number],
  ): (typeof PALETTE_REMAP_WEIGHT_OPTIONS)[number] => {
    const idx = PALETTE_REMAP_WEIGHT_OPTIONS.indexOf(currentValue);
    const currentIdx = idx >= 0 ? idx : 0;
    const nextIdx = (currentIdx + 1) % PALETTE_REMAP_WEIGHT_OPTIONS.length;
    return PALETTE_REMAP_WEIGHT_OPTIONS[nextIdx];
  };

  window.addEventListener("keydown", (ev) => {
    const target = ev.target as HTMLElement | null;
    const active = document.activeElement as HTMLElement | null;
    const isTextEntryElement = (el: HTMLElement | null): boolean => {
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };
    if (isTextEntryElement(target) || isTextEntryElement(active)) return;

    if (ev.repeat) return;

    if (ev.code === "F5") {
      ev.preventDefault();
      const current = getUserSettings().render;
      const group = normalizePaletteGroup(current.paletteGroup);

      if (!current.paletteSwapEnabled) {
        const first = getFirstPaletteInGroup(group);
        updateUserSettings({
          render: {
            paletteSwapEnabled: true,
            paletteGroup: group,
            paletteId: first.id,
          },
        });
        return;
      }

      const next = getNextPaletteInGroup(current.paletteId, group);
      updateUserSettings({
        render: {
          paletteSwapEnabled: true,
          paletteGroup: group,
          paletteId: next.id,
        },
      });
      return;
    }

    if (ev.code === "F6") {
      ev.preventDefault();
      const current = getUserSettings().debug.paletteSWeightPercent;
      updateUserSettings({
        debug: { paletteSWeightPercent: cyclePaletteRemapWeight(current) },
      });
      return;
    }

    if (ev.code === "F7") {
      ev.preventDefault();
      const current = getUserSettings().debug.paletteDarknessPercent;
      updateUserSettings({
        debug: { paletteDarknessPercent: cyclePaletteRemapWeight(current) },
      });
      return;
    }

    if (ev.code === "Escape" && appStateController.appState === AppState.RUN) {
      ev.preventDefault();
      togglePause(appStateController, appStateController.appState);
    }
  });

  let last = performance.now();
  function frame(now: number) {
    const dtReal = Math.min(0.05, (now - last) / 1000);
    last = now;
    syncUiForAppState(appStateController.appState, appStateController.runState);
    const w = game.getWorld() as any;
    snapshotViewerPalettePanel.sync(
      appStateController.appState === AppState.RUN
      && appStateController.runState === RunState.PLAYING
      && !!w?.paletteSnapshotViewerActive
      && w?.state === "MAP",
    );
    uiCtx.setTransform(1, 0, 0, 1, 0, 0);
    uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

    switch (appStateController.appState) {
      case AppState.BOOT:
        bootTick();
        renderLoadingScreen(ctx, bootProgress);
        break;
      case AppState.MENU: {
        const pendingFloorIntent = game.consumePendingFloorLoadIntent();
        if (pendingFloorIntent) {
          activeFloorIntent = pendingFloorIntent;
          loadingDoneNextState = AppState.RUN;
          loadingDoneFramePending = false;
          loadingController.beginMapLoad(pendingFloorIntent.mapId ?? "");
          appStateController.setAppState(AppState.LOADING);
          break;
        }

        const pending = game.consumePendingStartIntent();
        if (pending) {
          if (pending.mode === "SANDBOX") {
            activeStartIntent = pending;
            loadingDoneNextState = AppState.RUN;
            loadingDoneFramePending = false;
            loadingController.beginMapLoad(pending.mapId ?? "");
            appStateController.setAppState(AppState.LOADING);
          } else {
            // DELVE / DETERMINISTIC: do not enter LOADING at character pick.
            game.prepareStartMap(pending);
            game.performPreparedStartIntent(pending);
          }
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        break;
      }
      case AppState.LOADING:
        loadingController.tick();
        renderLoadingScreen(ctx, loadingController.progress);
        if (loadingController.isDone()) {
          if (!loadingDoneFramePending) {
            // Hold one additional rendered loading frame before transition.
            loadingDoneFramePending = true;
          } else {
            appStateController.setAppState(loadingDoneNextState);
            if (loadingDoneNextState === AppState.RUN) {
              appStateController.setRunState(RunState.PLAYING);
              firstRunDiagPending = true;
            }
            loadingDoneFramePending = false;
          }
        }
        break;
      case AppState.RUN:
        // Game world state is authoritative for run -> menu exits (end screen, quit, etc.).
        if (game.getWorld().state === "MENU") {
          game.setMobileControlsEnabled(false);
          appStateController.setRunState(RunState.PLAYING);
          appStateController.setAppState(AppState.MENU);
          break;
        }
        if (appStateController.runState === RunState.PLAYING) {
          const pendingFloorIntent = game.consumePendingFloorLoadIntent();
          if (pendingFloorIntent) {
            activeFloorIntent = pendingFloorIntent;
            loadingController.beginMapLoad(pendingFloorIntent.mapId ?? "");
            appStateController.setAppState(AppState.LOADING);
            renderLoadingScreen(ctx, loadingController.progress);
            break;
          }
        }
        if (appStateController.runState === RunState.PLAYING) {
          game.update(dtReal);
        }
        game.render();
        syncUiSafeRect();
        if (appStateController.runState === RunState.PAUSED) {
          refs.hud.vitalsOrbRoot.hidden = true;
          if (!wasPausedVisible) {
            pauseMenu.setVisible(true);
            pauseMenu.render(game.getWorld());
            wasPausedVisible = true;
          }
        } else {
          const st = game.getWorld().state;
          refs.hud.vitalsOrbRoot.hidden = st === "MAP" || st === "MENU";
          if (wasPausedVisible) {
            pauseMenu.setVisible(false);
            wasPausedVisible = false;
          }
        }
        if (firstRunDiagPending) {
          firstRunDiagPending = false;
          const deps = collectFloorDependencies();
          const paletteId = resolveActivePaletteId();
          const notReady = deps.spriteIds.filter((id) => !getSpriteByIdForPalette(id, paletteId).ready);
          if (notReady.length > 0) {
            console.warn(
              `[loading] First RUN frame had ${notReady.length} not-ready sprites (showing up to 20):`,
              notReady.slice(0, 20),
            );
          }
        }
        break;
      default:
        break;
    }

    syncUiSafeRect();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

void bootstrap();

// NOTE: no startBtn handler here -- game.ts owns menu click-to-start,
// and reads startBtn.dataset.weapon.
