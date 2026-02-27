// src/main.ts
import { createGame, precomputeStaticMapData } from "./game/game";
import { AppState, RunState, createAppStateController } from "./game/app/appState";
import { createLoadingController } from "./game/app/loadingFlow";
import { renderLoadingScreen } from "./game/app/loadingScreen";
import { collectFloorDependencies } from "./game/loading/dependencyCollector";
import { primeAudio } from "./game/audio/audioManager";
import { resolveActivePaletteId } from "./game/render/activePalette";
import { getSpriteByIdForPalette } from "./engine/render/sprites/renderSprites";
import { defaultPixelScaleForViewport, resizeCanvasPixelPerfect } from "./engine/render/pixelPerfect";
import { getDomRefs } from "./ui/domRefs";
import { wireMenus } from "./ui/menuWiring";
import {
  DEBUG_TOGGLE_DEFINITIONS,
  LIGHTING_MASK_DEBUG_MODES,
  NEUTRAL_BIRD_FORCE_STATES,
  makeAllDebugOffSettings,
  type BooleanDebugSettingKey,
} from "./debugSettings";
import { getUserSettings, initUserSettings, updateUserSettings } from "./userSettings";
import { mountPauseMenu } from "./ui/pause/pauseMenu";
import { togglePause } from "./game/app/pauseController";

