import {
  getSettings,
  hardResetAllSettings,
  resetDebugToolsToDefault,
  resetSystemOverridesToDefault,
  saveDebugToolsSettings,
  saveSystemOverrides,
  SCHEMA_VERSION,
} from "../../settings/settingsStore";
import type { DebugToolsSettings, SystemOverrides } from "../../settings/settingsTypes";
import { mountDebugToolsSection } from "./DebugToolsSection";
import { mountDevToolsResetSection } from "./DevToolsResetSection";
import { mountSystemOverridesSection } from "./SystemOverridesSection";
import { applyButtonStyle } from "./devToolsSectionHelpers";

export type DevSettingsUiController = {
  open(): void;
  close(): void;
  toggle(): void;
};

function dispatchSettingsChanged(): void {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new Event("ratgame:settings-changed"));
  }
}

export function installDevToolsPanel(): DevSettingsUiController {
  const settingsMenu = document.getElementById("settingsMenu") as HTMLDivElement | null;
  const settingsPanel = settingsMenu?.querySelector(".panel") as HTMLDivElement | null;
  const settingsBackBtn = settingsPanel?.querySelector("#settingsBackBtn") as HTMLButtonElement | null;
  const noopController: DevSettingsUiController = {
    open() {},
    close() {},
    toggle() {},
  };
  if (!settingsPanel) return noopController;

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.textContent = "Dev Tools";
  toggleBtn.style.marginTop = "10px";
  toggleBtn.style.width = "100%";
  toggleBtn.style.minHeight = "36px";
  applyButtonStyle(toggleBtn, "primary");

  if (settingsBackBtn) {
    settingsPanel.insertBefore(toggleBtn, settingsBackBtn);
  } else {
    settingsPanel.appendChild(toggleBtn);
  }

  const layer = document.createElement("div");
  layer.hidden = true;
  layer.style.position = "fixed";
  layer.style.inset = "0";
  layer.style.display = "grid";
  layer.style.placeItems = "center";
  layer.style.background = "var(--bg-overlay)";
  layer.style.boxSizing = "border-box";
  layer.style.padding = "var(--overlay-pad-top) var(--overlay-pad-right) var(--overlay-pad-bottom) var(--overlay-pad-left)";
  layer.style.zIndex = "10000";

  const panel = document.createElement("div");
  panel.style.width = "min(1100px, 100%)";
  panel.style.maxHeight = "100%";
  panel.style.overflowY = "auto";
  panel.style.padding = "12px";
  panel.style.border = "1px solid var(--border-default)";
  panel.style.borderRadius = "0";
  panel.style.background = "linear-gradient(180deg, var(--bg-elevated), var(--focus-bg))";
  panel.style.color = "var(--text-primary)";
  panel.style.font = "12px var(--font-mono)";
  panel.style.boxShadow = "inset 0 0 0 1px var(--border-subtle), var(--shadow-medium)";
  panel.style.boxSizing = "border-box";
  layer.appendChild(panel);
  document.body.appendChild(layer);

  const headerRow = document.createElement("div");
  headerRow.style.display = "flex";
  headerRow.style.alignItems = "center";
  headerRow.style.justifyContent = "space-between";
  headerRow.style.gap = "10px";
  headerRow.style.marginBottom = "10px";
  panel.appendChild(headerRow);

  const titleWrap = document.createElement("div");
  const title = document.createElement("div");
  title.textContent = "Developer Tools";
  title.style.fontWeight = "700";
  title.style.fontSize = "13px";
  const subtitle = document.createElement("div");
  subtitle.textContent = "Separated by settings buckets: debug tools and system overrides.";
  subtitle.style.opacity = "0.8";
  subtitle.style.marginTop = "2px";
  titleWrap.appendChild(title);
  titleWrap.appendChild(subtitle);
  headerRow.appendChild(titleWrap);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  applyButtonStyle(closeBtn);
  headerRow.appendChild(closeBtn);

  const applyDebugPatch = (patch: Partial<DebugToolsSettings>) => {
    saveDebugToolsSettings(patch);
    dispatchSettingsChanged();
    syncFromSettings();
  };

  const applySystemPatch = (patch: Partial<SystemOverrides>) => {
    saveSystemOverrides(patch);
    dispatchSettingsChanged();
    syncFromSettings();
  };

  const debugSection = mountDebugToolsSection(panel, applyDebugPatch);
  const systemSection = mountSystemOverridesSection(panel, applySystemPatch);
  const resetSection = mountDevToolsResetSection(panel, {
    schemaVersion: SCHEMA_VERSION,
    onResetDebugTools: () => {
      resetDebugToolsToDefault();
      dispatchSettingsChanged();
      syncFromSettings();
    },
    onResetSystemOverrides: () => {
      resetSystemOverridesToDefault();
      dispatchSettingsChanged();
      syncFromSettings();
    },
    onHardResetAllSettings: () => {
      hardResetAllSettings();
      dispatchSettingsChanged();
      syncFromSettings();
    },
  });

  const setOpen = (open: boolean) => {
    layer.hidden = !open;
    if (open) syncFromSettings();
  };

  function syncFromSettings(): void {
    const settings = getSettings();
    debugSection.sync(settings.debug);
    systemSection.sync(settings.system);
    resetSection.setSchemaVersion(SCHEMA_VERSION);

    const isUserMode = settings.user.game.userModeEnabled;
    toggleBtn.hidden = isUserMode;
    if (isUserMode) setOpen(false);
  }

  layer.addEventListener("click", (ev) => {
    if (ev.target === layer) setOpen(false);
  });
  closeBtn.addEventListener("click", () => setOpen(false));
  toggleBtn.addEventListener("click", () => setOpen(layer.hidden));

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("ratgame:settings-changed", syncFromSettings as EventListener);
  }
  syncFromSettings();

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(layer.hidden),
  };
}
