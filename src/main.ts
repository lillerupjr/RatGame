// src/main.ts
import { createGame, precomputeStaticMapData } from "./game/game";
import { AppState, RunState, createAppStateController } from "./game/app/appState";
import { attachLoadProfilerGlobal, createLoadingController } from "./game/app/loadingFlow";
import { renderLoadingScreen } from "./game/app/loadingScreen";
import { collectFloorDependencies } from "./game/loading/dependencyCollector";
import { primeAudio } from "./game/audio/audioManager";
import { setMusicMuted, setMusicVolume, setSfxMuted, setSfxVolume } from "./game/audio/audioSettings";
import { resolveActivePaletteVariantKey } from "./game/render/activePalette";
import { getSpriteByIdForVariantKey } from "./engine/render/sprites/renderSprites";
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
  PALETTE_REMAP_WEIGHT_OPTIONS,
} from "./debugSettings";
import { getUserSettings, initUserSettings, updateUserSettings } from "./userSettings";
import { mountPauseMenu } from "./ui/pause/pauseMenu";
import { togglePause } from "./game/app/pauseController";
import { mountSettingsPanel } from "./ui/settings/settingsPanel";
import { installDevToolsPanel } from "./ui/devTools/devToolsPanel";
import { STARTER_CLUSTER_JEWELS, validateStarterClusterJewels } from "./game/cluster_jewels/starterJewels";
import { validateClusterJewelContent } from "./game/cluster_jewels/content";
import { STARTER_RELIC_BY_CHARACTER, validateStarterRelics } from "./game/content/starterRelics";
import { installStandaloneViewportFix } from "./game/app/viewportSizing";
import { buildPaletteSnapshotArtifactFromCanvas } from "./game/paletteLab/snapshotThumbnail";
import { getPaletteSnapshotRecord, savePaletteSnapshotArtifact } from "./game/paletteLab/snapshotStorage";
import { mountSnapshotViewerPalettePanel } from "./ui/paletteLab/snapshotViewerPalettePanel";
import {
  attachWebGLWorldSurface,
  getRenderableWebGLWorldSurface,
  getWebGLWorldSurfaceFailureReason,
  noteWebGLWorldSurfaceFailure,
  syncWorldCanvasBackendVisibility,
} from "./game/systems/presentation/backend/webglSurface";
import {
  resolveRenderBackendSelection,
  WEBGL_INIT_UNAVAILABLE_REASON,
} from "./game/systems/presentation/backend/renderBackendSelection";

type DevSettingsUiController = {
  open(): void;
  close(): void;
  toggle(): void;
};