function installDevSettingsUi(): void {
  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.top = "12px";
  root.style.right = "12px";
  root.style.zIndex = "9999";
  root.style.pointerEvents = "auto";
  document.body.appendChild(root);

  const cog = document.createElement("button");
  cog.type = "button";
  cog.textContent = "⚙";
  cog.title = "Settings";
  cog.style.width = "34px";
  cog.style.height = "34px";
  cog.style.border = "1px solid rgba(255,255,255,0.25)";
  cog.style.borderRadius = "8px";
  cog.style.background = "rgba(20,20,20,0.8)";
  cog.style.color = "#fff";
  cog.style.cursor = "pointer";
  root.appendChild(cog);

  const panel = document.createElement("div");
  panel.hidden = true;
  panel.style.marginTop = "8px";
  panel.style.width = "420px";
  panel.style.maxHeight = "82vh";
  panel.style.overflowY = "auto";
  panel.style.padding = "10px";
  panel.style.border = "1px solid rgba(255,255,255,0.18)";
  panel.style.borderRadius = "10px";
  panel.style.background = "rgba(10,10,10,0.92)";
  panel.style.color = "#fff";
  panel.style.font = "12px monospace";
  panel.style.boxShadow = "0 8px 24px rgba(0,0,0,0.4)";
  root.appendChild(panel);

  const title = document.createElement("div");
  title.textContent = "Debug Tools";
  title.style.fontWeight = "700";
  title.style.marginBottom = "8px";
  panel.appendChild(title);

  type SettingsDebug = ReturnType<typeof getUserSettings>["debug"];
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
    disableLightingOcclusion: "Disable Lighting Occlusion",
    lightingMasks: "Show Lighting Masks",
    mapOverlaysDisabled: "Disable Map Overlays",
    rampFaces: "Show Ramp Faces",
    forceSpawnOverride: "Force Spawn Override",
    godMode: "God Mode",
    entityAnchorOverlay: "Show Entity Anchors",
    pauseDebugCards: "Pause Debug Cards",
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

  const paletteIdRow = document.createElement("label");
  paletteIdRow.style.display = "flex";
  paletteIdRow.style.alignItems = "center";
  paletteIdRow.style.justifyContent = "space-between";
  paletteIdRow.style.gap = "10px";
  paletteIdRow.style.padding = "4px 0";
  const paletteIdText = document.createElement("span");
  paletteIdText.textContent = "Palette";
  const paletteIdSelect = document.createElement("select");
  paletteIdSelect.style.background = "rgba(20,20,20,0.9)";
  paletteIdSelect.style.color = "#fff";
  paletteIdSelect.style.border = "1px solid rgba(255,255,255,0.25)";
  paletteIdSelect.style.borderRadius = "4px";
  const PALETTE_IDS = [
    "db32",
    "divination",
    "cyberpunk",
    "moonlight_15",
    "st8_moonlight",
    "chroma_noir",
    "swamp_kin",
    "lost_in_the_desert",
    "endesga_16",
    "sweetie_16",
    "dawnbringer_16",
    "night_16",
    "fun_16",
    "reha_16",
    "arne_16",
    "lush_sunset",
    "vaporhaze_16",
    "sunset_cave_extended",
  ] as const;

  type PaletteId = (typeof PALETTE_IDS)[number];

  for (const id of PALETTE_IDS) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    paletteIdSelect.appendChild(opt);
  }
  paletteIdSelect.addEventListener("change", () => {
    updateUserSettings({
      render: {
        paletteId: paletteIdSelect.value as PaletteId,
      },
    });
  });
  paletteIdRow.appendChild(paletteIdText);
  paletteIdRow.appendChild(paletteIdSelect);
  panel.appendChild(paletteIdRow);

  const modeRow = document.createElement("label");
  modeRow.style.display = "flex";
  modeRow.style.alignItems = "center";
  modeRow.style.justifyContent = "space-between";
  modeRow.style.gap = "10px";
  modeRow.style.padding = "4px 0";
  const modeText = document.createElement("span");
  modeText.textContent = "Lighting Mask Mode";
  const modeSelect = document.createElement("select");
  modeSelect.style.background = "rgba(20,20,20,0.9)";
  modeSelect.style.color = "#fff";
  modeSelect.style.border = "1px solid rgba(255,255,255,0.25)";
  modeSelect.style.borderRadius = "4px";
  const modes = LIGHTING_MASK_DEBUG_MODES;
  for (let i = 0; i < modes.length; i++) {
    const opt = document.createElement("option");
    opt.value = modes[i];
    opt.textContent = modes[i];
    modeSelect.appendChild(opt);
  }
  modeSelect.addEventListener("change", () => {
    updateUserSettings({
      debug: {
        lightingMaskDebugMode: modeSelect.value as SettingsDebug["lightingMaskDebugMode"],
      },
    });
  });
  modeRow.appendChild(modeText);
  modeRow.appendChild(modeSelect);
  panel.appendChild(modeRow);

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
  dmgMultBtn.style.border = "1px solid rgba(255,255,255,0.25)";
  dmgMultBtn.style.borderRadius = "6px";
  dmgMultBtn.style.background = "rgba(28,28,28,0.95)";
  dmgMultBtn.style.color = "#fff";
  dmgMultBtn.style.cursor = "pointer";
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
  fireRateMultBtn.style.border = "1px solid rgba(255,255,255,0.25)";
  fireRateMultBtn.style.borderRadius = "6px";
  fireRateMultBtn.style.background = "rgba(28,28,28,0.95)";
  fireRateMultBtn.style.color = "#fff";
  fireRateMultBtn.style.cursor = "pointer";
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
  birdEnabledText.textContent = "enabled";
  const birdEnabledInput = document.createElement("input");
  birdEnabledInput.type = "checkbox";
  birdEnabledInput.addEventListener("change", () => {
    updateUserSettings({
      debug: {
        neutralBirdAI: {
          ...getUserSettings().debug.neutralBirdAI,
          enabled: birdEnabledInput.checked,
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
  birdForceStateSelect.style.background = "rgba(20,20,20,0.9)";
  birdForceStateSelect.style.color = "#fff";
  birdForceStateSelect.style.border = "1px solid rgba(255,255,255,0.25)";
  birdForceStateSelect.style.borderRadius = "4px";
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
  offAllBtn.style.border = "1px solid rgba(255,255,255,0.25)";
  offAllBtn.style.borderRadius = "6px";
  offAllBtn.style.background = "rgba(28,28,28,0.95)";
  offAllBtn.style.color = "#fff";
  offAllBtn.style.cursor = "pointer";
  offAllBtn.addEventListener("click", () => {
    updateUserSettings({
      debug: makeAllDebugOffSettings(),
      render: {
        entityShadowsDisable: true,
        entityAnchorsEnabled: false,
        renderPerfCountersEnabled: false,
        paletteSwapEnabled: false,
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
    modeSelect.value = s.debug.lightingMaskDebugMode;
    birdEnabledInput.checked = s.debug.neutralBirdAI.enabled;
    birdDisableTransitionsInput.checked = s.debug.neutralBirdAI.disableTransitions;
    birdDrawDebugInput.checked = s.debug.neutralBirdAI.drawDebug;
    birdForceStateSelect.value = s.debug.neutralBirdAI.forceState;
    birdRepickTargetInput.checked = s.debug.neutralBirdAI.debugRepickTarget;
    waterFlowInput.value = `${s.debug.waterFlowRate}`;
    waterFlowValue.textContent = `${s.debug.waterFlowRate.toFixed(2)}x`;
    dmgMultBtn.textContent = `${s.debug.dmgMult}x`;
    fireRateMultBtn.textContent = `${s.debug.fireRateMult}x`;
    entityShadowsInput.checked = s.render.entityShadowsDisable;
    entityAnchorsInput.checked = s.render.entityAnchorsEnabled;
    renderPerfCountersInput.checked = s.render.renderPerfCountersEnabled;
    paletteSwapInput.checked = s.render.paletteSwapEnabled;
    paletteIdSelect.value = s.render.paletteId;
  };

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    if (open) syncFromSettings();
  };

  cog.addEventListener("click", () => {
    setOpen(panel.hidden);
  });
}

async function bootstrap() {
  // Prevent any menu screen flash before the BOOT loading loop takes over.
  const prebootHideIds = [
    "welcomeScreen",
    "mainMenu",
    "characterSelect",
    "mapMenu",
    "innkeeperMenu",
    "settingsMenu",
    "menu",
    "hud",
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
  installDevSettingsUi();

  const refs = getDomRefs();
  const canvas = refs.canvas;
  const rawCtx = canvas.getContext("2d");
  if (!rawCtx) throw new Error("Canvas 2D context not available");
  const ctx = rawCtx;

  function resize() {
    const pixelScale = defaultPixelScaleForViewport(window.innerWidth, window.innerHeight);
    resizeCanvasPixelPerfect(canvas, ctx, window.innerWidth, window.innerHeight, pixelScale);

    const debugCanvas = document.querySelector("canvas");
    console.log("viewport", {
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      dpr: window.devicePixelRatio,
      canvasW: debugCanvas?.width,
      canvasH: debugCanvas?.height,
      clientW: debugCanvas?.clientWidth,
      clientH: debugCanvas?.clientHeight,
    });
  }
  window.addEventListener("resize", resize);
  resize();

  const game = createGame({
    canvas,
    ctx,
    hud: refs.hud,
    ui: refs.ui,
  });

  wireMenus(refs, game);

  function syncUiForAppState(appState: AppState): void {
    if (appState === AppState.BOOT || appState === AppState.LOADING) {
      refs.welcomeScreen.hidden = true;
      refs.mainMenuEl.hidden = true;
      refs.characterSelectEl.hidden = true;
      refs.mapMenuEl.hidden = true;
      refs.innkeeperMenuEl.hidden = true;
      refs.settingsMenuEl.hidden = true;
      refs.ui.menuEl.hidden = true;
      refs.hud.root.hidden = true;
      refs.ui.mapEl.root.hidden = true;
      refs.ui.levelupEl.root.hidden = true;
      refs.ui.endEl.root.hidden = true;
      refs.ui.dialogEl.root.hidden = true;
      return;
    }
    if (appState === AppState.MENU) {
      refs.ui.menuEl.hidden = true;
      refs.hud.root.hidden = true;
      refs.ui.levelupEl.root.hidden = true;
      refs.ui.endEl.root.hidden = true;
      refs.ui.dialogEl.root.hidden = true;

      if (!refs.ui.mapEl.root.hidden) {
        refs.welcomeScreen.hidden = true;
        refs.mainMenuEl.hidden = true;
        refs.characterSelectEl.hidden = true;
        refs.mapMenuEl.hidden = true;
        refs.innkeeperMenuEl.hidden = true;
        refs.settingsMenuEl.hidden = true;
        return;
      }

      const hasVisibleMenuScreen =
        !refs.welcomeScreen.hidden
        || !refs.mainMenuEl.hidden
        || !refs.characterSelectEl.hidden
        || !refs.mapMenuEl.hidden
        || !refs.innkeeperMenuEl.hidden
        || !refs.settingsMenuEl.hidden
        || !refs.ui.mapEl.root.hidden;

      if (!hasVisibleMenuScreen) {
        refs.welcomeScreen.hidden = false;
      }
      return;
    }
    if (appState === AppState.RUN) {
      refs.welcomeScreen.hidden = true;
      refs.mainMenuEl.hidden = true;
      refs.characterSelectEl.hidden = true;
      refs.mapMenuEl.hidden = true;
      refs.innkeeperMenuEl.hidden = true;
      refs.settingsMenuEl.hidden = true;
      refs.ui.menuEl.hidden = true;
      refs.hud.root.hidden = false;
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

  const pauseMenu = mountPauseMenu({
    root: refs.ui.menuEl,
    actions: {
      onResume: () => {
        appStateController.setRunState(RunState.PLAYING);
        pauseMenu.setVisible(false);
      },
      onQuitRun: () => {
        appStateController.setRunState(RunState.PLAYING);
        appStateController.setAppState(AppState.MENU);
        activeStartIntent = null;
        activeFloorIntent = null;
        loadingDoneFramePending = false;
        syncUiForAppState(AppState.MENU);
        pauseMenu.setVisible(false);
        game.quitRunToMenu();
      },
    },
  });
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
  window.addEventListener("keydown", (ev) => {
    if (ev.repeat) return;

    if (ev.code === "F5") {
      ev.preventDefault();
      const PALETTE_CYCLE = [
        "db32",
        "divination",
        "cyberpunk",
        "moonlight_15",
        "st8_moonlight",
        "chroma_noir",
        "swamp_kin",
        "lost_in_the_desert",
        "endesga_16",
        "sweetie_16",
        "dawnbringer_16",
        "night_16",
        "fun_16",
        "reha_16",
        "arne_16",
        "lush_sunset",
        "vaporhaze_16",
        "sunset_cave_extended",
      ] as const;

      type PaletteId = (typeof PALETTE_CYCLE)[number];

      const current = getUserSettings().render;

      if (!current.paletteSwapEnabled) {
        updateUserSettings({ render: { paletteSwapEnabled: true, paletteId: PALETTE_CYCLE[0] as PaletteId } });
        return;
      }

      const idx = Math.max(0, PALETTE_CYCLE.indexOf(current.paletteId as PaletteId));
      const nextIdx = idx + 1;

      if (nextIdx >= PALETTE_CYCLE.length) {
        updateUserSettings({ render: { paletteSwapEnabled: false } });
        return;
      }

      updateUserSettings({ render: { paletteSwapEnabled: true, paletteId: PALETTE_CYCLE[nextIdx] as PaletteId } });
      return;
    }

    if (ev.code === "Escape" && appStateController.appState === AppState.RUN) {
      ev.preventDefault();
      togglePause(appStateController, appStateController.appState, pauseMenu);
    }
  });

  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    syncUiForAppState(appStateController.appState);

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
          game.update(dt);
        }
        game.render();
        if (appStateController.runState === RunState.PAUSED) {
          pauseMenu.setVisible(true);
          pauseMenu.render(game.getWorld());
        } else {
          pauseMenu.setVisible(false);
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

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

void bootstrap();

// NOTE: no startBtn handler here -- game.ts owns menu click-to-start,
// and reads startBtn.dataset.weapon.
