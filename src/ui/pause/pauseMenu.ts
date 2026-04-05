import type { World } from "../../engine/world/world";
import { getCombatModsSnapshot } from "../../game/combat_mods";
import { getAllCardIds, getCardById } from "../../game/combat_mods/content/cards/cardPool";
import { resolveCombatStarterWeaponId } from "../../game/combat_mods/content/weapons/characterStarterMap";
import { getCombatStarterWeaponById } from "../../game/combat_mods/content/weapons/starterWeapons";
import { applyCardToWorld, removeCardFromWorld } from "../../game/combat_mods/rewards/cardApply";
import { getGold } from "../../game/economy/gold";
import { registry } from "../../game/content/registry";
import { getAllRelicIds, getRelicById } from "../../game/content/relics";
import {
  applyRelic,
  getWorldRelicInstances,
  normalizeWorldRelics,
  removeRelic,
} from "../../game/systems/progression/relics";
import { DEFAULT_SETTINGS, getUserSettings, updateUserSettings } from "../../userSettings";
import { mountSettingsPanel, type SettingsPanelController } from "../settings/settingsPanel";
import {
  capturePaletteSnapshotDraft,
  type PaletteSnapshotCaptureDraft,
} from "../../game/paletteLab/snapshotCapture";

export type PauseMenuActions = {
  onResume(): void;
  onQuitRun(): void;
  onOpenDevTools?(): void;
  onSavePaletteSnapshot?(snapshot: PaletteSnapshotCaptureDraft): void;
};

export type PauseMenuController = {
  setVisible(v: boolean): void;
  render(world: World | null): void;
  destroy(): void;
};

type PauseSectionId = "OWNED_CARDS" | "SETTINGS" | "BUILD_STATS" | "DEBUG_METRICS";

type DebugMetricTab = "COMBAT" | "FLOW";

function safeNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function clearChildren(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function countInstances(arr: unknown, id: string): number {
  if (!Array.isArray(arr)) return 0;
  let count = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === id) count += 1;
  }
  return count;
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
  if (mod.op === "more" || mod.op === "increased" || mod.op === "less" || mod.op === "decreased") {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${Math.round(value * 100)}% ${mod.op} ${mod.key}`;
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} ${mod.key}`;
}

