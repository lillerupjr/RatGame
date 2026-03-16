import {
  setMusicMuted,
  setMusicVolume,
  setSfxMuted,
  setSfxVolume,
} from "../../game/audio/audioSettings";
import {
  DEFAULT_GAME_SPEED,
  DEFAULT_SETTINGS,
  clampVisibleVerticalTiles,
  clampGameSpeed,
  getUserSettings,
  MAX_GAME_SPEED,
  MAX_VISIBLE_VERTICAL_TILES,
  MIN_GAME_SPEED,
  MIN_VISIBLE_VERTICAL_TILES,
  resolveVerticalTiles,
  type VerticalTilesMode,
  updateUserSettings,
} from "../../userSettings";

export type SettingsTabId = "GAME" | "GRAPHICS" | "AUDIO";

export type MountSettingsPanelOptions = {
  host: HTMLElement;
  initialTab?: SettingsTabId;
  onUserModeChanged?: (enabled: boolean) => void;
  onPerformanceModeChanged?: () => void;
};

export type SettingsPanelController = {
  element: HTMLDivElement;
  refresh(): void;
  destroy(): void;
};

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function clampInt(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function readSettings() {
  const raw = getUserSettings() as any;
  return {
    game: {
      ...DEFAULT_SETTINGS.game,
      ...(raw?.game ?? {}),
    },
    render: {
      ...DEFAULT_SETTINGS.render,
      ...(raw?.render ?? {}),
    },
    audio: {
      ...DEFAULT_SETTINGS.audio,
      ...(raw?.audio ?? {}),
    },
  };
}

function applyAudioPreferencesFromSettings(): void {
  const settings = readSettings().audio;
  const master = clamp01(settings.masterVolume);
  const music = clamp01(settings.musicVolume);
  const sfx = clamp01(settings.sfxVolume);
  setMusicMuted(!!settings.musicMuted);
  setSfxMuted(!!settings.sfxMuted);
  setMusicVolume(master * music);
  setSfxVolume(master * sfx);
}

function createTabButton(label: string, id: SettingsTabId): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "settingsTabBtn";
  btn.textContent = label;
  btn.setAttribute("data-settings-tab", id);
  return btn;
}

function createToggleRow(label: string, helper?: string): {
  row: HTMLLabelElement;
  input: HTMLInputElement;
} {
  const row = document.createElement("label");
  row.className = "settingsRow";

  const left = document.createElement("div");
  left.className = "settingsRowLabelWrap";

  const text = document.createElement("div");
  text.className = "settingsRowLabel";
  text.textContent = label;
  left.appendChild(text);

  if (helper) {
    const help = document.createElement("div");
    help.className = "settingsRowHelper";
    help.textContent = helper;
    left.appendChild(help);
  }

  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "settingsToggle";

  row.appendChild(left);
  row.appendChild(input);
  return { row, input };
}

function createSliderRow(label: string, min: number, max: number, step: number): {
  row: HTMLDivElement;
  slider: HTMLInputElement;
  value: HTMLSpanElement;
} {
  const row = document.createElement("div");
  row.className = "settingsRow settingsSliderRow";

  const left = document.createElement("div");
  left.className = "settingsRowLabelWrap";
  const text = document.createElement("div");
  text.className = "settingsRowLabel";
  text.textContent = label;
  left.appendChild(text);

  const sliderWrap = document.createElement("div");
  sliderWrap.className = "settingsSliderWrap";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = `${min}`;
  slider.max = `${max}`;
  slider.step = `${step}`;
  slider.className = "settingsSlider";

  const value = document.createElement("span");
  value.className = "settingsSliderValue";

  sliderWrap.appendChild(slider);
  sliderWrap.appendChild(value);

  row.appendChild(left);
  row.appendChild(sliderWrap);
  return { row, slider, value };
}

