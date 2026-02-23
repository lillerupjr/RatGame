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
  if (!import.meta.env.DEV) return;

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
  panel.style.minWidth = "220px";
  panel.style.padding = "10px";
  panel.style.border = "1px solid rgba(255,255,255,0.18)";
  panel.style.borderRadius = "10px";
  panel.style.background = "rgba(10,10,10,0.92)";
  panel.style.color = "#fff";
  panel.style.font = "12px monospace";
  panel.style.boxShadow = "0 8px 24px rgba(0,0,0,0.4)";
  root.appendChild(panel);

  const title = document.createElement("div");
  title.textContent = "Debug Settings";
  title.style.fontWeight = "700";
  title.style.marginBottom = "8px";
  panel.appendChild(title);

  type SettingsDebug = ReturnType<typeof getUserSettings>["debug"];
  const checks = new Map<BooleanDebugSettingKey, HTMLInputElement>();

  const addToggle = (key: BooleanDebugSettingKey, label: string) => {
    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = "10px";
    row.style.padding = "4px 0";
    row.style.cursor = "pointer";

    const text = document.createElement("span");
    text.textContent = label;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.addEventListener("change", () => {
      updateUserSettings({ debug: { [key]: input.checked } });
    });

    row.appendChild(text);
    row.appendChild(input);
    panel.appendChild(row);
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
  entityShadowsText.textContent = "entityShadowsEnabled";
  const entityShadowsInput = document.createElement("input");
  entityShadowsInput.type = "checkbox";
  entityShadowsInput.addEventListener("change", () => {
    updateUserSettings({
      render: {
        entityShadowsEnabled: entityShadowsInput.checked,
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
  entityAnchorsText.textContent = "entityAnchorsEnabled";
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
  paletteIdText.textContent = "paletteId";
  const paletteIdSelect = document.createElement("select");
  paletteIdSelect.style.background = "rgba(20,20,20,0.9)";
  paletteIdSelect.style.color = "#fff";
  paletteIdSelect.style.border = "1px solid rgba(255,255,255,0.25)";
  paletteIdSelect.style.borderRadius = "4px";
  for (const id of ["db32", "divination", "cyberpunk"] as const) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    paletteIdSelect.appendChild(opt);
  }
  paletteIdSelect.addEventListener("change", () => {
        updateUserSettings({
      render: {
        paletteId: paletteIdSelect.value as "db32" | "divination" | "cyberpunk",
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
  modeText.textContent = "lightingMaskDebugMode";
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
  waterFlowText.textContent = "waterFlowRate";
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

  const birdTitle = document.createElement("div");
  birdTitle.textContent = "neutralBirdAI";
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
  birdDisableTransitionsText.textContent = "disableTransitions";
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
  birdDrawDebugText.textContent = "drawDebug";
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
  birdForceStateText.textContent = "forceState";
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
  birdRepickTargetText.textContent = "debugRepickTarget";
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
    entityShadowsInput.checked = s.render.entityShadowsEnabled;
    entityAnchorsInput.checked = s.render.entityAnchorsEnabled;
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
  const F5_PALETTE_CYCLE: ReadonlyArray<ReturnType<typeof getUserSettings>["render"]["paletteId"]> = [
    "divination",
    "cyberpunk",
    "sunset_8",
    "s_sunset7",
    "moonlight_15",
    "st8_moonlight",
    "noire_truth",
    "chroma_noir",
    "sunny_swamp",
    "swamp_kin",
    "cobalt_desert_7",
    "lost_in_the_desert",
    "db32",
  ];

  window.addEventListener("keydown", (ev) => {
    if (ev.repeat) return;

    if (ev.code === "F5") {
      ev.preventDefault();
      const current = getUserSettings().render;
      if (!current.paletteSwapEnabled) {
        updateUserSettings({ render: { paletteSwapEnabled: true, paletteId: F5_PALETTE_CYCLE[0] } });
      } else {
        const idx = F5_PALETTE_CYCLE.indexOf(current.paletteId);
        if (idx >= 0 && idx < F5_PALETTE_CYCLE.length - 1) {
          updateUserSettings({ render: { paletteSwapEnabled: true, paletteId: F5_PALETTE_CYCLE[idx + 1] } });
        } else {
          updateUserSettings({ render: { paletteSwapEnabled: false } });
        }
      }
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