function metricRowsForTab(world: any, tab: DebugMetricTab): Array<[string, string]> {
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
  const aliveEnemyCount = (() => {
    const alive = Array.isArray(world?.eAlive) ? world.eAlive : [];
    let total = 0;
    for (let i = 0; i < alive.length; i++) {
      if (alive[i]) total += 1;
    }
    return total;
  })();

  const combatRows: Array<[string, string]> = [
    ["Actual DPS (inst)", safeNum(world?.metrics?.dps?.dpsInstant, 0).toFixed(2)],
    ["Actual DPS (smooth)", safeNum(world?.metrics?.dps?.dpsSmoothed, 0).toFixed(2)],
    ["On-screen Enemy HP", safeNum(liveEnemyHp, 0).toFixed(0)],
    ["Alive Enemies", safeNum(aliveEnemyCount, 0).toFixed(0)],
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
    ["Floor Time", safeNum(world?.phaseTime, 0).toFixed(1)],
    ["Floor Duration", safeNum(world?.floorDuration, 0).toFixed(1)],
    ["Alive Enemies", safeNum(aliveEnemyCount, 0).toFixed(0)],
    ["On-screen Enemy HP", safeNum(liveEnemyHp, 0).toFixed(0)],
  ];

  const hostileSpawnDebug = world?.hostileSpawnDebug;
  if (hostileSpawnDebug && typeof hostileSpawnDebug === "object") {
    const aliveByRole = hostileSpawnDebug.aliveByRole ?? {};
    const roleSummary = [
      `B:${safeNum(aliveByRole.baseline_chaser, 0).toFixed(0)}`,
      `F:${safeNum(aliveByRole.fast_chaser, 0).toFixed(0)}`,
      `T:${safeNum(aliveByRole.tank, 0).toFixed(0)}`,
      `R:${safeNum(aliveByRole.ranged, 0).toFixed(0)}`,
      `S:${safeNum(aliveByRole.suicide, 0).toFixed(0)}`,
      `L:${safeNum(aliveByRole.leaper, 0).toFixed(0)}`,
      `X:${safeNum(aliveByRole.special, 0).toFixed(0)}`,
    ].join(" ");
    const lastRequests = Array.isArray(hostileSpawnDebug.lastRequests)
      ? hostileSpawnDebug.lastRequests
      : [];
    const requestSummary = lastRequests.length <= 0
      ? "-"
      : lastRequests
          .map((request: any) => {
            const enemyName = (() => {
              try {
                return registry.enemy(request.enemyId).name;
              } catch {
                return String(request.enemyId);
              }
            })();
            return `${enemyName}x${safeNum(request.count, 0).toFixed(0)} ${String(request.reason ?? "normal")}`;
          })
          .join(", ");
    flowRows.push(
      ["Hostile Budget", safeNum(hostileSpawnDebug.budget, 0).toFixed(2)],
      ["Hostile Power/sec", safeNum(hostileSpawnDebug.powerPerSec, 0).toFixed(2)],
      ["Hostile Threat", safeNum(hostileSpawnDebug.liveThreat, 0).toFixed(2)],
      ["Hostile Threat Cap", safeNum(hostileSpawnDebug.liveThreatCap, 0).toFixed(2)],
      ["Hostile Stockpile", safeNum(hostileSpawnDebug.stockpileCap, 0).toFixed(2)],
      ["Hostile Spawn CD", safeNum(hostileSpawnDebug.spawnCooldownSec, 0).toFixed(2)],
      ["Hostile Burst CD", safeNum(hostileSpawnDebug.burstCooldownSec, 0).toFixed(2)],
      ["Hostile Roles", roleSummary],
      ["Hostile Last", requestSummary],
    );
  }

  return tab === "COMBAT" ? combatRows : flowRows;
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

  const savePaletteSnapshotBtn = document.createElement("button");
  savePaletteSnapshotBtn.type = "button";
  savePaletteSnapshotBtn.className = "pauseBtn pauseActionSaveSnapshot";
  savePaletteSnapshotBtn.textContent = "Save Palette Snapshot";
  savePaletteSnapshotBtn.setAttribute("data-pause-save-palette-snapshot", "1");
  headerActions.appendChild(savePaletteSnapshotBtn);

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

  const ownedDebugQuickRow = document.createElement("div");
  ownedDebugQuickRow.className = "pauseDevQuickRow pauseDebugCardsSection";
  ownedDebugQuickRow.setAttribute("data-dev-only", "1");
  ownedDebugQuickRow.setAttribute("data-debug-cards-section", "1");
  const ownedOpenDebugCardsBtn = document.createElement("button");
  ownedOpenDebugCardsBtn.type = "button";
  ownedOpenDebugCardsBtn.className = "pauseDevQuickBtn pauseDebugOpenBtn";
  ownedOpenDebugCardsBtn.textContent = "Open Debug Cards Editor";
  ownedOpenDebugCardsBtn.setAttribute("data-dev-only", "1");
  ownedOpenDebugCardsBtn.setAttribute("data-debug-cards-open", "1");
  const ownedOpenDebugRelicsBtn = document.createElement("button");
  ownedOpenDebugRelicsBtn.type = "button";
  ownedOpenDebugRelicsBtn.className = "pauseDevQuickBtn pauseDebugOpenBtn";
  ownedOpenDebugRelicsBtn.textContent = "Open Debug Relics Editor";
  ownedOpenDebugRelicsBtn.setAttribute("data-dev-only", "1");
  ownedOpenDebugRelicsBtn.setAttribute("data-debug-relics-open", "1");
  ownedDebugQuickRow.appendChild(ownedOpenDebugCardsBtn);
  ownedDebugQuickRow.appendChild(ownedOpenDebugRelicsBtn);

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

  const panelById: Record<PauseSectionId, HTMLElement> = {
    OWNED_CARDS: ownedCardsPanel,
    SETTINGS: settingsPanelSection,
    BUILD_STATS: buildStatsPanel,
    DEBUG_METRICS: debugMetricsPanel,
  };

  content.appendChild(ownedCardsPanel);
  content.appendChild(settingsPanelSection);
  content.appendChild(buildStatsPanel);
  content.appendChild(debugMetricsPanel);

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

  layout.appendChild(nav);
  layout.appendChild(content);
  panel.appendChild(header);
  panel.appendChild(layout);

  const debugLayer = document.createElement("div");
  debugLayer.className = "pauseDebugLayer";
  debugLayer.hidden = true;
  debugLayer.setAttribute("data-debug-layer", "1");

  const debugLayerPanel = document.createElement("div");
  debugLayerPanel.className = "pauseDebugLayerPanel";

  const debugLayerHeader = document.createElement("div");
  debugLayerHeader.className = "pauseDebugLayerHeader";

  const debugLayerTitle = document.createElement("h3");
  debugLayerTitle.textContent = "Debug Cards Editor";
  debugLayerHeader.appendChild(debugLayerTitle);

  const debugLayerActions = document.createElement("div");
  debugLayerActions.className = "pauseDebugLayerActions";
  const debugCancelBtn = document.createElement("button");
  debugCancelBtn.type = "button";
  debugCancelBtn.className = "pauseBtn";
  debugCancelBtn.textContent = "Close";
  debugCancelBtn.setAttribute("data-debug-cards-cancel", "1");
  debugLayerActions.appendChild(debugCancelBtn);
  debugLayerHeader.appendChild(debugLayerActions);

  const debugLayerBody = document.createElement("div");
  debugLayerBody.className = "pauseDebugLayerBody pauseSectionScroll";
  debugLayerBody.setAttribute("data-debug-cards-list", "1");
  const debugLayerNote = document.createElement("div");
  debugLayerNote.className = "pauseDebugLayerNote";
  debugLayerNote.hidden = true;

  debugLayerPanel.appendChild(debugLayerHeader);
  debugLayerPanel.appendChild(debugLayerNote);
  debugLayerPanel.appendChild(debugLayerBody);
  debugLayer.appendChild(debugLayerPanel);
  panel.appendChild(debugLayer);

  host.appendChild(panel);
  host.appendChild(quitConfirmOverlay);
  root.appendChild(host);

  let latestWorld: World | null = null;
  let visible = false;
  let selectedOwnedCardId: string | null = null;
  let activeSection: PauseSectionId = "OWNED_CARDS";
  let debugMetricTab: DebugMetricTab = "COMBAT";
  let debugLayerOpen = false;
  let debugMode: "CARDS" | "RELICS" = "CARDS";
  let debugRelicMessage = "";
  const debugCardIds = getAllCardIds();
  const debugRelicIds = getAllRelicIds();

  savePaletteSnapshotBtn.addEventListener("click", () => {
    if (!latestWorld) return;
    const snapshot = capturePaletteSnapshotDraft(latestWorld);
    (latestWorld as any).paletteSnapshotDraft = snapshot;
    args.actions.onSavePaletteSnapshot?.(snapshot);
  });

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
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new Event("resize"));
      }
    },
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

    const effectiveCrit = computeEffectiveCrit(world, resolved.critChance);
    const showEffective = effectiveCrit !== resolved.critChance;

    const rows: Array<[string, string]> = [
      ["Shots/sec", resolved.shotsPerSecond.toFixed(2)],
      ["Base Physical", resolved.baseDamage.physical.toFixed(1)],
      ["Base Fire", resolved.baseDamage.fire.toFixed(1)],
      ["Base Chaos", resolved.baseDamage.chaos.toFixed(1)],
      ["Crit Chance", showEffective ? `${pct(resolved.critChance)} (${pct(effectiveCrit)} eff)` : pct(resolved.critChance)],
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
      { id: "COMBAT", label: "Combat" },
      { id: "FLOW", label: "Flow" },
    ];

    for (const tab of tabs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pauseInlineTabBtn";
      btn.setAttribute("data-stats-debug-tab-id", tab.id);
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

  const resetRelicDraft = () => {
    const w = latestWorld as any;
    if (!w || typeof w !== "object") return;
    normalizeWorldRelics(w);
  };

  const closeDebugLayer = () => {
    debugLayerOpen = false;
    debugLayer.hidden = true;
  };

  const renderDebugLayer = () => {
    const isUserMode = !!((getUserSettings() as any).game?.userModeEnabled ?? true);
    debugLayer.hidden = !debugLayerOpen || isUserMode;
    if (debugLayer.hidden) return;

    clearChildren(debugLayerBody);
    debugLayerTitle.textContent = debugMode === "CARDS" ? "Debug Cards Editor" : "Debug Relics Editor";
    if (debugMode === "RELICS") {
      if (debugRelicMessage.length > 0) {
        debugLayerNote.textContent = debugRelicMessage;
        debugLayerNote.hidden = false;
      } else {
        debugLayerNote.textContent = "Starter relics are locked and cannot be removed.";
        debugLayerNote.hidden = false;
      }
    } else {
      debugLayerNote.textContent = "";
      debugLayerNote.hidden = true;
    }

    if (debugMode === "CARDS") {
      for (const cardId of debugCardIds) {
        const row = document.createElement("div");
        row.className = "pauseDebugCardRow";

        const label = document.createElement("span");
        label.className = "pauseDebugCardId";
        label.textContent = getCardById(cardId)?.displayName ?? cardId;

        const count = document.createElement("span");
        count.className = "pauseCardCount";
        count.textContent = `x${countInstances((latestWorld as any)?.cards, cardId)}`;
        count.setAttribute("data-debug-card-count", cardId);

        const plusBtn = document.createElement("button");
        plusBtn.type = "button";
        plusBtn.className = "pauseDebugCardBtn";
        plusBtn.textContent = "+";
        plusBtn.setAttribute("data-debug-card-add", cardId);
        plusBtn.addEventListener("click", () => {
          const w = latestWorld as any;
          if (!w || typeof w !== "object") return;
          applyCardToWorld(w, cardId);
          count.textContent = `x${countInstances(w.cards, cardId)}`;
          renderOwnedCards(latestWorld);
          renderTopStatsForOwnedAndSettings(latestWorld);
        });

        const minusBtn = document.createElement("button");
        minusBtn.type = "button";
        minusBtn.className = "pauseDebugCardBtn";
        minusBtn.textContent = "-";
        minusBtn.setAttribute("data-debug-card-remove", cardId);
        minusBtn.addEventListener("click", () => {
          const w = latestWorld as any;
          if (!w || typeof w !== "object" || !Array.isArray(w.cards)) {
            count.textContent = "x0";
            return;
          }
          removeCardFromWorld(w, cardId);
          count.textContent = `x${countInstances(w.cards, cardId)}`;
          renderOwnedCards(latestWorld);
          renderTopStatsForOwnedAndSettings(latestWorld);
        });

        row.appendChild(label);
        row.appendChild(count);
        row.appendChild(plusBtn);
        row.appendChild(minusBtn);
        debugLayerBody.appendChild(row);
      }
      return;
    }

    const w = latestWorld as any;
    const instances = w && typeof w === "object" ? getWorldRelicInstances(w) : [];
    const ownedById = new Set(instances.map((it) => it.id));

    for (const relicId of debugRelicIds) {
      const relic = getRelicById(relicId);
      if (!relic || !relic.isEnabled) continue;

      const row = document.createElement("div");
      row.className = "pauseDebugCardRow";

      const label = document.createElement("span");
      label.className = "pauseDebugCardId";
      label.textContent = relic.displayName;

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "pauseDebugCardBtn";
      const isOwned = ownedById.has(relicId);
      toggleBtn.textContent = isOwned ? "Remove" : "Add";
      toggleBtn.setAttribute(isOwned ? "data-debug-relic-remove" : "data-debug-relic-add", relicId);
      toggleBtn.addEventListener("click", () => {
        const world = latestWorld as any;
        if (!world || typeof world !== "object") return;
        if (ownedById.has(relicId)) {
          const result = removeRelic(world, relicId);
          if (!result.removed && result.reason === "LOCKED") {
            debugRelicMessage = "Starter relic can't be removed.";
          } else {
            debugRelicMessage = "";
          }
        } else {
          applyRelic(world, relicId, { source: "debug" });
          debugRelicMessage = "";
        }

        renderOwnedCards(latestWorld);
        renderTopStatsForOwnedAndSettings(latestWorld);
        renderBuildStats(latestWorld);
        renderDebugMetrics(latestWorld);
        renderDebugLayer();
      });

      row.appendChild(label);
      row.appendChild(toggleBtn);
      debugLayerBody.appendChild(row);
    }
  };

  const openDebugCardsEditor = () => {
    if ((getUserSettings() as any)?.game?.userModeEnabled ?? true) return;
    debugMode = "CARDS";
    debugRelicMessage = "";
    debugLayerOpen = true;
    renderDebugLayer();
  };

  const openDebugRelicsEditor = () => {
    if ((getUserSettings() as any)?.game?.userModeEnabled ?? true) return;
    debugMode = "RELICS";
    debugRelicMessage = "";
    resetRelicDraft();
    debugLayerOpen = true;
    renderDebugLayer();
  };

  ownedOpenDebugCardsBtn.addEventListener("click", openDebugCardsEditor);
  ownedOpenDebugRelicsBtn.addEventListener("click", openDebugRelicsEditor);
  debugCancelBtn.addEventListener("click", closeDebugLayer);
  debugLayer.addEventListener("click", (ev) => {
    if (ev.target !== debugLayer) return;
    closeDebugLayer();
  });

  const renderOwnedCards = (world: World | null) => {
    clearChildren(ownedList);
    clearChildren(ownedDetail);

    const appendDebugQuickActions = () => {
      ownedDetail.appendChild(ownedDebugQuickRow);
    };

    if (!world) {
      ownedList.textContent = "No run state";
      appendDebugQuickActions();
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
      appendDebugQuickActions();
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
    appendDebugQuickActions();
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

    if (isUserMode && (activeSection === "BUILD_STATS" || activeSection === "DEBUG_METRICS")) {
      setActiveSection("OWNED_CARDS");
    }

    if (isUserMode) {
      buildStatsPanel.hidden = true;
      debugMetricsPanel.hidden = true;
      debugLayerOpen = false;
    }

    renderDebugLayer();
  };

  const computeEffectiveCrit = (world: World, baseCrit: number): number => {
    const hasFullCritRelic = world.relics.includes("MOM_FULL_CRIT_DOUBLE");
    const hasLuckyCrit = world.relics.includes("PASS_CRIT_ROLLS_TWICE");
    const isAtFullMomentum = hasFullCritRelic && world.momentumMax > 0 && world.momentumValue >= world.momentumMax;
    const afterMomentum = Math.min(1, baseCrit * (isAtFullMomentum ? 2 : 1));
    return hasLuckyCrit ? 1 - (1 - afterMomentum) ** 2 : afterMomentum;
  };

  const renderTopStatsForOwnedAndSettings = (world: World | null) => {
    if (!world) return;
    const summary = document.createElement("div");
    summary.className = "pauseMeta";
    const snapshot = getCombatModsSnapshot(world as any);
    const baseCritChance = safeNum(snapshot.weaponStats.critChance);
    const effectiveCritChance = computeEffectiveCrit(world, baseCritChance);
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

    renderOwnedCards(world);
    renderTopStatsForOwnedAndSettings(world);
    renderBuildStats(world);
    renderDebugMetricTabs();
    renderDebugMetrics(world);
    renderDebugLayer();
    syncDevVisibility();
  };

  setActiveSection("OWNED_CARDS");

  return {
    setVisible(v: boolean): void {
      visible = v;
      host.hidden = !v;
      root.hidden = !v;
      if (!v) {
        closeQuitConfirm();
        closeDebugLayer();
      }
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
