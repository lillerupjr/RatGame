import { applyButtonStyle, createSection } from "./devToolsSectionHelpers";

export type DevToolsResetSectionController = {
  setSchemaVersion(version: number | string): void;
};

export type MountDevToolsResetSectionOptions = {
  onResetDebugTools: () => void;
  onResetSystemOverrides: () => void;
  onHardResetAllSettings: () => void;
  schemaVersion?: number;
};

export function mountDevToolsResetSection(
  root: HTMLElement,
  options: MountDevToolsResetSectionOptions,
): DevToolsResetSectionController {
  const section = createSection(
    root,
    "SECTION 3 - Reset / Maintenance",
    "Bucket-aware resets and diagnostics. Use hard reset with care.",
  );

  const maintenanceButtons = document.createElement("div");
  maintenanceButtons.style.display = "grid";
  maintenanceButtons.style.gridTemplateColumns = "repeat(auto-fit, minmax(180px, 1fr))";
  maintenanceButtons.style.gap = "8px";
  section.appendChild(maintenanceButtons);

  const resetDebugBtn = document.createElement("button");
  resetDebugBtn.type = "button";
  resetDebugBtn.textContent = "Reset Debug Tools";
  applyButtonStyle(resetDebugBtn);
  resetDebugBtn.addEventListener("click", options.onResetDebugTools);
  maintenanceButtons.appendChild(resetDebugBtn);

  const resetSystemBtn = document.createElement("button");
  resetSystemBtn.type = "button";
  resetSystemBtn.textContent = "Reset System Overrides";
  applyButtonStyle(resetSystemBtn);
  resetSystemBtn.addEventListener("click", options.onResetSystemOverrides);
  maintenanceButtons.appendChild(resetSystemBtn);

  const hardResetBtn = document.createElement("button");
  hardResetBtn.type = "button";
  hardResetBtn.textContent = "Hard Reset All Settings";
  applyButtonStyle(hardResetBtn, "danger");
  hardResetBtn.addEventListener("click", options.onHardResetAllSettings);
  maintenanceButtons.appendChild(hardResetBtn);

  const schemaText = document.createElement("div");
  schemaText.style.marginTop = "8px";
  schemaText.style.opacity = "0.85";
  section.appendChild(schemaText);

  const setSchemaVersion = (version: number | string) => {
    schemaText.textContent = `Schema Version: ${version}`;
  };
  setSchemaVersion(options.schemaVersion ?? "unknown");

  return { setSchemaVersion };
}
