export type EndRunTabId = "stats" | "leaderboard";

export type TabBarRefs = {
  statsBtn: HTMLButtonElement;
  leaderboardBtn: HTMLButtonElement;
  statsPanel: HTMLElement;
  leaderboardPanel: HTMLElement;
};

export type TabBarController = {
  getTab(): EndRunTabId;
  setTab(tab: EndRunTabId): void;
  destroy(): void;
};

export function mountEndRunTabBar(refs: TabBarRefs, initialTab: EndRunTabId = "stats"): TabBarController {
  let currentTab: EndRunTabId = initialTab;

  const applyTab = (tab: EndRunTabId): void => {
    currentTab = tab;
    const showStats = tab === "stats";
    refs.statsPanel.hidden = !showStats;
    refs.leaderboardPanel.hidden = showStats;
    refs.statsBtn.classList.toggle("active", showStats);
    refs.leaderboardBtn.classList.toggle("active", !showStats);
    refs.statsBtn.setAttribute("aria-selected", showStats ? "true" : "false");
    refs.leaderboardBtn.setAttribute("aria-selected", showStats ? "false" : "true");
  };

  const onStatsClick = () => applyTab("stats");
  const onLeaderboardClick = () => applyTab("leaderboard");

  refs.statsBtn.addEventListener("click", onStatsClick);
  refs.leaderboardBtn.addEventListener("click", onLeaderboardClick);

  applyTab(initialTab);

  return {
    getTab: () => currentTab,
    setTab: applyTab,
    destroy: () => {
      refs.statsBtn.removeEventListener("click", onStatsClick);
      refs.leaderboardBtn.removeEventListener("click", onLeaderboardClick);
    },
  };
}