export function mountSettingsPanel(options: MountSettingsPanelOptions): SettingsPanelController {
  const activeHost = options.host;
  const root = document.createElement("div");
  root.className = "settingsPanelRoot";

  const tabs = document.createElement("div");
  tabs.className = "settingsTabs";

  const gameTabBtn = createTabButton("Game", "GAME");
  const graphicsTabBtn = createTabButton("Graphics", "GRAPHICS");
  const audioTabBtn = createTabButton("Audio", "AUDIO");
  tabs.appendChild(gameTabBtn);
  tabs.appendChild(graphicsTabBtn);
  tabs.appendChild(audioTabBtn);

  const body = document.createElement("div");
  body.className = "settingsBody";

  const gamePanel = document.createElement("section");
  gamePanel.className = "settingsCategoryPanel";
  gamePanel.setAttribute("data-settings-panel", "GAME");

  const graphicsPanel = document.createElement("section");
  graphicsPanel.className = "settingsCategoryPanel";
  graphicsPanel.setAttribute("data-settings-panel", "GRAPHICS");

  const audioPanel = document.createElement("section");
  audioPanel.className = "settingsCategoryPanel";
  audioPanel.setAttribute("data-settings-panel", "AUDIO");

  const gameHeader = document.createElement("h4");
  gameHeader.className = "settingsCategoryTitle";
  gameHeader.textContent = "Game";
  gamePanel.appendChild(gameHeader);

  const userModeRow = createToggleRow(
    "User Mode (hide dev tools)",
    "Hides debug and tuning UI. Recommended for normal play.",
  );
  userModeRow.input.setAttribute("data-settings-user-mode", "1");
  gamePanel.appendChild(userModeRow.row);

  const healthOrbRow = document.createElement("div");
  healthOrbRow.className = "settingsRow";
  const healthOrbLabelWrap = document.createElement("div");
  healthOrbLabelWrap.className = "settingsRowLabelWrap";
  const healthOrbLabel = document.createElement("div");
  healthOrbLabel.className = "settingsRowLabel";
  healthOrbLabel.textContent = "Health orb position";
  healthOrbLabelWrap.appendChild(healthOrbLabel);
  const healthOrbSegment = document.createElement("div");
  healthOrbSegment.className = "settingsSegment";
  const orbLeftBtn = document.createElement("button");
  orbLeftBtn.type = "button";
  orbLeftBtn.textContent = "Left";
  orbLeftBtn.className = "settingsSegmentBtn";
  orbLeftBtn.setAttribute("data-health-orb-side", "left");
  const orbRightBtn = document.createElement("button");
  orbRightBtn.type = "button";
  orbRightBtn.textContent = "Right";
  orbRightBtn.className = "settingsSegmentBtn";
  orbRightBtn.setAttribute("data-health-orb-side", "right");
  healthOrbSegment.appendChild(orbLeftBtn);
  healthOrbSegment.appendChild(orbRightBtn);
  healthOrbRow.appendChild(healthOrbLabelWrap);
  healthOrbRow.appendChild(healthOrbSegment);
  gamePanel.appendChild(healthOrbRow);

  const gameSpeedRow = createSliderRow(
    "Game speed",
    MIN_GAME_SPEED,
    MAX_GAME_SPEED,
    0.05,
  );
  gameSpeedRow.slider.setAttribute("data-game-speed-slider", "1");
  gamePanel.appendChild(gameSpeedRow.row);

  const deathSlowdownRow = createToggleRow("Death slowmo");
  deathSlowdownRow.input.setAttribute("data-death-slowmo-toggle", "1");
  gamePanel.appendChild(deathSlowdownRow.row);

  const graphicsHeader = document.createElement("h4");
  graphicsHeader.className = "settingsCategoryTitle";
  graphicsHeader.textContent = "Graphics";
  graphicsPanel.appendChild(graphicsHeader);

  const performanceModeRow = createToggleRow("Performance mode");
  performanceModeRow.input.setAttribute("data-performance-mode-toggle", "1");
  graphicsPanel.appendChild(performanceModeRow.row);

  const cameraSmoothingRow = createToggleRow("Camera smoothing");
  cameraSmoothingRow.input.setAttribute("data-camera-smoothing-toggle", "1");
  graphicsPanel.appendChild(cameraSmoothingRow.row);

  const verticalTilesModeRow = document.createElement("div");
  verticalTilesModeRow.className = "settingsRow";
  const verticalTilesModeLabelWrap = document.createElement("div");
  verticalTilesModeLabelWrap.className = "settingsRowLabelWrap";
  const verticalTilesModeLabel = document.createElement("div");
  verticalTilesModeLabel.className = "settingsRowLabel";
  verticalTilesModeLabel.textContent = "Vertical tiles mode";
  verticalTilesModeLabelWrap.appendChild(verticalTilesModeLabel);
  const verticalTilesModeSegment = document.createElement("div");
  verticalTilesModeSegment.className = "settingsSegment";
  const verticalTilesModeAutoBtn = document.createElement("button");
  verticalTilesModeAutoBtn.type = "button";
  verticalTilesModeAutoBtn.className = "settingsSegmentBtn";
  verticalTilesModeAutoBtn.textContent = "Auto";
  verticalTilesModeAutoBtn.setAttribute("data-vertical-tiles-mode", "auto");
  const verticalTilesModeManualBtn = document.createElement("button");
  verticalTilesModeManualBtn.type = "button";
  verticalTilesModeManualBtn.className = "settingsSegmentBtn";
  verticalTilesModeManualBtn.textContent = "Manual";
  verticalTilesModeManualBtn.setAttribute("data-vertical-tiles-mode", "manual");
  verticalTilesModeSegment.appendChild(verticalTilesModeAutoBtn);
  verticalTilesModeSegment.appendChild(verticalTilesModeManualBtn);
  verticalTilesModeRow.appendChild(verticalTilesModeLabelWrap);
  verticalTilesModeRow.appendChild(verticalTilesModeSegment);
  graphicsPanel.appendChild(verticalTilesModeRow);

  const verticalTilesRow = createSliderRow(
    "Vertical tiles",
    MIN_VISIBLE_VERTICAL_TILES,
    MAX_VISIBLE_VERTICAL_TILES,
    1,
  );
  verticalTilesRow.slider.setAttribute("data-vertical-tiles-slider", "1");
  graphicsPanel.appendChild(verticalTilesRow.row);

  // Render padding (tile render radius) — dev-facing but safe to keep here.
  // Range matches renderer clamp expectations (-12..12).
  const renderPaddingRow = createSliderRow("Render padding", -12, 12, 1);
  renderPaddingRow.slider.setAttribute("data-render-padding-slider", "1");
  graphicsPanel.appendChild(renderPaddingRow.row);

  const structureCutoutEnabledRow = createToggleRow("Structure cutout");
  structureCutoutEnabledRow.input.setAttribute("data-structure-cutout-toggle", "1");
  graphicsPanel.appendChild(structureCutoutEnabledRow.row);

  const structureCutoutWidthRow = createSliderRow("Structure cutout width", 0, 12, 1);
  structureCutoutWidthRow.slider.setAttribute("data-structure-cutout-width-slider", "1");
  graphicsPanel.appendChild(structureCutoutWidthRow.row);

  const structureCutoutHeightRow = createSliderRow("Structure cutout height", 0, 12, 1);
  structureCutoutHeightRow.slider.setAttribute("data-structure-cutout-height-slider", "1");
  graphicsPanel.appendChild(structureCutoutHeightRow.row);

  const structureCutoutAlphaRow = createSliderRow("Structure cutout alpha", 0, 1, 0.05);
  structureCutoutAlphaRow.slider.setAttribute("data-structure-cutout-alpha-slider", "1");
  graphicsPanel.appendChild(structureCutoutAlphaRow.row);

  const audioHeader = document.createElement("h4");
  audioHeader.className = "settingsCategoryTitle";
  audioHeader.textContent = "Audio";
  audioPanel.appendChild(audioHeader);

  const masterRow = createSliderRow("Master volume", 0, 1, 0.01);
  const musicRow = createSliderRow("Music volume", 0, 1, 0.01);
  musicRow.slider.setAttribute("data-audio-music-slider", "1");
  const sfxRow = createSliderRow("SFX volume", 0, 1, 0.01);
  sfxRow.slider.setAttribute("data-audio-sfx-slider", "1");
  audioPanel.appendChild(masterRow.row);
  audioPanel.appendChild(musicRow.row);
  audioPanel.appendChild(sfxRow.row);

  const musicMuteRow = createToggleRow("Mute music");
  musicMuteRow.input.setAttribute("data-audio-music-mute", "1");
  const sfxMuteRow = createToggleRow("Mute SFX");
  sfxMuteRow.input.setAttribute("data-audio-sfx-mute", "1");
  audioPanel.appendChild(musicMuteRow.row);
  audioPanel.appendChild(sfxMuteRow.row);

  body.appendChild(gamePanel);
  body.appendChild(graphicsPanel);
  body.appendChild(audioPanel);

  root.appendChild(tabs);
  root.appendChild(body);
  activeHost.appendChild(root);

  let activeTab: SettingsTabId = options.initialTab ?? "GAME";

  const setActiveTab = (tab: SettingsTabId) => {
    activeTab = tab;
    const btns = [gameTabBtn, graphicsTabBtn, audioTabBtn];
    for (const btn of btns) {
      const isActive = btn.getAttribute("data-settings-tab") === tab;
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      btn.classList.toggle("active", isActive);
    }
    gamePanel.hidden = tab !== "GAME";
    graphicsPanel.hidden = tab !== "GRAPHICS";
    audioPanel.hidden = tab !== "AUDIO";
  };

  const updateHealthOrbSideUi = (side: "left" | "right") => {
    orbLeftBtn.classList.toggle("active", side === "left");
    orbRightBtn.classList.toggle("active", side === "right");
    orbLeftBtn.setAttribute("aria-pressed", side === "left" ? "true" : "false");
    orbRightBtn.setAttribute("aria-pressed", side === "right" ? "true" : "false");
  };

  const getViewportDimensions = () => {
    const width = typeof window !== "undefined" && Number.isFinite(window.innerWidth)
      ? window.innerWidth
      : 1280;
    const height = typeof window !== "undefined" && Number.isFinite(window.innerHeight)
      ? window.innerHeight
      : 720;
    return { width, height };
  };

  const setVerticalTilesModeUi = (mode: VerticalTilesMode) => {
    const isAuto = mode === "auto";
    verticalTilesModeAutoBtn.classList.toggle("active", isAuto);
    verticalTilesModeManualBtn.classList.toggle("active", !isAuto);
    verticalTilesModeAutoBtn.setAttribute("aria-pressed", isAuto ? "true" : "false");
    verticalTilesModeManualBtn.setAttribute("aria-pressed", isAuto ? "false" : "true");
  };

  const syncSliders = () => {
    const settings = readSettings();

    const gameSpeed = clampGameSpeed(Number(settings.game.gameSpeed ?? DEFAULT_GAME_SPEED));
    gameSpeedRow.slider.value = `${gameSpeed}`;
    gameSpeedRow.value.textContent = `${gameSpeed.toFixed(2)}x`;

    const audio = settings.audio;
    masterRow.slider.value = `${clamp01(audio.masterVolume)}`;
    musicRow.slider.value = `${clamp01(audio.musicVolume)}`;
    sfxRow.slider.value = `${clamp01(audio.sfxVolume)}`;
    masterRow.value.textContent = `${Math.round(clamp01(audio.masterVolume) * 100)}%`;
    musicRow.value.textContent = `${Math.round(clamp01(audio.musicVolume) * 100)}%`;
    sfxRow.value.textContent = `${Math.round(clamp01(audio.sfxVolume) * 100)}%`;

    const viewport = getViewportDimensions();
    const resolvedVerticalTiles = resolveVerticalTiles(settings.render, viewport.width, viewport.height);
    verticalTilesRow.slider.value = `${resolvedVerticalTiles.effective}`;
    verticalTilesRow.value.textContent = resolvedVerticalTiles.mode === "auto"
      ? `${resolvedVerticalTiles.effective} (${resolvedVerticalTiles.viewportClass} auto)`
      : `${resolvedVerticalTiles.effective}`;
    setVerticalTilesModeUi(resolvedVerticalTiles.mode);

    const pad = clampInt(Number(settings.render.tileRenderRadius), -12, 12);
    renderPaddingRow.slider.value = `${pad}`;
    renderPaddingRow.value.textContent = `${pad}`;

    const cutoutWidth = clampInt(Number(settings.render.structureTriangleCutoutWidth ?? 2), 0, 12);
    structureCutoutWidthRow.slider.value = `${cutoutWidth}`;
    structureCutoutWidthRow.value.textContent = `${cutoutWidth}`;

    const cutoutHeight = clampInt(Number(settings.render.structureTriangleCutoutHeight ?? 2), 0, 12);
    structureCutoutHeightRow.slider.value = `${cutoutHeight}`;
    structureCutoutHeightRow.value.textContent = `${cutoutHeight}`;

    const cutoutAlpha = clamp01(Number(settings.render.structureTriangleCutoutAlpha ?? 0.45));
    structureCutoutAlphaRow.slider.value = `${cutoutAlpha}`;
    structureCutoutAlphaRow.value.textContent = `${Math.round(cutoutAlpha * 100)}%`;
  };

  const applyAudioPatch = (patch: Partial<ReturnType<typeof getUserSettings>["audio"]>) => {
    updateUserSettings({ audio: patch });
    applyAudioPreferencesFromSettings();
    syncSliders();
  };

  const onUserModeToggle = () => {
    const next = !!userModeRow.input.checked;
    updateUserSettings({ game: { userModeEnabled: next } });
    options.onUserModeChanged?.(next);
  };

  const onHealthOrbSide = (side: "left" | "right") => {
    updateUserSettings({ game: { healthOrbSide: side } });
    updateHealthOrbSideUi(side);
  };

  const onPerformanceModeToggle = () => {
    updateUserSettings({ render: { performanceMode: !!performanceModeRow.input.checked } });
    options.onPerformanceModeChanged?.();
  };

  const onDeathSlowdownToggle = () => {
    updateUserSettings({ render: { deathSlowdownEnabled: !!deathSlowdownRow.input.checked } });
  };

  const onCameraSmoothingToggle = () => {
    updateUserSettings({ render: { cameraSmoothingEnabled: !!cameraSmoothingRow.input.checked } });
  };

  const onStructureCutoutToggle = () => {
    updateUserSettings({ render: { structureTriangleCutoutEnabled: !!structureCutoutEnabledRow.input.checked } });
  };

  const onVerticalTilesMode = (mode: VerticalTilesMode) => {
    const settings = readSettings();
    const viewport = getViewportDimensions();
    const resolved = resolveVerticalTiles(settings.render, viewport.width, viewport.height);
    if (mode === "manual") {
      updateUserSettings({
        render: {
          verticalTilesMode: "manual",
          verticalTilesUser: resolved.effective,
          visibleVerticalTiles: resolved.effective,
        },
      });
    } else {
      updateUserSettings({
        render: {
          verticalTilesMode: "auto",
        },
      });
    }
    syncSliders();
  };

  const refresh = () => {
    const settings = readSettings();
    userModeRow.input.checked = !!settings.game.userModeEnabled;
    updateHealthOrbSideUi(settings.game.healthOrbSide);
    performanceModeRow.input.checked = !!settings.render.performanceMode;
    deathSlowdownRow.input.checked = !!settings.render.deathSlowdownEnabled;
    cameraSmoothingRow.input.checked = settings.render.cameraSmoothingEnabled !== false;
    structureCutoutEnabledRow.input.checked = settings.render.structureTriangleCutoutEnabled === true;

    musicMuteRow.input.checked = !!settings.audio.musicMuted;
    sfxMuteRow.input.checked = !!settings.audio.sfxMuted;
    syncSliders();
  };

  gameTabBtn.addEventListener("click", () => setActiveTab("GAME"));
  graphicsTabBtn.addEventListener("click", () => setActiveTab("GRAPHICS"));
  audioTabBtn.addEventListener("click", () => setActiveTab("AUDIO"));

  userModeRow.input.addEventListener("change", onUserModeToggle);
  orbLeftBtn.addEventListener("click", () => onHealthOrbSide("left"));
  orbRightBtn.addEventListener("click", () => onHealthOrbSide("right"));
  performanceModeRow.input.addEventListener("change", onPerformanceModeToggle);
  deathSlowdownRow.input.addEventListener("change", onDeathSlowdownToggle);
  cameraSmoothingRow.input.addEventListener("change", onCameraSmoothingToggle);
  structureCutoutEnabledRow.input.addEventListener("change", onStructureCutoutToggle);
  verticalTilesModeAutoBtn.addEventListener("click", () => onVerticalTilesMode("auto"));
  verticalTilesModeManualBtn.addEventListener("click", () => onVerticalTilesMode("manual"));
  gameSpeedRow.slider.addEventListener("input", () => {
    const v = clampGameSpeed(Number.parseFloat(gameSpeedRow.slider.value));
    updateUserSettings({ game: { gameSpeed: v } });
    syncSliders();
  });
  verticalTilesRow.slider.addEventListener("input", () => {
    const v = clampVisibleVerticalTiles(Number.parseFloat(verticalTilesRow.slider.value));
    const settings = readSettings();
    const viewport = getViewportDimensions();
    const resolved = resolveVerticalTiles(settings.render, viewport.width, viewport.height);
    if (resolved.mode === "manual") {
      updateUserSettings({
        render: {
          verticalTilesUser: v,
          visibleVerticalTiles: v,
        },
      });
    } else if (resolved.viewportClass === "phone") {
      updateUserSettings({ render: { verticalTilesAutoPhone: v } });
    } else {
      updateUserSettings({ render: { verticalTilesAutoDesktop: v } });
    }
    syncSliders();
  });
  renderPaddingRow.slider.addEventListener("input", () => {
    const v = clampInt(Number.parseFloat(renderPaddingRow.slider.value), -12, 12);
    updateUserSettings({ render: { tileRenderRadius: v } });
    syncSliders();
  });
  structureCutoutWidthRow.slider.addEventListener("input", () => {
    const v = clampInt(Number.parseFloat(structureCutoutWidthRow.slider.value), 0, 12);
    updateUserSettings({ render: { structureTriangleCutoutWidth: v } });
    syncSliders();
  });
  structureCutoutHeightRow.slider.addEventListener("input", () => {
    const v = clampInt(Number.parseFloat(structureCutoutHeightRow.slider.value), 0, 12);
    updateUserSettings({ render: { structureTriangleCutoutHeight: v } });
    syncSliders();
  });
  structureCutoutAlphaRow.slider.addEventListener("input", () => {
    const v = clamp01(Number.parseFloat(structureCutoutAlphaRow.slider.value));
    updateUserSettings({ render: { structureTriangleCutoutAlpha: v } });
    syncSliders();
  });

  masterRow.slider.addEventListener("input", () => {
    applyAudioPatch({ masterVolume: clamp01(Number.parseFloat(masterRow.slider.value)) });
  });
  musicRow.slider.addEventListener("input", () => {
    applyAudioPatch({ musicVolume: clamp01(Number.parseFloat(musicRow.slider.value)) });
  });
  sfxRow.slider.addEventListener("input", () => {
    applyAudioPatch({ sfxVolume: clamp01(Number.parseFloat(sfxRow.slider.value)) });
  });

  musicMuteRow.input.addEventListener("change", () => {
    applyAudioPatch({ musicMuted: !!musicMuteRow.input.checked });
  });
  sfxMuteRow.input.addEventListener("change", () => {
    applyAudioPatch({ sfxMuted: !!sfxMuteRow.input.checked });
  });

  setActiveTab(activeTab);
  refresh();
  applyAudioPreferencesFromSettings();
  const onResize = () => syncSliders();
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("resize", onResize);
  }

  return {
    element: root,
    refresh,
    destroy() {
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("resize", onResize);
      }
      root.remove();
    },
  };
}