function installDevSettingsUi(): DevSettingsUiController {
  return installDevToolsPanel();
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
    validateClusterJewelContent();
    validateStarterClusterJewels();
    validateStarterRelics();
    console.debug("[clusterJewels] starters", STARTER_CLUSTER_JEWELS);
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
  const webglCanvas = document.createElement("canvas");
  webglCanvas.id = "c-webgl";
  webglCanvas.setAttribute("aria-hidden", "true");
  canvas.insertAdjacentElement("afterend", webglCanvas);
  const detachStandaloneViewportFix = installStandaloneViewportFix();
  const rawCtx = canvas.getContext("2d");
  if (!rawCtx) throw new Error("Canvas 2D context not available");
  const ctx = rawCtx;
  const webglCtx = webglCanvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  });
  if (webglCtx) {
    attachWebGLWorldSurface(canvas, {
      canvas: webglCanvas,
      gl: webglCtx,
    });
  } else {
    noteWebGLWorldSurfaceFailure(canvas, WEBGL_INIT_UNAVAILABLE_REASON);
  }
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
    webglCanvas.width = canvas.width;
    webglCanvas.height = canvas.height;
    webglCanvas.dataset.effectiveDpr = canvas.dataset.effectiveDpr;
    webglCanvas.dataset.pixelScale = canvas.dataset.pixelScale;
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
  const resolveWorldSnapshotCanvas = () => {
    const backendSelection = resolveRenderBackendSelection(
      getUserSettings().render as any,
      getRenderableWebGLWorldSurface(canvas),
      getWebGLWorldSurfaceFailureReason(canvas),
    );
    const webglSurface = getRenderableWebGLWorldSurface(canvas);
    return backendSelection.selectedBackend === "webgl" && webglSurface ? webglSurface.canvas : canvas;
  };

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
      const isDialogOpen = !refs.ui.dialogEl.root.hidden;
      const vendorRoot = document.getElementById("vendorShop");
      const relicRewardRoot = document.getElementById("relicReward");
      const isVendorOpen = !!vendorRoot && !vendorRoot.hidden;
      const isRelicRewardOpen = !!relicRewardRoot && !relicRewardRoot.hidden;
      const isAnyBlockingOverlayOpen =
        isMapOpen
        || isPauseOpen
        || isEndOpen
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
  const syncWorldBackendSurface = () => {
    const backendSelection = resolveRenderBackendSelection(
      getUserSettings().render as any,
      getRenderableWebGLWorldSurface(canvas),
      getWebGLWorldSurfaceFailureReason(canvas),
    );
    syncWorldCanvasBackendVisibility(canvas, backendSelection.selectedBackend, appStateController.appState === AppState.RUN);
  };
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
        void buildPaletteSnapshotArtifactFromCanvas(snapshotDraft, resolveWorldSnapshotCanvas())
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
  let activeFloorLoadReady = true;
  const loadingController = createLoadingController({
    compileMap: async () => {
      cachedDeps = null;
      if (activeStartIntent) {
        await game.prepareStartMap(activeStartIntent);
        return;
      }
      if (activeFloorIntent) {
        activeFloorLoadReady = await game.beginFloorLoad(activeFloorIntent);
      }
    },
    precomputeStaticMap: async () => {
      precomputeStaticMapData();
    },
    prewarmDependencies: async () => {
      if (activeStartIntent) {
        return game.prewarmActiveMapSpritesForCurrentPalette();
      }
      if (activeFloorIntent) {
        if (!activeFloorLoadReady) return true;
        return game.prewarmFloorLoadSprites();
      }
      return true;
    },
    prepareStructureTriangles: async () => {
      if (activeFloorIntent && !activeFloorLoadReady) return true;
      return game.prepareRuntimeStructureTrianglesForLoading();
    },
    primeAudio: async () => {
      const deps = cachedDeps ?? collectFloorDependencies();
      await primeAudio(deps.audioIds);
    },
    spawnEntities: async () => {
      if (activeStartIntent) {
        await game.performPreparedStartIntent(activeStartIntent);
        return;
      }
      if (activeFloorIntent) {
        if (!activeFloorLoadReady) return;
        game.finalizeFloorLoad();
      }
    },
    finalize: async () => {
      activeStartIntent = null;
      activeFloorIntent = null;
      activeFloorLoadReady = true;
    },
  });
  attachLoadProfilerGlobal({
    getSummary: () => loadingController.getSummary(),
    getPhases: () => loadingController.getPhases(),
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

    if (ev.code === "F2") {
      ev.preventDefault();
      void game.copyPerfOverlaySnapshot();
      return;
    }

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
    syncWorldBackendSurface();
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
          activeFloorLoadReady = true;
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
            void game.prepareStartMap(pending);
            void game.performPreparedStartIntent(pending);
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
            activeFloorLoadReady = true;
            loadingController.beginMapLoad(pendingFloorIntent.mapId ?? "");
            appStateController.setAppState(AppState.LOADING);
            renderLoadingScreen(ctx, loadingController.progress);
            break;
          }
        }
        if (appStateController.runState === RunState.PLAYING) {
          game.update(dtReal);
        }
        game.render(dtReal);
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
          loadingController.markFirstVisibleFrame();
          const deps = collectFloorDependencies();
          const paletteVariantKey = resolveActivePaletteVariantKey();
          const notReady = deps.spriteIds.filter((id) => !getSpriteByIdForVariantKey(id, paletteVariantKey).ready);
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
