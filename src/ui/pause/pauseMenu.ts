import type { World } from "../../engine/world/world";
import { getCombatModsSnapshot } from "../../game/combat_mods";
import { getCardById } from "../../game/combat_mods/content/cards/cardPool";
import { resolveCombatStarterWeaponId } from "../../game/combat_mods/content/weapons/characterStarterMap";
import { getCombatStarterWeaponById } from "../../game/combat_mods/content/weapons/starterWeapons";
import { getGold } from "../../game/economy/gold";
import { DEFAULT_SETTINGS, getUserSettings, updateUserSettings } from "../../userSettings";
import { DEFAULT_SPAWN_TUNING } from "../../game/balance/spawnTuningDefaults";
import { mountSettingsPanel, type SettingsPanelController } from "../settings/settingsPanel";

export type PauseMenuActions = {
  onResume(): void;
  onQuitRun(): void;
  onOpenDevTools?(): void;
};

export type PauseMenuController = {
  setVisible(v: boolean): void;
  render(world: World | null): void;
  destroy(): void;
};

type PauseSectionId = "OWNED_CARDS" | "SETTINGS" | "BUILD_STATS" | "DEBUG_METRICS" | "SPAWN_TUNING";

type DebugMetricTab = "SPAWN" | "COMBAT" | "FLOW";

function safeNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function clearChildren(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function createStatTable(rows: Array<[string, string]>): HTMLTableElement {
  const table = document.createElement("table");
  table.className = "pauseStatTable";
  for (const [k, v] of rows) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    const td = document.createElement("td");
    th.textContent = k;
    td.textContent = v;
    tr.appendChild(th);
    tr.appendChild(td);
    table.appendChild(tr);
  }
  return table;
}

