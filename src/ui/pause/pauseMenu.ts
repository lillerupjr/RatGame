import type { World } from "../../engine/world/world";
import { getCombatModsSnapshot } from "../../game/combat_mods";
import { resolveCombatStarterWeaponId } from "../../game/combat_mods/content/weapons/characterStarterMap";
import { getCombatStarterWeaponById } from "../../game/combat_mods/content/weapons/starterWeapons";
import { getGold } from "../../game/economy/gold";
import { registry } from "../../game/content/registry";
import { inspectWorldRingProgression } from "../../game/progression/rings/ringInspection";
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

type PauseSectionId = "RINGS" | "SETTINGS" | "BUILD_STATS" | "DEBUG_METRICS";

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

function describeStatMod(mod: { key: string; op: string; value: number }): string {
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
      "Progression Rewards",
      `${safeNum(world?.rewardBudgetUsed, 0).toFixed(0)}/${safeNum(world?.rewardBudgetTotal, 0).toFixed(0)}`,
    ],
    [
      "Reward Claim Keys",
      `${Array.isArray(world?.rewardClaimKeys) ? world.rewardClaimKeys.length : 0}`,
    ],
    ["Last Reward Key", `${world?.lastRewardClaimKey ?? "-"}`],
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

  const ringsPanel = document.createElement("section");
  ringsPanel.className = "pauseModePanel";
  const ownedTitle = document.createElement("h3");
  ownedTitle.className = "pauseSectionTitle";
  ownedTitle.textContent = "Rings";
  const ownedList = document.createElement("div");
  ownedList.className = "pauseOwnedRingsList";
  const ownedDetail = document.createElement("div");
  ownedDetail.className = "pauseOwnedRingDetail";

  ringsPanel.appendChild(ownedTitle);
  ringsPanel.appendChild(ownedList);
  ringsPanel.appendChild(ownedDetail);

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
    RINGS: ringsPanel,
    SETTINGS: settingsPanelSection,
    BUILD_STATS: buildStatsPanel,
    DEBUG_METRICS: debugMetricsPanel,
  };

  content.appendChild(ringsPanel);
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

  addNavButton("Rings", { sectionId: "RINGS" });
  addNavButton("Settings", { sectionId: "SETTINGS" });
  addNavButton("Build Stats", { sectionId: "BUILD_STATS", devOnly: true });
  addNavButton("Debug Metrics", { sectionId: "DEBUG_METRICS", devOnly: true });

  layout.appendChild(nav);
  layout.appendChild(content);
  panel.appendChild(header);
  panel.appendChild(layout);

  host.appendChild(panel);
  host.appendChild(quitConfirmOverlay);
  root.appendChild(host);

  let latestWorld: World | null = null;
  let visible = false;
  let selectedRingInstanceId: string | null = null;
  let activeSection: PauseSectionId = "RINGS";
  let debugMetricTab: DebugMetricTab = "COMBAT";

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
        setActiveSection("RINGS");
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

  const closeDebugLayer = () => {
    // Old debug progression editors were removed with the ring migration.
  };

  const renderDebugLayer = () => {
    // No debug layer in the ring-first progression UI.
  };

  const renderOwnedRings = (world: World | null) => {
    clearChildren(ownedList);
    clearChildren(ownedDetail);

    if (!world) {
      ownedList.textContent = "No run state";
      return;
    }

    const inspection = inspectWorldRingProgression(world);
    const rings = [...inspection.rings].sort((a, b) => a.instance.slotId.localeCompare(b.instance.slotId));

    if (rings.length === 0) {
      ownedList.textContent = "No rings equipped yet.";
      const hint = document.createElement("div");
      hint.className = "pauseMeta";
      hint.textContent = "Choose ring rewards and vendor offers to build your run.";
      ownedDetail.appendChild(hint);
      selectedRingInstanceId = null;
      return;
    }

    if (!selectedRingInstanceId || !rings.some((ring) => ring.instance.instanceId === selectedRingInstanceId)) {
      selectedRingInstanceId = rings[0].instance.instanceId;
    }

    for (const ring of rings) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "pauseOwnedRingRow";
      row.classList.toggle("active", ring.instance.instanceId === selectedRingInstanceId);

      const left = document.createElement("div");
      left.className = "pauseOwnedRingMain";

      const name = document.createElement("div");
      name.className = "pauseOwnedRingName";
      name.textContent = ring.ringName;

      const effect = document.createElement("div");
      effect.className = "pauseOwnedRingSummary";
      effect.textContent = `${ring.familyId} family`;

      left.appendChild(name);
      left.appendChild(effect);

      const meta = document.createElement("div");
      meta.className = "pauseOwnedRingMeta";

      const tier = document.createElement("span");
      tier.className = "pauseOwnedTier";
      tier.textContent = ring.instance.slotId;
      meta.appendChild(tier);

      const stack = document.createElement("span");
      stack.className = "pauseOwnedStack";
      stack.textContent = `${ring.unlockedNodes.length} nodes`;
      meta.appendChild(stack);

      row.appendChild(left);
      row.appendChild(meta);

      row.addEventListener("click", () => {
        selectedRingInstanceId = ring.instance.instanceId;
        renderOwnedRings(latestWorld);
      });

      ownedList.appendChild(row);
    }

    const selected = rings.find((ring) => ring.instance.instanceId === selectedRingInstanceId) ?? rings[0];
    const selectedMainEffect = selected.runtimeEffects.find((effect) => effect.source.kind === "RING_MAIN")?.effect ?? null;

    const detailTitle = document.createElement("h4");
    detailTitle.textContent = selected.ringName;
    const detailMeta = document.createElement("div");
    detailMeta.className = "pauseMeta";
    detailMeta.textContent = `Instance: ${selected.instance.instanceId} · Slot ${selected.instance.slotId} · ${selected.instance.allocatedPassivePoints} passive points · Scalar ${pct(selected.mainEffectScalar)}`;

    ownedDetail.appendChild(detailTitle);
    ownedDetail.appendChild(detailMeta);

    const modsHeader = document.createElement("div");
    modsHeader.className = "pauseMeta pauseMetaHeader";
    modsHeader.textContent = "Main effect";
    ownedDetail.appendChild(modsHeader);

    const modList = document.createElement("ul");
    modList.className = "pauseOwnedModList";

    const mods = selectedMainEffect?.kind === "STAT_MODIFIERS" ? selectedMainEffect.mods : [];
    if (mods.length === 0) {
      const li = document.createElement("li");
      li.textContent = selectedMainEffect?.kind ?? "No stat modifiers";
      modList.appendChild(li);
    } else {
      for (const mod of mods) {
        const li = document.createElement("li");
        li.textContent = describeStatMod(mod);
        modList.appendChild(li);
      }
    }

    if ((selected.slot?.empowermentScalar ?? 0) > 0) {
      const li = document.createElement("li");
      li.textContent = `+${Math.round((selected.slot?.empowermentScalar ?? 0) * 100)}% finger empowerment`;
      modList.appendChild(li);
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

    if (isUserMode && (activeSection === "BUILD_STATS" || activeSection === "DEBUG_METRICS")) {
      setActiveSection("RINGS");
    }

    if (isUserMode) {
      buildStatsPanel.hidden = true;
      debugMetricsPanel.hidden = true;
    }

    renderDebugLayer();
  };

  const computeEffectiveCrit = (_world: World, baseCrit: number): number => {
    return Math.min(1, baseCrit);
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

    const first = ringsPanel.querySelector(".pauseMeta");
    if (first && first.parentElement === ringsPanel) first.remove();
    ringsPanel.insertBefore(summary, ownedList);
  };

  const renderAll = (world: World | null) => {
    settingsPanel.refresh();
    syncDevVisibility();

    renderOwnedRings(world);
    renderTopStatsForOwnedAndSettings(world);
    renderBuildStats(world);
    renderDebugMetricTabs();
    renderDebugMetrics(world);
    renderDebugLayer();
    syncDevVisibility();
  };

  setActiveSection("RINGS");

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
