import type { World } from "../../engine/world/world";
import { getCombatModsSnapshot } from "../../game/combat_mods";
import {
  applySfxSettingsToWorld,
  getAudioSettings,
  setMusicMuted,
  setMusicVolume,
  setSfxMuted,
  setSfxVolume,
} from "../../game/audio/audioSettings";
import { getUserSettings, isPauseDebugCardsEnabled, updateUserSettings } from "../../userSettings";
import { getAllCardIds } from "../../game/combat_mods/content/cards/cardPool";
import { getGold } from "../../game/economy/gold";
import { getAllRelicIds, getRelicById, normalizeRelicIdList } from "../../game/content/relics";
import { recomputeDerivedStats } from "../../game/stats/derivedStats";
import { clearBalanceCsv, downloadBalanceCsv, setBalanceCsvEnabled } from "../../game/balance/balanceCsvLogger";

export type PauseMenuActions = {
  onResume(): void;
  onQuitRun(): void;
};

export type PauseMenuController = {
  setVisible(v: boolean): void;
  render(world: World | null): void;
  destroy(): void;
};

function safeNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function clearChildren(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function setDataAttr(el: HTMLElement, name: string): void {
  el.setAttribute(`data-${name}`, "1");
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function num(x: number, digits = 2): string {
  return x.toFixed(digits);
}

function countInstances(arr: unknown, id: string): number {
  if (!Array.isArray(arr)) return 0;
  let count = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === id) count += 1;
  }
  return count;
}

function sumAliveEnemyHp(world: any): number {
  const alive = Array.isArray(world?.eAlive) ? world.eAlive : [];
  const hp = Array.isArray(world?.eHp) ? world.eHp : [];
  const n = Math.min(alive.length, hp.length);
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue;
    total += safeNum(hp[i], 0);
  }
  return total;
}