function describeCardMod(mod: { key: string; op: string; value: number }): string {
  const value = Number.isFinite(mod.value) ? mod.value : 0;
  if (mod.op === "more" || mod.op === "increased") {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${Math.round(value * 100)}% ${mod.op} ${mod.key}`;
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} ${mod.key}`;
}

function metricRowsForTab(world: any, tab: DebugMetricTab): Array<[string, string]> {
  const dbg = world?.spawnDirectorDebug;
  const liveEnemyHp = (() => {
    const alive = Array.isArray(world?.eAlive) ? world.eAlive : [];
    const hp = Array.isArray(world?.eHp) ? world.eHp : [];
    const n = Math.min(alive.length, hp.length);
    let total = 0;
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      total += safeNum(hp[i], 0);
    }
    return total;
  })();

  if (!dbg || typeof dbg !== "object") {
    return [
      ["Spawn Director", "No debug data"],
      ["On-screen Enemy HP", `${Math.round(liveEnemyHp)}`],
    ];
  }

  const spawnRows: Array<[string, string]> = [
    ["Spawn Depth Mult (cum.)", `${safeNum(dbg.spawnPressureMult, 1).toFixed(2)}x`],
    ["Enemy HP Depth Mult (cum.)", `${safeNum(dbg.spawnHpMult, 1).toFixed(2)}x`],
    ["Time Pressure (base)", safeNum(dbg.basePressure, 0).toFixed(3)],
    ["Time Pressure (effective)", safeNum(dbg.effectivePressure, safeNum(dbg.pressure, 0)).toFixed(3)],
    ["Wave Intensity Mult", safeNum(dbg.waveMult, 1).toFixed(3)],
    ["Spawn HP Budget/sec", safeNum(dbg.spawnHpPerSecond, 0).toFixed(0)],
    ["On-screen Enemy HP", safeNum(liveEnemyHp, 0).toFixed(0)],
    ["Queued Enemies/sec", safeNum(dbg.queuedPerSecond, 0).toFixed(2)],
    ["Spawned Enemies/sec", safeNum(dbg.spawnsPerSecond, 0).toFixed(2)],
  ];

  const combatRows: Array<[string, string]> = [
    ["Actual DPS (inst)", safeNum(dbg.actualDpsInstant, 0).toFixed(2)],
    ["Actual DPS (smooth)", safeNum(dbg.actualDps, 0).toFixed(2)],
    ["Expected DPS", safeNum(dbg.expectedDps, 0).toFixed(2)],
    ["Ahead/Behind", `${safeNum(dbg.aheadFactor, 1).toFixed(2)}x`],
  ];

  const flowRows: Array<[string, string]> = [
    [
      "Card Rewards",
      `${safeNum(world?.cardRewardBudgetUsed, 0).toFixed(0)}/${safeNum(world?.cardRewardBudgetTotal, 0).toFixed(0)}`,
    ],
    [
      "Reward Claim Keys",
      `${Array.isArray(world?.cardRewardClaimKeys) ? world.cardRewardClaimKeys.length : 0}`,
    ],
    ["Last Reward Key", `${world?.lastCardRewardClaimKey ?? "-"}`],
    ["Pending", safeNum(dbg.pendingSpawns, 0).toFixed(0)],
    ["Wave Remaining", safeNum(dbg.waveRemaining, 0).toFixed(0)],
    ["Chunk CD", safeNum(dbg.chunkCooldownSec, 0).toFixed(2)],
    ["Wave CD", safeNum(dbg.waveCooldownSecLeft, 0).toFixed(2)],
    ["Last Chunk", safeNum(dbg.lastChunkSize, 0).toFixed(0)],
    ["Wave Threshold", safeNum(dbg.pendingThresholdToStartWave, 0).toFixed(0)],
    ["Trash Power Cost", safeNum(dbg.trashPowerCost, 0).toFixed(2)],
    ["Power Budget", safeNum(dbg.powerBudget, 0).toFixed(2)],
  ];

  return tab === "COMBAT" ? combatRows : tab === "FLOW" ? flowRows : spawnRows;
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
  panel.className = "pausePanel pausePanelNav";

  const header = document.createElement("div");
  header.className = "pauseHeader";
  const title = document.createElement("div");
  title.className = "pauseTitle";
  title.textContent = "Paused";
  header.appendChild(title);

  const headerActions = document.createElement("div");
  headerActions.className = "pauseHeaderActions";

  const resumeBtn = document.createElement("button");
  resumeBtn.type = "button";
  resumeBtn.className = "pauseBtn pauseActionResume";
  resumeBtn.textContent = "Resume";
  resumeBtn.setAttribute("data-pause-resume", "1");
  resumeBtn.addEventListener("click", () => {
    args.actions.onResume();
  });
  headerActions.appendChild(resumeBtn);

  const quitBtn = document.createElement("button");
  quitBtn.type = "button";
  quitBtn.className = "pauseBtn pauseActionQuit";
  quitBtn.textContent = "Quit Run";
  quitBtn.setAttribute("data-pause-quit", "1");
  headerActions.appendChild(quitBtn);

  if (args.actions.onOpenDevTools) {
    const devToolsBtn = document.createElement("button");
    devToolsBtn.type = "button";
    devToolsBtn.className = "pauseBtn pauseActionDev";
    devToolsBtn.textContent = "Dev Tools";
    devToolsBtn.setAttribute("data-dev-only", "1");
    devToolsBtn.setAttribute("data-pause-dev-tools", "1");
    devToolsBtn.addEventListener("click", () => {
      if ((getUserSettings() as any)?.game?.userModeEnabled ?? true) return;
      args.actions.onOpenDevTools?.();
    });
    headerActions.appendChild(devToolsBtn);
  }

  header.appendChild(headerActions);

  const layout = document.createElement("div");
  layout.className = "pauseNavLayout";

  const nav = document.createElement("nav");
  nav.className = "pauseModeNav";

  const content = document.createElement("div");
  content.className = "pauseModeContent";

  const quitConfirmOverlay = document.createElement("div");
  quitConfirmOverlay.className = "pauseConfirmOverlay";
  quitConfirmOverlay.hidden = true;
  quitConfirmOverlay.setAttribute("data-pause-quit-modal", "1");

  const quitConfirmDialog = document.createElement("div");
  quitConfirmDialog.className = "pauseConfirmDialog";
  const quitConfirmTitle = document.createElement("h4");
  quitConfirmTitle.textContent = "Quit this run?";
  const quitConfirmCopy = document.createElement("p");
  quitConfirmCopy.textContent = "You will lose current floor progress and return to the main menu.";
  const quitConfirmActions = document.createElement("div");
  quitConfirmActions.className = "pauseConfirmActions";
  const quitConfirmCancel = document.createElement("button");
  quitConfirmCancel.type = "button";
  quitConfirmCancel.className = "pauseBtn pauseConfirmCancel";
  quitConfirmCancel.textContent = "Cancel";
  quitConfirmCancel.setAttribute("data-pause-quit-cancel", "1");
  const quitConfirmAccept = document.createElement("button");
  quitConfirmAccept.type = "button";
  quitConfirmAccept.className = "pauseBtn pauseConfirmAccept";
  quitConfirmAccept.textContent = "Quit Run";
  quitConfirmAccept.setAttribute("data-pause-quit-confirm", "1");
  quitConfirmActions.appendChild(quitConfirmCancel);
  quitConfirmActions.appendChild(quitConfirmAccept);
  quitConfirmDialog.appendChild(quitConfirmTitle);
  quitConfirmDialog.appendChild(quitConfirmCopy);
  quitConfirmDialog.appendChild(quitConfirmActions);
  quitConfirmOverlay.appendChild(quitConfirmDialog);

  const ownedCardsPanel = document.createElement("section");
  ownedCardsPanel.className = "pauseModePanel";
  const ownedTitle = document.createElement("h3");
  ownedTitle.className = "pauseSectionTitle";
  ownedTitle.textContent = "Cards / Relics";
  const ownedList = document.createElement("div");
  ownedList.className = "pauseOwnedCardsList";
  const ownedDetail = document.createElement("div");
  ownedDetail.className = "pauseOwnedCardDetail";
  ownedCardsPanel.appendChild(ownedTitle);
  ownedCardsPanel.appendChild(ownedList);
  ownedCardsPanel.appendChild(ownedDetail);

  const settingsPanelSection = document.createElement("section");
  settingsPanelSection.className = "pauseModePanel";
  const settingsTitle = document.createElement("h3");
  settingsTitle.className = "pauseSectionTitle";
  settingsTitle.textContent = "Settings";
  const settingsHost = document.createElement("div");
  settingsHost.className = "pauseSettingsHost";
  settingsPanelSection.appendChild(settingsTitle);
  settingsPanelSection.appendChild(settingsHost);

  const buildStatsPanel = document.createElement("section");
  buildStatsPanel.className = "pauseModePanel";
  const buildStatsTitle = document.createElement("h3");
  buildStatsTitle.className = "pauseSectionTitle";
  buildStatsTitle.textContent = "Build Stats";
  const buildStatsBody = document.createElement("div");
  buildStatsBody.className = "pauseSectionScroll";
  buildStatsPanel.appendChild(buildStatsTitle);
  buildStatsPanel.appendChild(buildStatsBody);

  const debugMetricsPanel = document.createElement("section");
  debugMetricsPanel.className = "pauseModePanel";
  const debugMetricsTitle = document.createElement("h3");
  debugMetricsTitle.className = "pauseSectionTitle";
  debugMetricsTitle.textContent = "Debug Metrics";
  const debugTabRow = document.createElement("div");
  debugTabRow.className = "pauseInlineTabs";
  const debugMetricsBody = document.createElement("div");
  debugMetricsBody.className = "pauseSectionScroll";
  debugMetricsPanel.appendChild(debugMetricsTitle);
  debugMetricsPanel.appendChild(debugTabRow);
  debugMetricsPanel.appendChild(debugMetricsBody);

  const spawnTuningPanel = document.createElement("section");
  spawnTuningPanel.className = "pauseModePanel";
  const spawnTuningTitle = document.createElement("h3");
  spawnTuningTitle.className = "pauseSectionTitle";
  spawnTuningTitle.textContent = "Spawn Tuning";
  const spawnTuningBody = document.createElement("div");
  spawnTuningBody.className = "pauseSectionScroll";
  spawnTuningPanel.appendChild(spawnTuningTitle);
  spawnTuningPanel.appendChild(spawnTuningBody);

  const panelById: Record<PauseSectionId, HTMLElement> = {
    OWNED_CARDS: ownedCardsPanel,
    SETTINGS: settingsPanelSection,
    BUILD_STATS: buildStatsPanel,
    DEBUG_METRICS: debugMetricsPanel,
    SPAWN_TUNING: spawnTuningPanel,
  };

  content.appendChild(ownedCardsPanel);
  content.appendChild(settingsPanelSection);
  content.appendChild(buildStatsPanel);
  content.appendChild(debugMetricsPanel);
  content.appendChild(spawnTuningPanel);

  const navButtons: Partial<Record<PauseSectionId, HTMLButtonElement>> = {};

  const addNavButton = (
    label: string,
    opts: {
      sectionId?: PauseSectionId;
      onClick?: () => void;
      devOnly?: boolean;
    },
  ) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pauseNavBtn";
    btn.textContent = label;
    if (opts.devOnly) btn.setAttribute("data-dev-only", "1");
    btn.addEventListener("click", () => {
      if (opts.onClick) {
        opts.onClick();
        return;
      }
      if (opts.sectionId) setActiveSection(opts.sectionId);
    });
    nav.appendChild(btn);
    if (opts.sectionId) navButtons[opts.sectionId] = btn;
    return btn;
  };

  addNavButton("Cards / Relics", { sectionId: "OWNED_CARDS" });
  addNavButton("Settings", { sectionId: "SETTINGS" });
  addNavButton("Build Stats", { sectionId: "BUILD_STATS", devOnly: true });
  addNavButton("Debug Metrics", { sectionId: "DEBUG_METRICS", devOnly: true });
  addNavButton("Spawn Tuning", { sectionId: "SPAWN_TUNING", devOnly: true });

  layout.appendChild(nav);
  layout.appendChild(content);
  panel.appendChild(header);
  panel.appendChild(layout);
  host.appendChild(panel);
  host.appendChild(quitConfirmOverlay);
  root.appendChild(host);

  let latestWorld: World | null = null;
  let visible = false;
  let selectedOwnedCardId: string | null = null;
  let activeSection: PauseSectionId = "OWNED_CARDS";
  let debugMetricTab: DebugMetricTab = "SPAWN";

  const closeQuitConfirm = () => {
    quitConfirmOverlay.hidden = true;
  };

  const openQuitConfirm = () => {
    quitConfirmOverlay.hidden = false;
  };

  quitBtn.addEventListener("click", openQuitConfirm);
  quitConfirmCancel.addEventListener("click", closeQuitConfirm);
  quitConfirmAccept.addEventListener("click", () => {
    closeQuitConfirm();
    args.actions.onQuitRun();
  });
  quitConfirmOverlay.addEventListener("click", (ev) => {
    if (ev.target !== quitConfirmOverlay) return;
    closeQuitConfirm();
  });

  const spawnRateSlider = document.createElement("input");
  spawnRateSlider.type = "range";
  spawnRateSlider.min = "0.80";
  spawnRateSlider.max = "1.50";
  spawnRateSlider.step = "0.01";

  const hpDepthSlider = document.createElement("input");
  hpDepthSlider.type = "range";
  hpDepthSlider.min = "0.80";
  hpDepthSlider.max = "1.50";
  hpDepthSlider.step = "0.01";

  const spawnBaseSlider = document.createElement("input");
  spawnBaseSlider.type = "range";
  spawnBaseSlider.min = "0.20";
  spawnBaseSlider.max = "4.00";
  spawnBaseSlider.step = "0.05";

  const hpBaseSlider = document.createElement("input");
  hpBaseSlider.type = "range";
  hpBaseSlider.min = "0.20";
  hpBaseSlider.max = "4.00";
  hpBaseSlider.step = "0.05";

  const pressureT0Slider = document.createElement("input");
  pressureT0Slider.type = "range";
  pressureT0Slider.min = "0.10";
  pressureT0Slider.max = "3.00";
  pressureT0Slider.step = "0.05";

  const pressureT120Slider = document.createElement("input");
  pressureT120Slider.type = "range";
  pressureT120Slider.min = "0.10";
  pressureT120Slider.max = "3.00";
  pressureT120Slider.step = "0.05";

  const sliderValueByKey: Record<string, HTMLSpanElement> = {
    spawnPerDepth: document.createElement("span"),
    hpPerDepth: document.createElement("span"),
    spawnBase: document.createElement("span"),
    hpBase: document.createElement("span"),
    pressureAt0Sec: document.createElement("span"),
    pressureAt120Sec: document.createElement("span"),
  };

  const createSpawnRow = (
    label: string,
    slider: HTMLInputElement,
    valueEl: HTMLSpanElement,
  ) => {
    const row = document.createElement("label");
    row.className = "pauseTuningRow";
    const text = document.createElement("span");
    text.textContent = label;
    valueEl.className = "pauseTuningValue";
    row.appendChild(text);
    row.appendChild(slider);
    row.appendChild(valueEl);
    spawnTuningBody.appendChild(row);
  };

  createSpawnRow("Spawn/Depth", spawnRateSlider, sliderValueByKey.spawnPerDepth);
  createSpawnRow("HP/Depth", hpDepthSlider, sliderValueByKey.hpPerDepth);
  createSpawnRow("Spawn Base", spawnBaseSlider, sliderValueByKey.spawnBase);
  createSpawnRow("HP Base", hpBaseSlider, sliderValueByKey.hpBase);
  createSpawnRow("Pressure T0", pressureT0Slider, sliderValueByKey.pressureAt0Sec);
  createSpawnRow("Pressure T120", pressureT120Slider, sliderValueByKey.pressureAt120Sec);

  const spawnResetBtn = document.createElement("button");
  spawnResetBtn.type = "button";
  spawnResetBtn.className = "pauseBtn pauseInlineAction";
  spawnResetBtn.textContent = "Reset Spawn Tuning";
  spawnTuningBody.appendChild(spawnResetBtn);

  const settingsPanel: SettingsPanelController = mountSettingsPanel({
    host: settingsHost,
    initialTab: "GAME",
    onUserModeChanged: () => {
      syncDevVisibility();
      if (((getUserSettings() as any).game?.userModeEnabled ?? true)) {
        setActiveSection("OWNED_CARDS");
      }
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new Event("ratgame:settings-changed"));
      }
    },
    onPerformanceModeChanged: () => {
      window.dispatchEvent(new Event("resize"));
    },
  });

  const syncSpawnTuningControls = () => {
    const render = (getUserSettings() as any)?.render ?? DEFAULT_SETTINGS.render;
    const spawnPerDepth = Math.max(0.8, Math.min(1.5, safeNum(render.spawnPerDepth, DEFAULT_SPAWN_TUNING.spawnPerDepth)));
    const hpPerDepth = Math.max(0.8, Math.min(1.5, safeNum(render.hpPerDepth, DEFAULT_SPAWN_TUNING.hpPerDepth)));
    const spawnBase = Math.max(0.2, Math.min(4.0, safeNum(render.spawnBase, DEFAULT_SPAWN_TUNING.spawnBase)));
    const hpBase = Math.max(0.2, Math.min(4.0, safeNum(render.hpBase, DEFAULT_SPAWN_TUNING.hpBase)));
    const pressureAt0Sec = Math.max(0.1, Math.min(3.0, safeNum(render.pressureAt0Sec, DEFAULT_SPAWN_TUNING.pressureAt0Sec)));
    const pressureAt120Sec = Math.max(0.1, Math.min(3.0, safeNum(render.pressureAt120Sec, DEFAULT_SPAWN_TUNING.pressureAt120Sec)));

    spawnRateSlider.value = `${spawnPerDepth}`;
    hpDepthSlider.value = `${hpPerDepth}`;
    spawnBaseSlider.value = `${spawnBase}`;
    hpBaseSlider.value = `${hpBase}`;
    pressureT0Slider.value = `${pressureAt0Sec}`;
    pressureT120Slider.value = `${pressureAt120Sec}`;

    sliderValueByKey.spawnPerDepth.textContent = spawnPerDepth.toFixed(2);
    sliderValueByKey.hpPerDepth.textContent = hpPerDepth.toFixed(2);
    sliderValueByKey.spawnBase.textContent = spawnBase.toFixed(2);
    sliderValueByKey.hpBase.textContent = hpBase.toFixed(2);
    sliderValueByKey.pressureAt0Sec.textContent = pressureAt0Sec.toFixed(2);
    sliderValueByKey.pressureAt120Sec.textContent = pressureAt120Sec.toFixed(2);
  };

  const applySpawnTuningToWorld = () => {
    if (!latestWorld) return;
    const render = (getUserSettings() as any)?.render ?? DEFAULT_SETTINGS.render;
    const w = latestWorld as any;
    if (!w.balance) w.balance = {};
    if (!w.balance.spawnTuning) w.balance.spawnTuning = {};
    w.balance.spawnTuning.spawnBase = safeNum(render.spawnBase, DEFAULT_SPAWN_TUNING.spawnBase);
    w.balance.spawnTuning.spawnPerDepth = safeNum(render.spawnPerDepth, DEFAULT_SPAWN_TUNING.spawnPerDepth);
    w.balance.spawnTuning.hpBase = safeNum(render.hpBase, DEFAULT_SPAWN_TUNING.hpBase);
    w.balance.spawnTuning.hpPerDepth = safeNum(render.hpPerDepth, DEFAULT_SPAWN_TUNING.hpPerDepth);
    w.balance.spawnTuning.pressureAt0Sec = safeNum(render.pressureAt0Sec, DEFAULT_SPAWN_TUNING.pressureAt0Sec);
    w.balance.spawnTuning.pressureAt120Sec = safeNum(render.pressureAt120Sec, DEFAULT_SPAWN_TUNING.pressureAt120Sec);
  };

  const onSpawnSliderInput = () => {
    updateUserSettings({
      render: {
        spawnPerDepth: Math.max(0.8, Math.min(1.5, Number.parseFloat(spawnRateSlider.value))),
        hpPerDepth: Math.max(0.8, Math.min(1.5, Number.parseFloat(hpDepthSlider.value))),
        spawnBase: Math.max(0.2, Math.min(4.0, Number.parseFloat(spawnBaseSlider.value))),
        hpBase: Math.max(0.2, Math.min(4.0, Number.parseFloat(hpBaseSlider.value))),
        pressureAt0Sec: Math.max(0.1, Math.min(3.0, Number.parseFloat(pressureT0Slider.value))),
        pressureAt120Sec: Math.max(0.1, Math.min(3.0, Number.parseFloat(pressureT120Slider.value))),
      },
    });
    syncSpawnTuningControls();
    applySpawnTuningToWorld();
  };

  spawnRateSlider.addEventListener("input", onSpawnSliderInput);
  hpDepthSlider.addEventListener("input", onSpawnSliderInput);
  spawnBaseSlider.addEventListener("input", onSpawnSliderInput);
  hpBaseSlider.addEventListener("input", onSpawnSliderInput);
  pressureT0Slider.addEventListener("input", onSpawnSliderInput);
  pressureT120Slider.addEventListener("input", onSpawnSliderInput);
  spawnResetBtn.addEventListener("click", () => {
    updateUserSettings({ render: { ...DEFAULT_SPAWN_TUNING } });
    syncSpawnTuningControls();
    applySpawnTuningToWorld();
  });

  const renderBuildStats = (world: World | null) => {
    clearChildren(buildStatsBody);
    if (!world) {
      buildStatsBody.textContent = "No run state";
      return;
    }

    const snapshot = getCombatModsSnapshot(world as any);
    const resolved = snapshot.weaponStats;
    const characterId = ((world as any).currentCharacterId as string | undefined) ?? "Unknown";
    const starterWeaponId = resolveCombatStarterWeaponId((world as any)?.currentCharacterId);
    const starterWeaponName = getCombatStarterWeaponById(starterWeaponId).displayName;

    const summary = document.createElement("div");
    summary.className = "pauseMeta";
    summary.textContent = `Character: ${characterId} | Weapon: ${starterWeaponName}`;

    const rows: Array<[string, string]> = [
      ["Shots/sec", resolved.shotsPerSecond.toFixed(2)],
      ["Base Physical", resolved.baseDamage.physical.toFixed(1)],
      ["Base Fire", resolved.baseDamage.fire.toFixed(1)],
      ["Base Chaos", resolved.baseDamage.chaos.toFixed(1)],
      ["Crit Chance", pct(resolved.critChance)],
      ["Crit Multi", `${resolved.critMulti.toFixed(2)}x`],
      ["Poison Chance", pct(resolved.chanceToPoison)],
      ["Ignite Chance", pct(resolved.chanceToIgnite)],
      ["Bleed Chance", pct(resolved.chanceToBleed)],
    ];

    buildStatsBody.appendChild(summary);
    buildStatsBody.appendChild(createStatTable(rows));
  };

  const renderDebugMetrics = (world: World | null) => {
    clearChildren(debugMetricsBody);
    const table = createStatTable(metricRowsForTab(world as any, debugMetricTab));
    debugMetricsBody.appendChild(table);
  };

  const renderDebugMetricTabs = () => {
    clearChildren(debugTabRow);
    const tabs: Array<{ id: DebugMetricTab; label: string }> = [
      { id: "SPAWN", label: "Spawn" },
      { id: "COMBAT", label: "Combat" },
      { id: "FLOW", label: "Flow" },
    ];

    for (const tab of tabs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pauseInlineTabBtn";
      btn.textContent = tab.label;
      btn.classList.toggle("active", tab.id === debugMetricTab);
      btn.addEventListener("click", () => {
        debugMetricTab = tab.id;
        renderDebugMetricTabs();
        renderDebugMetrics(latestWorld);
      });
      debugTabRow.appendChild(btn);
    }
  };

  const renderOwnedCards = (world: World | null) => {
    clearChildren(ownedList);
    clearChildren(ownedDetail);

    if (!world) {
      ownedList.textContent = "No run state";
      return;
    }

    const snapshot = getCombatModsSnapshot(world as any);
    const cards = snapshot.cards;

    if (cards.length === 0) {
      ownedList.textContent = "No cards owned yet.";
      const hint = document.createElement("div");
      hint.className = "pauseMeta";
      hint.textContent = "Pick cards from rewards and vendors to build your run.";
      ownedDetail.appendChild(hint);
      selectedOwnedCardId = null;
      return;
    }

    if (!selectedOwnedCardId || !cards.some((c) => c.id === selectedOwnedCardId)) {
      selectedOwnedCardId = cards[0].id;
    }

    for (const card of cards) {
      const cardDef = getCardById(card.id);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "pauseOwnedCardRow";
      row.classList.toggle("active", card.id === selectedOwnedCardId);

      const left = document.createElement("div");
      left.className = "pauseOwnedCardMain";

      const name = document.createElement("div");
      name.className = "pauseOwnedCardName";
      name.textContent = card.name;

      const effect = document.createElement("div");
      effect.className = "pauseOwnedCardSummary";
      effect.textContent = cardDef?.displayName ?? card.id;

      left.appendChild(name);
      left.appendChild(effect);

      const meta = document.createElement("div");
      meta.className = "pauseOwnedCardMeta";

      const tier = document.createElement("span");
      tier.className = "pauseOwnedTier";
      tier.textContent = `T${card.powerTier ?? "?"}`;
      meta.appendChild(tier);

      const stack = document.createElement("span");
      stack.className = "pauseOwnedStack";
      stack.textContent = `x${card.count}`;
      meta.appendChild(stack);

      row.appendChild(left);
      row.appendChild(meta);

      row.addEventListener("click", () => {
        selectedOwnedCardId = card.id;
        renderOwnedCards(latestWorld);
      });

      ownedList.appendChild(row);
    }

    const selected = cards.find((c) => c.id === selectedOwnedCardId) ?? cards[0];
    const selectedDef = getCardById(selected.id);

    const detailTitle = document.createElement("h4");
    detailTitle.textContent = selected.name;
    const detailMeta = document.createElement("div");
    detailMeta.className = "pauseMeta";
    detailMeta.textContent = `ID: ${selected.id} · Tier ${selected.powerTier ?? "?"} · Rarity ${selected.rarity ?? "?"} · Stack x${selected.count}`;

    ownedDetail.appendChild(detailTitle);
    ownedDetail.appendChild(detailMeta);

    const modsHeader = document.createElement("div");
    modsHeader.className = "pauseMeta pauseMetaHeader";
    modsHeader.textContent = "Exact modifiers";
    ownedDetail.appendChild(modsHeader);

    const modList = document.createElement("ul");
    modList.className = "pauseOwnedModList";

    const mods = selectedDef?.mods ?? [];
    if (mods.length === 0) {
      const li = document.createElement("li");
      li.textContent = selectedDef?.displayName ?? "No extra modifiers";
      modList.appendChild(li);
    } else {
      for (const mod of mods) {
        const li = document.createElement("li");
        li.textContent = describeCardMod(mod);
        modList.appendChild(li);
      }
    }

    ownedDetail.appendChild(modList);
  };

  const setActiveSection = (id: PauseSectionId) => {
    activeSection = id;
    for (const key of Object.keys(panelById) as PauseSectionId[]) {
      panelById[key].hidden = key !== id;
    }
    for (const key of Object.keys(navButtons) as PauseSectionId[]) {
      const btn = navButtons[key];
      if (!btn) continue;
      btn.classList.toggle("active", key === id);
      btn.setAttribute("aria-pressed", key === id ? "true" : "false");
    }
  };

  const syncDevVisibility = () => {
    const isUserMode = !!((getUserSettings() as any).game?.userModeEnabled ?? true);
    const devButtons = host.querySelectorAll<HTMLElement>("[data-dev-only='1']");
    devButtons.forEach((btn) => {
      btn.hidden = isUserMode;
    });

    if (isUserMode && (activeSection === "BUILD_STATS" || activeSection === "DEBUG_METRICS" || activeSection === "SPAWN_TUNING")) {
      setActiveSection("OWNED_CARDS");
    }

    if (isUserMode) {
      buildStatsPanel.hidden = true;
      debugMetricsPanel.hidden = true;
      spawnTuningPanel.hidden = true;
    }
  };

  const renderTopStatsForOwnedAndSettings = (world: World | null) => {
    if (!world) return;
    const summary = document.createElement("div");
    summary.className = "pauseMeta";
    const snapshot = getCombatModsSnapshot(world as any);
    const baseCritChance = safeNum(snapshot.weaponStats.critChance);
    const hasFullCritRelic = world.relics.includes("MOM_FULL_CRIT_DOUBLE");
    const isAtFullMomentum = hasFullCritRelic && world.momentumMax > 0 && world.momentumValue >= world.momentumMax;
    const effectiveCritChance = Math.max(0, Math.min(1, baseCritChance * (isAtFullMomentum ? 2 : 1)));
    summary.textContent =
      `HP ${Math.ceil(safeNum(world.playerHp))}/${Math.ceil(safeNum(world.playerHpMax))} · ` +
      `Gold ${Math.ceil(safeNum(getGold(world)))} · ` +
      `Crit ${(baseCritChance * 100).toFixed(1)}% (${(effectiveCritChance * 100).toFixed(1)}% eff)`;

    const first = ownedCardsPanel.querySelector(".pauseMeta");
    if (first && first.parentElement === ownedCardsPanel) first.remove();
    ownedCardsPanel.insertBefore(summary, ownedList);
  };

  const renderAll = (world: World | null) => {
    settingsPanel.refresh();
    syncDevVisibility();
    syncSpawnTuningControls();
    applySpawnTuningToWorld();

    renderOwnedCards(world);
    renderTopStatsForOwnedAndSettings(world);
    renderBuildStats(world);
    renderDebugMetricTabs();
    renderDebugMetrics(world);
  };

  setActiveSection("OWNED_CARDS");
  syncSpawnTuningControls();

  return {
    setVisible(v: boolean): void {
      visible = v;
      host.hidden = !v;
      root.hidden = !v;
      if (!v) closeQuitConfirm();
      for (const el of preservedChildren) {
        el.hidden = v;
      }
      if (v) {
        renderAll(latestWorld);
      }
    },
    render(world: World | null): void {
      latestWorld = world;
      if (!visible) return;
      renderAll(world);
    },
    destroy(): void {
      settingsPanel.destroy();
      host.remove();
      for (const el of preservedChildren) {
        el.hidden = false;
      }
      root.hidden = true;
    },
  };
}
