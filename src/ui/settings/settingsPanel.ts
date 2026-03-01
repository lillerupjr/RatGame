import {
  setMusicMuted,
  setMusicVolume,
  setSfxMuted,
  setSfxVolume,
} from "../../game/audio/audioSettings";
import { DEFAULT_SETTINGS, getUserSettings, updateUserSettings } from "../../userSettings";

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

  const graphicsHeader = document.createElement("h4");
  graphicsHeader.className = "settingsCategoryTitle";
  graphicsHeader.textContent = "Graphics";
  graphicsPanel.appendChild(graphicsHeader);

  const performanceModeRow = createToggleRow("Performance mode");
  graphicsPanel.appendChild(performanceModeRow.row);

  const audioHeader = document.createElement("h4");
  audioHeader.className = "settingsCategoryTitle";
  audioHeader.textContent = "Audio";
  audioPanel.appendChild(audioHeader);

  const masterRow = createSliderRow("Master volume", 0, 1, 0.01);
  const musicRow = createSliderRow("Music volume", 0, 1, 0.01);
  const sfxRow = createSliderRow("SFX volume", 0, 1, 0.01);
  audioPanel.appendChild(masterRow.row);
  audioPanel.appendChild(musicRow.row);
  audioPanel.appendChild(sfxRow.row);

  const musicMuteRow = createToggleRow("Mute music");
  const sfxMuteRow = createToggleRow("Mute SFX");
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

  const syncSliders = () => {
    const audio = readSettings().audio;
    masterRow.slider.value = `${clamp01(audio.masterVolume)}`;
    musicRow.slider.value = `${clamp01(audio.musicVolume)}`;
    sfxRow.slider.value = `${clamp01(audio.sfxVolume)}`;
    masterRow.value.textContent = `${Math.round(clamp01(audio.masterVolume) * 100)}%`;
    musicRow.value.textContent = `${Math.round(clamp01(audio.musicVolume) * 100)}%`;
    sfxRow.value.textContent = `${Math.round(clamp01(audio.sfxVolume) * 100)}%`;
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

  const refresh = () => {
    const settings = readSettings();
    userModeRow.input.checked = !!settings.game.userModeEnabled;
    updateHealthOrbSideUi(settings.game.healthOrbSide);
    performanceModeRow.input.checked = !!settings.render.performanceMode;

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

  return {
    element: root,
    refresh,
    destroy() {
      root.remove();
    },
  };
}