export function mountPauseMenu(args: {
  root: HTMLDivElement;
  actions: PauseMenuActions;
}): PauseMenuController {
  const root = args.root;
  const preservedChildren = Array.from(root.children).filter((el) => el instanceof HTMLElement) as HTMLElement[];

  const host = document.createElement("div");
  host.className = "pauseOverlay";
  host.hidden = true;

  const panel = document.createElement("div");
  panel.className = "pausePanel";

  const header = document.createElement("div");
  header.className = "pauseHeader";

  const title = document.createElement("div");
  title.className = "title";
  title.classList.add("pauseTitle");
  title.textContent = "Paused";

  const actionsRow = document.createElement("div");
  actionsRow.className = "pauseHeaderButtons";

  const resumeBtn = document.createElement("button");
  resumeBtn.type = "button";
  resumeBtn.className = "pauseBtn pauseResume";
  setDataAttr(resumeBtn, "pause-resume");
  resumeBtn.textContent = "Resume";

  const quitBtn = document.createElement("button");
  quitBtn.type = "button";
  quitBtn.className = "pauseBtn pauseQuit";
  setDataAttr(quitBtn, "pause-quit");
  quitBtn.textContent = "Quit Run";

  actionsRow.appendChild(resumeBtn);
  actionsRow.appendChild(quitBtn);

  const balanceCsvToggleBtn = document.createElement("button");
  balanceCsvToggleBtn.type = "button";
  balanceCsvToggleBtn.className = "pauseBtn";
  setDataAttr(balanceCsvToggleBtn, "balance-csv-toggle");
  balanceCsvToggleBtn.textContent = "Start CSV";

  const balanceCsvClearBtn = document.createElement("button");
  balanceCsvClearBtn.type = "button";
  balanceCsvClearBtn.className = "pauseBtn";
  setDataAttr(balanceCsvClearBtn, "balance-csv-clear");
  balanceCsvClearBtn.textContent = "Clear CSV";

  const balanceCsvDownloadBtn = document.createElement("button");
  balanceCsvDownloadBtn.type = "button";
  balanceCsvDownloadBtn.className = "pauseBtn";
  setDataAttr(balanceCsvDownloadBtn, "balance-csv-download");
  balanceCsvDownloadBtn.textContent = "Download CSV";

  actionsRow.appendChild(balanceCsvToggleBtn);
  actionsRow.appendChild(balanceCsvClearBtn);
  actionsRow.appendChild(balanceCsvDownloadBtn);
  header.appendChild(title);
  header.appendChild(actionsRow);

  const grid = document.createElement("div");
  grid.className = "pauseGrid";

  const audioSection = document.createElement("section");
  audioSection.className = "pauseSection pauseAudio";
  const audioTitle = document.createElement("h3");
  audioTitle.textContent = "Audio";

  const musicRow = document.createElement("label");
  musicRow.className = "audioRow";
  const musicLabel = document.createElement("span");
  musicLabel.textContent = "Music";
  const musicSlider = document.createElement("input");
  musicSlider.type = "range";
  musicSlider.min = "0";
  musicSlider.max = "1";
  musicSlider.step = "0.01";
  setDataAttr(musicSlider, "audio-music-slider");
  const musicMuteBtn = document.createElement("button");
  musicMuteBtn.type = "button";
  setDataAttr(musicMuteBtn, "audio-music-mute");
  musicRow.appendChild(musicLabel);
  musicRow.appendChild(musicSlider);
  musicRow.appendChild(musicMuteBtn);

  const sfxRow = document.createElement("label");
  sfxRow.className = "audioRow";
  const sfxLabel = document.createElement("span");
  sfxLabel.textContent = "SFX";
  const sfxSlider = document.createElement("input");
  sfxSlider.type = "range";
  sfxSlider.min = "0";
  sfxSlider.max = "1";
  sfxSlider.step = "0.01";
  setDataAttr(sfxSlider, "audio-sfx-slider");
  const sfxMuteBtn = document.createElement("button");
  sfxMuteBtn.type = "button";
  setDataAttr(sfxMuteBtn, "audio-sfx-mute");
  sfxRow.appendChild(sfxLabel);
  sfxRow.appendChild(sfxSlider);
  sfxRow.appendChild(sfxMuteBtn);

  const pressureRow = document.createElement("label");
  pressureRow.className = "audioRow";
  const pressureLabel = document.createElement("span");
  pressureLabel.textContent = "Pressure";
  const pressureSlider = document.createElement("input");
  pressureSlider.type = "range";
  pressureSlider.min = "0.25";
  pressureSlider.max = "3";
  pressureSlider.step = "0.05";
  pressureSlider.value = "1";
  setDataAttr(pressureSlider, "spawn-pressure-slider");
  const pressureValue = document.createElement("span");
  pressureValue.textContent = "1.00x";
  pressureValue.className = "pauseMeta";
  setDataAttr(pressureValue, "spawn-pressure-value");
  pressureRow.appendChild(pressureLabel);
  pressureRow.appendChild(pressureSlider);
  pressureRow.appendChild(pressureValue);

  const spawnRateOrbRow = document.createElement("label");
  spawnRateOrbRow.className = "audioRow";
  const spawnRateOrbLabel = document.createElement("span");
  spawnRateOrbLabel.textContent = "Spawn Orb";
  const spawnRateOrbSlider = document.createElement("input");
  spawnRateOrbSlider.type = "range";
  spawnRateOrbSlider.min = "0.80";
  spawnRateOrbSlider.max = "1.50";
  spawnRateOrbSlider.step = "0.01";
  setDataAttr(spawnRateOrbSlider, "spawn-rate-orb-slider");
  const spawnRateOrbValue = document.createElement("span");
  spawnRateOrbValue.textContent = "1.12";
  spawnRateOrbValue.className = "pauseMeta";
  setDataAttr(spawnRateOrbValue, "spawn-rate-orb-value");
  spawnRateOrbRow.appendChild(spawnRateOrbLabel);
  spawnRateOrbRow.appendChild(spawnRateOrbSlider);
  spawnRateOrbRow.appendChild(spawnRateOrbValue);

  const monsterHealthOrbRow = document.createElement("label");
  monsterHealthOrbRow.className = "audioRow";
  const monsterHealthOrbLabel = document.createElement("span");
  monsterHealthOrbLabel.textContent = "Health Orb";
  const monsterHealthOrbSlider = document.createElement("input");
  monsterHealthOrbSlider.type = "range";
  monsterHealthOrbSlider.min = "0.80";
  monsterHealthOrbSlider.max = "1.50";
  monsterHealthOrbSlider.step = "0.01";
  setDataAttr(monsterHealthOrbSlider, "monster-health-orb-slider");
  const monsterHealthOrbValue = document.createElement("span");
  monsterHealthOrbValue.textContent = "1.18";
  monsterHealthOrbValue.className = "pauseMeta";
  setDataAttr(monsterHealthOrbValue, "monster-health-orb-value");
  monsterHealthOrbRow.appendChild(monsterHealthOrbLabel);
  monsterHealthOrbRow.appendChild(monsterHealthOrbSlider);
  monsterHealthOrbRow.appendChild(monsterHealthOrbValue);

  const spawnBaseRow = document.createElement("label");
  spawnBaseRow.className = "audioRow";
  const spawnBaseLabel = document.createElement("span");
  spawnBaseLabel.textContent = "Spawn Base";
  const spawnBaseSlider = document.createElement("input");
  spawnBaseSlider.type = "range";
  spawnBaseSlider.min = "0.20";
  spawnBaseSlider.max = "4.00";
  spawnBaseSlider.step = "0.05";
  setDataAttr(spawnBaseSlider, "spawn-base-slider");
  const spawnBaseValue = document.createElement("span");
  spawnBaseValue.textContent = "1.00";
  spawnBaseValue.className = "pauseMeta";
  setDataAttr(spawnBaseValue, "spawn-base-value");
  spawnBaseRow.appendChild(spawnBaseLabel);
  spawnBaseRow.appendChild(spawnBaseSlider);
  spawnBaseRow.appendChild(spawnBaseValue);

  const monsterHealthBaseRow = document.createElement("label");
  monsterHealthBaseRow.className = "audioRow";
  const monsterHealthBaseLabel = document.createElement("span");
  monsterHealthBaseLabel.textContent = "HP Base";
  const monsterHealthBaseSlider = document.createElement("input");
  monsterHealthBaseSlider.type = "range";
  monsterHealthBaseSlider.min = "0.20";
  monsterHealthBaseSlider.max = "4.00";
  monsterHealthBaseSlider.step = "0.05";
  setDataAttr(monsterHealthBaseSlider, "monster-health-base-slider");
  const monsterHealthBaseValue = document.createElement("span");
  monsterHealthBaseValue.textContent = "1.00";
  monsterHealthBaseValue.className = "pauseMeta";
  setDataAttr(monsterHealthBaseValue, "monster-health-base-value");
  monsterHealthBaseRow.appendChild(monsterHealthBaseLabel);
  monsterHealthBaseRow.appendChild(monsterHealthBaseSlider);
  monsterHealthBaseRow.appendChild(monsterHealthBaseValue);

  const spawnTuningResetBtn = document.createElement("button");
  spawnTuningResetBtn.type = "button";
  spawnTuningResetBtn.className = "pauseDebugOpenBtn";
  spawnTuningResetBtn.textContent = "Reset Spawn Tuning";
  setDataAttr(spawnTuningResetBtn, "spawn-tuning-reset");

  audioSection.appendChild(audioTitle);
  audioSection.appendChild(musicRow);
  audioSection.appendChild(sfxRow);
  audioSection.appendChild(pressureRow);
  audioSection.appendChild(spawnRateOrbRow);
  audioSection.appendChild(monsterHealthOrbRow);
  audioSection.appendChild(spawnBaseRow);
  audioSection.appendChild(monsterHealthBaseRow);
  audioSection.appendChild(spawnTuningResetBtn);

  const paletteTitle = document.createElement("h4");
  paletteTitle.textContent = "Palette";
  const paletteToggleRow = document.createElement("label");
  paletteToggleRow.className = "audioRow";
  const paletteToggleLabel = document.createElement("span");
  paletteToggleLabel.textContent = "Swap";
  const paletteToggle = document.createElement("input");
  paletteToggle.type = "checkbox";
  setDataAttr(paletteToggle, "palette-swap-toggle");
  const paletteSelect = document.createElement("select");
  setDataAttr(paletteSelect, "palette-id-select");
  const paletteIds = [
    "db32",
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
  ] as const;
  for (let i = 0; i < paletteIds.length; i++) {
    const option = document.createElement("option");
    option.value = paletteIds[i];
    option.textContent = paletteIds[i];
    paletteSelect.appendChild(option);
  }
  paletteToggleRow.appendChild(paletteToggleLabel);
  paletteToggleRow.appendChild(paletteToggle);
  paletteToggleRow.appendChild(paletteSelect);
  audioSection.appendChild(paletteTitle);
  audioSection.appendChild(paletteToggleRow);

  const buildSection = document.createElement("section");
  buildSection.className = "pauseSection pauseBuild";
  const buildTitle = document.createElement("h3");
  buildTitle.textContent = "Build";
  const characterLine = document.createElement("div");
  characterLine.className = "pauseMeta";
  setDataAttr(characterLine, "character");
  const weaponSummaryLine = document.createElement("div");
  weaponSummaryLine.className = "pauseMeta";
  setDataAttr(weaponSummaryLine, "weapon-summary");
  const weaponStatsTable = document.createElement("table");
  weaponStatsTable.className = "pauseStatTable";
  setDataAttr(weaponStatsTable, "weapon-stats-table");

  const cardsTitle = document.createElement("h4");
  cardsTitle.textContent = "Cards";
  const buildScroll = document.createElement("div");
  buildScroll.className = "pauseScroll";
  const cardGrid = document.createElement("div");
  cardGrid.className = "pauseCardGrid";
  setDataAttr(cardGrid, "card-grid");

  const relicsTitle = document.createElement("h4");
  relicsTitle.textContent = "Relics";
  const relicList = document.createElement("div");
  relicList.className = "relicList";
  setDataAttr(relicList, "relic-list");

  const debugCardsSection = document.createElement("div");
  debugCardsSection.className = "pauseDebugCardsSection";
  debugCardsSection.hidden = true;
  setDataAttr(debugCardsSection, "debug-cards-section");

  const debugCardsOpenBtn = document.createElement("button");
  debugCardsOpenBtn.type = "button";
  debugCardsOpenBtn.className = "pauseDebugOpenBtn";
  debugCardsOpenBtn.textContent = "Open Debug Cards Editor";
  setDataAttr(debugCardsOpenBtn, "debug-cards-open");
  const debugRelicsOpenBtn = document.createElement("button");
  debugRelicsOpenBtn.type = "button";
  debugRelicsOpenBtn.className = "pauseDebugOpenBtn";
  debugRelicsOpenBtn.textContent = "Open Debug Relics Editor";
  setDataAttr(debugRelicsOpenBtn, "debug-relics-open");

  buildSection.appendChild(buildTitle);
  buildSection.appendChild(characterLine);
  buildSection.appendChild(weaponSummaryLine);
  buildSection.appendChild(buildScroll);
  buildScroll.appendChild(cardsTitle);
  buildScroll.appendChild(cardGrid);
  buildScroll.appendChild(weaponStatsTable);
  buildScroll.appendChild(relicsTitle);
  buildScroll.appendChild(relicList);

  debugCardsSection.appendChild(debugCardsOpenBtn);
  debugCardsSection.appendChild(debugRelicsOpenBtn);
  audioSection.appendChild(debugCardsSection);

  const statsSection = document.createElement("section");
  statsSection.className = "pauseSection pauseStats";
  const statsTitle = document.createElement("h3");
  statsTitle.textContent = "Stats";
  const statsScroll = document.createElement("div");
  statsScroll.className = "pauseScroll";
  const mainStatsHeader = document.createElement("button");
  mainStatsHeader.type = "button";
  mainStatsHeader.className = "pauseDebugOpenBtn";
  setDataAttr(mainStatsHeader, "stats-main-toggle");
  const mainStatsBody = document.createElement("div");
  setDataAttr(mainStatsBody, "stats-main-body");
  const statTable = document.createElement("table");
  statTable.className = "pauseStatTable";
  setDataAttr(statTable, "stat-table");
  const debugMetricsHeader = document.createElement("button");
  debugMetricsHeader.type = "button";
  debugMetricsHeader.className = "pauseDebugOpenBtn";
  setDataAttr(debugMetricsHeader, "stats-debug-toggle");
  const debugMetricsTabs = document.createElement("div");
  debugMetricsTabs.className = "pauseStatsTabs";
  setDataAttr(debugMetricsTabs, "stats-debug-tabs");
  const debugMetricsBody = document.createElement("div");
  setDataAttr(debugMetricsBody, "stats-debug-body");
  const debugMetricsTable = document.createElement("table");
  debugMetricsTable.className = "pauseStatTable";
  setDataAttr(debugMetricsTable, "debug-metrics-table");
  statsSection.appendChild(statsTitle);
  statsSection.appendChild(statsScroll);
  statsScroll.appendChild(mainStatsHeader);
  mainStatsBody.appendChild(statTable);
  statsScroll.appendChild(mainStatsBody);
  statsScroll.appendChild(debugMetricsHeader);
  statsScroll.appendChild(debugMetricsTabs);
  debugMetricsBody.appendChild(debugMetricsTable);
  statsScroll.appendChild(debugMetricsBody);

  grid.appendChild(audioSection);
  grid.appendChild(buildSection);
  grid.appendChild(statsSection);

  panel.appendChild(header);
  panel.appendChild(grid);

  const debugLayer = document.createElement("div");
  debugLayer.className = "pauseDebugLayer";
  debugLayer.hidden = true;
  setDataAttr(debugLayer, "debug-layer");

  const debugLayerPanel = document.createElement("div");
  debugLayerPanel.className = "pauseDebugLayerPanel";

  const debugLayerHeader = document.createElement("div");
  debugLayerHeader.className = "pauseDebugLayerHeader";
  const debugLayerTitle = document.createElement("h3");
  debugLayerTitle.textContent = "Debug Cards Editor";
  const debugLayerActions = document.createElement("div");
  debugLayerActions.className = "pauseDebugLayerActions";
  const debugCancelBtn = document.createElement("button");
  debugCancelBtn.type = "button";
  debugCancelBtn.className = "pauseBtn";
  debugCancelBtn.textContent = "Close";
  setDataAttr(debugCancelBtn, "debug-cards-cancel");
  debugLayerActions.appendChild(debugCancelBtn);
  debugLayerHeader.appendChild(debugLayerTitle);
  debugLayerHeader.appendChild(debugLayerActions);

  const debugLayerBody = document.createElement("div");
  debugLayerBody.className = "pauseDebugLayerBody pauseScroll";
  setDataAttr(debugLayerBody, "debug-cards-list");

  debugLayerPanel.appendChild(debugLayerHeader);
  debugLayerPanel.appendChild(debugLayerBody);
  debugLayer.appendChild(debugLayerPanel);
  panel.appendChild(debugLayer);
  host.appendChild(panel);
  root.appendChild(host);

  let latestWorld: World | null = null;
  let debugLayerOpen = false;
  let debugMode: "CARDS" | "RELICS" = "CARDS";
  const debugCardIds = getAllCardIds();
  const debugRelicIds = getAllRelicIds();
  let draftRelics = new Set<string>();
  let visible = false;
  let needsFullRender = true;
  let lastRenderedWorld: World | null = null;
  let mainStatsCollapsed = false;
  let debugStatsCollapsed = false;
  let debugStatsTab: "SPAWN" | "COMBAT" | "FLOW" = "SPAWN";

  const syncStatsCollapseUi = () => {
    mainStatsHeader.textContent = `${mainStatsCollapsed ? "Show" : "Hide"} Stats`;
    mainStatsBody.hidden = mainStatsCollapsed;
    debugMetricsHeader.textContent = `${debugStatsCollapsed ? "Show" : "Hide"} Debug Metrics`;
    debugMetricsTabs.hidden = debugStatsCollapsed;
    debugMetricsBody.hidden = debugStatsCollapsed;
  };

  const renderDebugMetricsTabs = () => {
    clearChildren(debugMetricsTabs);
    const tabs: Array<{ id: "SPAWN" | "COMBAT" | "FLOW"; label: string }> = [
      { id: "SPAWN", label: "Spawn" },
      { id: "COMBAT", label: "Combat" },
      { id: "FLOW", label: "Flow" },
    ];
    for (const tab of tabs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pauseDebugOpenBtn pauseStatsTabBtn";
      setDataAttr(btn, "stats-debug-tab");
      btn.setAttribute("data-stats-debug-tab-id", tab.id);
      btn.textContent = tab.label;
      if (debugStatsTab === tab.id) btn.classList.add("active");
      btn.addEventListener("click", () => {
        debugStatsTab = tab.id;
        renderStats(latestWorld);
      });
      debugMetricsTabs.appendChild(btn);
    }
  };

  const resetRelicDraft = () => {
    const relics = normalizeRelicIdList((latestWorld as any)?.relics);
    if (latestWorld && Array.isArray((latestWorld as any).relics)) {
      (latestWorld as any).relics = relics;
    }
    draftRelics = new Set(relics);
  };

  const renderDebugLayer = () => {
    const debugEnabled = isPauseDebugCardsEnabled();
    debugLayer.hidden = !debugEnabled || !debugLayerOpen;
    if (debugLayer.hidden) return;

    clearChildren(debugLayerBody);
    debugLayerTitle.textContent = debugMode === "CARDS" ? "Debug Cards Editor" : "Debug Relics Editor";

    if (debugMode === "CARDS") {
      for (let i = 0; i < debugCardIds.length; i++) {
        const id = debugCardIds[i];
        const row = document.createElement("div");
        row.className = "pauseDebugCardRow";

        const label = document.createElement("span");
        label.className = "pauseDebugCardId";
        label.textContent = id;

        const countSpan = document.createElement("span");
        countSpan.className = "pauseCardCount";
        countSpan.textContent = `x${countInstances((latestWorld as any)?.cards, id)}`;
        countSpan.setAttribute("data-debug-card-count", id);

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "pauseDebugCardBtn";
        addBtn.textContent = "+";
        addBtn.setAttribute("data-debug-card-add", id);
        addBtn.addEventListener("click", () => {
          const w = latestWorld as any;
          if (!w || typeof w !== "object") return;
          if (!Array.isArray(w.cards)) w.cards = [];
          w.cards.push(id);
          countSpan.textContent = `x${countInstances(w.cards, id)}`;
          renderBuildPanel(latestWorld);
        });

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "pauseDebugCardBtn";
        removeBtn.textContent = "-";
        removeBtn.setAttribute("data-debug-card-remove", id);
        removeBtn.addEventListener("click", () => {
          const w = latestWorld as any;
          if (!w || typeof w !== "object" || !Array.isArray(w.cards)) return;
          const idx = w.cards.indexOf(id);
          if (idx >= 0) w.cards.splice(idx, 1);
          countSpan.textContent = `x${countInstances(w.cards, id)}`;
          renderBuildPanel(latestWorld);
        });

        row.appendChild(label);
        row.appendChild(countSpan);
        row.appendChild(addBtn);
        row.appendChild(removeBtn);
        debugLayerBody.appendChild(row);
      }
      return;
    }

    for (let i = 0; i < debugRelicIds.length; i++) {
      const id = debugRelicIds[i];
      const relic = getRelicById(id);
      if (!relic || !relic.isEnabled) continue;

      const row = document.createElement("div");
      row.className = "pauseDebugCardRow";

      const label = document.createElement("span");
      label.className = "pauseDebugCardId";
      label.textContent = relic.displayName;

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "pauseDebugCardBtn";
      const isOwned = draftRelics.has(id);
      toggleBtn.textContent = isOwned ? "Remove" : "Add";
      toggleBtn.setAttribute(isOwned ? "data-debug-relic-remove" : "data-debug-relic-add", id);
      toggleBtn.addEventListener("click", () => {
        if (draftRelics.has(id)) draftRelics.delete(id);
        else draftRelics.add(id);
        const w = latestWorld as any;
        if (w && typeof w === "object") {
          w.relics = Array.from(draftRelics);
          recomputeDerivedStats(w);
          renderBuildPanel(latestWorld);
          renderStats(latestWorld);
        }
        renderDebugLayer();
      });

      row.appendChild(label);
      row.appendChild(toggleBtn);
      debugLayerBody.appendChild(row);
    }
  };

  const syncAudioControls = () => {
    const audio = getAudioSettings();
    musicSlider.value = `${audio.musicVolume}`;
    musicMuteBtn.textContent = audio.musicMuted ? "Unmute" : "Mute";
    if (audio.musicMuted) musicMuteBtn.classList.add("muted");
    else musicMuteBtn.classList.remove("muted");

    sfxSlider.value = `${audio.sfxVolume}`;
    sfxMuteBtn.textContent = audio.sfxMuted ? "Unmute" : "Mute";
    if (audio.sfxMuted) sfxMuteBtn.classList.add("muted");
    else sfxMuteBtn.classList.remove("muted");

    const pressureMult = latestWorld?.spawnDirectorConfig?.globalPressureMult ?? 1;
    const clampedPressure = Math.max(0.25, Math.min(3, pressureMult));
    pressureSlider.value = `${clampedPressure}`;
    pressureValue.textContent = `${num(clampedPressure)}x`;
  };

  const applySfxToLatestWorld = () => {
    if (latestWorld) applySfxSettingsToWorld(latestWorld);
  };

  const applyPressureToLatestWorld = () => {
    if (!latestWorld) return;
    const v = Number.parseFloat(pressureSlider.value);
    const clamped = Math.max(0.25, Math.min(3, Number.isFinite(v) ? v : 1));
    latestWorld.spawnDirectorConfig.globalPressureMult = clamped;
    pressureValue.textContent = `${num(clamped)}x`;
  };

  const applySpawnTuningSettingsToLatestWorld = () => {
    if (!latestWorld) return;
    const spawnV = Number.parseFloat(spawnRateOrbSlider.value);
    const hpOrbV = Number.parseFloat(monsterHealthOrbSlider.value);
    const spawnBaseV = Number.parseFloat(spawnBaseSlider.value);
    const hpBaseV = Number.parseFloat(monsterHealthBaseSlider.value);
    const spawnClamped = Math.max(0.8, Math.min(1.5, Number.isFinite(spawnV) ? spawnV : 1.12));
    const hpOrbClamped = Math.max(0.8, Math.min(1.5, Number.isFinite(hpOrbV) ? hpOrbV : 1.18));
    const spawnBaseClamped = Math.max(0.2, Math.min(4.0, Number.isFinite(spawnBaseV) ? spawnBaseV : 1.0));
    const hpBaseClamped = Math.max(0.2, Math.min(4.0, Number.isFinite(hpBaseV) ? hpBaseV : 1.0));
    spawnRateOrbValue.textContent = num(spawnClamped, 2);
    monsterHealthOrbValue.textContent = num(hpOrbClamped, 2);
    spawnBaseValue.textContent = num(spawnBaseClamped, 2);
    monsterHealthBaseValue.textContent = num(hpBaseClamped, 2);

    const wAny = latestWorld as any;
    if (!wAny.balance) wAny.balance = {};
    if (!wAny.balance.spawnTuning) wAny.balance.spawnTuning = {};
    wAny.balance.spawnTuning.spawnRateOrbBasePerDepth = spawnClamped;
    wAny.balance.spawnTuning.monsterHealthOrbBasePerDepth = hpOrbClamped;
    wAny.balance.spawnTuning.monsterHealthBaseMult = hpBaseClamped;
    if (!wAny.expectedPowerBudgetConfig) wAny.expectedPowerBudgetConfig = {};
    wAny.expectedPowerBudgetConfig.basePowerPerSecond = spawnBaseClamped;
  };

  const getBalanceCsvLogger = (w: any) => (w ? (w as any).balanceCsvLogger : null);

  const syncBalanceCsvControls = (w: World | null) => {
    const logger = getBalanceCsvLogger(w);
    balanceCsvToggleBtn.textContent = logger?.enabled ? "Stop CSV" : "Start CSV";
  };

  const renderStats = (world: World | null) => {
    clearChildren(statTable);
    clearChildren(debugMetricsTable);
    renderDebugMetricsTabs();
    if (!world) return;

    const critChance = safeNum(world.baseCritChance) + safeNum(world.critChanceBonus);
    const rows: Array<[string, string]> = [
      ["HP", `${safeNum(world.playerHp).toFixed(0)} / ${safeNum(world.playerHpMax).toFixed(0)}`],
      ["Armor", `${safeNum((world as any).currentArmor).toFixed(0)} / ${safeNum((world as any).maxArmor).toFixed(0)}`],
      ["Move Speed", safeNum((world as any).pSpeed).toFixed(2)],
      ["Damage Mult", safeNum(world.dmgMult, 1).toFixed(2)],
      ["Fire Rate Mult", safeNum(world.fireRateMult, 1).toFixed(2)],
      ["Crit Chance", `${(Math.max(0, Math.min(1, critChance)) * 100).toFixed(1)}%`],
      ["Crit Multi", `${safeNum(world.critMultiplier, 1).toFixed(2)}x`],
      ["Gold", `${safeNum(getGold(world)).toFixed(0)}`],
      ["Kills", `${safeNum(world.kills).toFixed(0)}`],
    ];

    for (const [k, v] of rows) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      const td = document.createElement("td");
      th.textContent = k;
      td.textContent = v;
      tr.appendChild(th);
      tr.appendChild(td);
      statTable.appendChild(tr);
    }

    const dbg = (world as any).spawnDirectorDebug;
    const liveEnemyHp = sumAliveEnemyHp(world as any);
    if (dbg && typeof dbg === "object") {
      const spawnRows: Array<[string, string]> = [
        ["Pressure", num(safeNum(dbg.spawnPressureMult, safeNum(dbg.pressure)), 2)],
        ["Global Pressure", `${num(safeNum(dbg.globalPressureMult, 1), 2)}x`],
        ["Base Pressure", num(safeNum(dbg.basePressure), 3)],
        ["Effective Pressure", num(safeNum(dbg.effectivePressure, safeNum(dbg.pressure)), 3)],
        ["Wave Mult", num(safeNum(dbg.waveMult, 1), 3)],
        ["Spawn power/sec", num(safeNum(dbg.powerPerSecond), 2)],
        ["Spawn HP/sec", num(safeNum(dbg.spawnHpPerSecond), 0)],
        ["On-screen Enemy HP", num(liveEnemyHp, 0)],
        ["Queued/sec", num(safeNum(dbg.queuedPerSecond), 2)],
        ["Spawns/sec", num(safeNum(dbg.spawnsPerSecond), 2)],
      ];
      if (dbg.survive && typeof dbg.survive === "object") {
        spawnRows.push(
          ["Survive Progress", pct(safeNum(dbg.survive.progress))],
          ["Survive Ramp", num(safeNum(dbg.survive.ramp), 2)],
          ["Survive Power/sec", num(safeNum(dbg.survive.powerPerSecond), 2)],
          ["Survive Chunk Size", safeNum(dbg.survive.chunkSize, 0).toFixed(0)],
          ["Survive Chunk Delay", num(safeNum(dbg.survive.chunkDelay), 2)]
        );
      }

      const combatRows: Array<[string, string]> = [
        ["Actual DPS (inst)", num(safeNum(dbg.actualDpsInstant), 2)],
        ["Actual DPS (smooth)", num(safeNum(dbg.actualDps), 2)],
        ["Expected DPS", num(safeNum(dbg.expectedDps), 2)],
        ["Ahead/Behind", `${num(safeNum(dbg.aheadFactor), 2)}x`],
      ];

      const flowRows: Array<[string, string]> = [
        [
          "Card Rewards",
          `${safeNum((world as any).cardRewardBudgetUsed, 0).toFixed(0)}/${safeNum((world as any).cardRewardBudgetTotal, 3).toFixed(0)}`,
        ],
        [
          "Reward Claim Keys",
          `${Array.isArray((world as any).cardRewardClaimKeys) ? (world as any).cardRewardClaimKeys.length : 0}`,
        ],
        ["Last Reward Key", `${(world as any).lastCardRewardClaimKey ?? "-"}`],
        ["Pending", safeNum(dbg.pendingSpawns, 0).toFixed(0)],
        ["Wave Remaining", safeNum(dbg.waveRemaining, 0).toFixed(0)],
        ["Chunk CD", num(safeNum(dbg.chunkCooldownSec), 2)],
        ["Wave CD", num(safeNum(dbg.waveCooldownSecLeft), 2)],
        ["Last Chunk", safeNum(dbg.lastChunkSize, 0).toFixed(0)],
        ["Wave Threshold", safeNum(dbg.pendingThresholdToStartWave, 0).toFixed(0)],
        ["Trash Power Cost", num(safeNum(dbg.trashPowerCost), 2)],
        ["Power Budget", num(safeNum(dbg.powerBudget), 2)],
      ];
      const metricsRows = debugStatsTab === "COMBAT" ? combatRows : debugStatsTab === "FLOW" ? flowRows : spawnRows;
      for (const [k, v] of metricsRows) {
        const tr = document.createElement("tr");
        const th = document.createElement("th");
        const td = document.createElement("td");
        th.textContent = k;
        td.textContent = v;
        tr.appendChild(th);
        tr.appendChild(td);
        debugMetricsTable.appendChild(tr);
      }
    } else {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      const td = document.createElement("td");
      th.textContent = "Spawn Director";
      td.textContent = "No debug data";
      tr.appendChild(th);
      tr.appendChild(td);
      debugMetricsTable.appendChild(tr);

      const hpTr = document.createElement("tr");
      const hpTh = document.createElement("th");
      const hpTd = document.createElement("td");
      hpTh.textContent = "On-screen Enemy HP";
      hpTd.textContent = num(liveEnemyHp, 0);
      hpTr.appendChild(hpTh);
      hpTr.appendChild(hpTd);
      debugMetricsTable.appendChild(hpTr);
    }
  };

  const renderBuildPanel = (world: World | null) => {
    clearChildren(cardGrid);
    clearChildren(weaponStatsTable);
    clearChildren(relicList);
    const characterId = world ? (((world as any).currentCharacterId as string | undefined) ?? "Unknown") : "Unknown";
    characterLine.textContent = `Character: ${characterId}`;

    let snapshot: ReturnType<typeof getCombatModsSnapshot> | null = null;
    try {
      snapshot = getCombatModsSnapshot(world as any);
    } catch {
      snapshot = getCombatModsSnapshot({});
    }

    if (snapshot.cards.length === 0) {
      cardGrid.textContent = "No cards yet";
    } else {
      for (const card of snapshot.cards) {
        const tile = document.createElement("div");
        tile.className = "pauseCardTile";

        const name = document.createElement("div");
        name.className = "pauseCardName";
        const tierText = card.powerTier ? ` (T${card.powerTier})` : "";
        name.textContent = `${card.name}${tierText}`;

        const count = document.createElement("div");
        count.className = "pauseCardCount";
        count.textContent = `x${card.count}`;

        tile.appendChild(name);
        tile.appendChild(count);
        cardGrid.appendChild(tile);
      }
    }

    const resolved = snapshot.weaponStats;
    weaponSummaryLine.textContent =
      `Weapon: Pistol | SPS ${num(resolved.shotsPerSecond)} | ` +
      `Damage ${(
        resolved.baseDamage.physical + resolved.baseDamage.fire + resolved.baseDamage.chaos
      ).toFixed(1)}`;

    const weaponRows: Array<[string, string]> = [
      ["shotsPerSecond", num(resolved.shotsPerSecond)],
      ["baseDamage.physical", num(resolved.baseDamage.physical, 1)],
      ["baseDamage.fire", num(resolved.baseDamage.fire, 1)],
      ["baseDamage.chaos", num(resolved.baseDamage.chaos, 1)],
      ["critChance", pct(resolved.critChance)],
      ["critMulti", `${num(resolved.critMulti)}x`],
      ["spreadBaseDeg", num(resolved.spreadBaseDeg, 1)],
      ["convert.physToFire", pct(resolved.convert.physToFire)],
      ["convert.physToChaos", pct(resolved.convert.physToChaos)],
      ["convert.fireToChaos", pct(resolved.convert.fireToChaos)],
      ["chanceToBleed", pct(resolved.chanceToBleed)],
      ["chanceToIgnite", pct(resolved.chanceToIgnite)],
      ["chanceToPoison", pct(resolved.chanceToPoison)],
    ];
    for (const [k, v] of weaponRows) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      const td = document.createElement("td");
      th.textContent = k;
      td.textContent = v;
      tr.appendChild(th);
      tr.appendChild(td);
      weaponStatsTable.appendChild(tr);
    }

    const relicIds = normalizeRelicIdList((world as any)?.relics);
    if (world && Array.isArray((world as any).relics)) {
      (world as any).relics = relicIds;
    }
    const relicNames = relicIds.map((id) => getRelicById(id)?.displayName ?? id);
    relicList.textContent = relicNames.length === 0 ? "No relics" : relicNames.join(", ");
  };

  const renderCardsAndRelicsAndWeapon = (world: World | null) => {
    renderBuildPanel(world);
    const debugEnabled = isPauseDebugCardsEnabled();
    debugCardsSection.hidden = !debugEnabled;
    debugCardsOpenBtn.hidden = !debugEnabled;
    debugRelicsOpenBtn.hidden = !debugEnabled;
    if (!debugEnabled) debugLayerOpen = false;
    renderDebugLayer();
  };

  const onMusicSlider = () => {
    setMusicVolume(Number.parseFloat(musicSlider.value));
    syncAudioControls();
  };

  const onMusicMute = () => {
    const next = !getAudioSettings().musicMuted;
    setMusicMuted(next);
    syncAudioControls();
  };

  const onSfxSlider = () => {
    setSfxVolume(Number.parseFloat(sfxSlider.value));
    applySfxToLatestWorld();
    syncAudioControls();
  };

  const onSfxMute = () => {
    const next = !getAudioSettings().sfxMuted;
    setSfxMuted(next);
    applySfxToLatestWorld();
    syncAudioControls();
  };

  const onPressureSlider = () => {
    applyPressureToLatestWorld();
  };

  const onSpawnTuningSlider = () => {
    const spawnV = Number.parseFloat(spawnRateOrbSlider.value);
    const hpOrbV = Number.parseFloat(monsterHealthOrbSlider.value);
    const spawnBaseV = Number.parseFloat(spawnBaseSlider.value);
    const hpBaseV = Number.parseFloat(monsterHealthBaseSlider.value);
    const spawnClamped = Math.max(0.8, Math.min(1.5, Number.isFinite(spawnV) ? spawnV : 1.12));
    const hpOrbClamped = Math.max(0.8, Math.min(1.5, Number.isFinite(hpOrbV) ? hpOrbV : 1.18));
    const spawnBaseClamped = Math.max(0.2, Math.min(4.0, Number.isFinite(spawnBaseV) ? spawnBaseV : 1.0));
    const hpBaseClamped = Math.max(0.2, Math.min(4.0, Number.isFinite(hpBaseV) ? hpBaseV : 1.0));
    updateUserSettings({
      render: {
        spawnBasePowerPerSecond: spawnBaseClamped,
        spawnRateOrbBasePerDepth: spawnClamped,
        monsterHealthBaseMult: hpBaseClamped,
        monsterHealthOrbBasePerDepth: hpOrbClamped,
      },
    });
    syncSpawnTuningControls();
    applySpawnTuningSettingsToLatestWorld();
  };

  const syncPaletteControls = () => {
    const settings = getUserSettings().render;
    (paletteToggle as HTMLInputElement).checked = !!settings.paletteSwapEnabled;
    paletteSelect.value = settings.paletteId;
    paletteSelect.disabled = !settings.paletteSwapEnabled;
  };

  const syncSpawnTuningControls = () => {
    const settings = getUserSettings().render;
    const spawnOrb = Math.max(0.8, Math.min(1.5, safeNum(settings.spawnRateOrbBasePerDepth, 1.12)));
    const healthOrb = Math.max(0.8, Math.min(1.5, safeNum(settings.monsterHealthOrbBasePerDepth, 1.18)));
    const spawnBase = Math.max(0.2, Math.min(4.0, safeNum(settings.spawnBasePowerPerSecond, 1.0)));
    const healthBase = Math.max(0.2, Math.min(4.0, safeNum(settings.monsterHealthBaseMult, 1.0)));
    spawnRateOrbSlider.value = `${spawnOrb}`;
    monsterHealthOrbSlider.value = `${healthOrb}`;
    spawnBaseSlider.value = `${spawnBase}`;
    monsterHealthBaseSlider.value = `${healthBase}`;
    spawnRateOrbValue.textContent = num(spawnOrb, 2);
    monsterHealthOrbValue.textContent = num(healthOrb, 2);
    spawnBaseValue.textContent = num(spawnBase, 2);
    monsterHealthBaseValue.textContent = num(healthBase, 2);
  };

  resumeBtn.addEventListener("click", args.actions.onResume);
  quitBtn.addEventListener("click", args.actions.onQuitRun);
  musicSlider.addEventListener("input", onMusicSlider);
  musicMuteBtn.addEventListener("click", onMusicMute);
  sfxSlider.addEventListener("input", onSfxSlider);
  sfxMuteBtn.addEventListener("click", onSfxMute);
  pressureSlider.addEventListener("input", onPressureSlider);
  spawnRateOrbSlider.addEventListener("input", onSpawnTuningSlider);
  monsterHealthOrbSlider.addEventListener("input", onSpawnTuningSlider);
  spawnBaseSlider.addEventListener("input", onSpawnTuningSlider);
  monsterHealthBaseSlider.addEventListener("input", onSpawnTuningSlider);
  paletteToggle.addEventListener("change", () => {
    const enabled = !!(paletteToggle as HTMLInputElement).checked;
    updateUserSettings({ render: { paletteSwapEnabled: enabled } });
    paletteSelect.disabled = !enabled;
  });
  paletteSelect.addEventListener("change", () => {
    updateUserSettings({
      render: {
        paletteId: paletteSelect.value as ReturnType<typeof getUserSettings>["render"]["paletteId"],
      },
    });
  });
  debugCardsOpenBtn.addEventListener("click", () => {
    debugMode = "CARDS";
    debugLayerOpen = true;
    renderDebugLayer();
  });
  debugRelicsOpenBtn.addEventListener("click", () => {
    debugMode = "RELICS";
    resetRelicDraft();
    debugLayerOpen = true;
    renderDebugLayer();
  });
  debugCancelBtn.addEventListener("click", () => {
    debugLayerOpen = false;
    renderDebugLayer();
  });
  balanceCsvToggleBtn.addEventListener("click", () => {
    const w = latestWorld as any;
    const logger = getBalanceCsvLogger(w);
    if (!w || !logger) return;

    const next = !logger.enabled;
    setBalanceCsvEnabled(logger, next, Number(w.timeSec ?? 0));
    syncBalanceCsvControls(latestWorld);
  });
  balanceCsvClearBtn.addEventListener("click", () => {
    const logger = getBalanceCsvLogger(latestWorld as any);
    if (!logger) return;
    clearBalanceCsv(logger);
  });
  balanceCsvDownloadBtn.addEventListener("click", () => {
    const w = latestWorld as any;
    const logger = getBalanceCsvLogger(w);
    if (!logger || !w) return;
    const depth = Math.max(0, Math.floor(Number((w as any).floorIndex ?? 0)));
    const fname = `ratgame_balance_depth${depth}_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    downloadBalanceCsv(logger, fname);
  });
  spawnTuningResetBtn.addEventListener("click", () => {
    updateUserSettings({
      render: {
        spawnBasePowerPerSecond: 1.0,
        spawnRateOrbBasePerDepth: 1.12,
        monsterHealthBaseMult: 1.0,
        monsterHealthOrbBasePerDepth: 1.18,
      },
    });
    syncSpawnTuningControls();
    applySpawnTuningSettingsToLatestWorld();
  });
  mainStatsHeader.addEventListener("click", () => {
    mainStatsCollapsed = !mainStatsCollapsed;
    syncStatsCollapseUi();
  });
  debugMetricsHeader.addEventListener("click", () => {
    debugStatsCollapsed = !debugStatsCollapsed;
    syncStatsCollapseUi();
  });
  syncAudioControls();
  syncPaletteControls();
  syncSpawnTuningControls();
  applySpawnTuningSettingsToLatestWorld();
  syncStatsCollapseUi();
  syncBalanceCsvControls(latestWorld);

  return {
    setVisible(v: boolean): void {
      const changed = visible !== v;
      visible = v;
      host.hidden = !v;
      root.hidden = !v;
      for (const el of preservedChildren) {
        el.hidden = v;
      }
      if (changed && v) needsFullRender = true;
    },
    render(world: World | null): void {
      latestWorld = world;
      if (!visible) return;

      const worldChanged = lastRenderedWorld !== world;
      if (!needsFullRender && !worldChanged) return;

      applySfxToLatestWorld();
      syncAudioControls();
      syncPaletteControls();
      syncSpawnTuningControls();
      applySpawnTuningSettingsToLatestWorld();
      syncBalanceCsvControls(world);
      renderStats(world);
      renderCardsAndRelicsAndWeapon(world);
      lastRenderedWorld = world;
      needsFullRender = false;
    },
    destroy(): void {
      resumeBtn.removeEventListener("click", args.actions.onResume);
      quitBtn.removeEventListener("click", args.actions.onQuitRun);
      musicSlider.removeEventListener("input", onMusicSlider);
      musicMuteBtn.removeEventListener("click", onMusicMute);
      sfxSlider.removeEventListener("input", onSfxSlider);
      sfxMuteBtn.removeEventListener("click", onSfxMute);
      pressureSlider.removeEventListener("input", onPressureSlider);
      spawnRateOrbSlider.removeEventListener("input", onSpawnTuningSlider);
      monsterHealthOrbSlider.removeEventListener("input", onSpawnTuningSlider);
      spawnBaseSlider.removeEventListener("input", onSpawnTuningSlider);
      monsterHealthBaseSlider.removeEventListener("input", onSpawnTuningSlider);
      host.remove();
      for (const el of preservedChildren) {
        el.hidden = false;
      }
      root.hidden = true;
    },
  };
}
