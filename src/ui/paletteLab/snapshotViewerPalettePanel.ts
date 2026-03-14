import {
  getPalettesByGroup,
  normalizePaletteGroup,
  PALETTE_GROUPS,
} from "../../engine/render/palette/palettes";
import {
  normalizePaletteRemapWeightPercent,
  PALETTE_REMAP_WEIGHT_OPTIONS,
} from "../../debugSettings";
import {
  getUserSettings,
  updateUserSettings,
  type LightColorModeOverride,
  type LightStrengthOverride,
} from "../../userSettings";

export type SnapshotViewerPalettePanelController = {
  sync(active: boolean): void;
  destroy(): void;
};

type MountSnapshotViewerPalettePanelArgs = {
  onClose: () => void;
};

const NOOP_CONTROLLER: SnapshotViewerPalettePanelController = {
  sync() {},
  destroy() {},
};

export function mountSnapshotViewerPalettePanel(
  args: MountSnapshotViewerPalettePanelArgs,
): SnapshotViewerPalettePanelController {
  if (typeof document === "undefined" || !document.body) return NOOP_CONTROLLER;

  const root = document.createElement("aside");
  root.className = "snapshotViewerPalettePanel";
  root.hidden = true;
  root.setAttribute("data-snapshot-viewer-palette-panel", "true");

  const header = document.createElement("div");
  header.className = "snapshotViewerPalettePanelHeader";
  const title = document.createElement("div");
  title.className = "snapshotViewerPalettePanelTitle";
  title.textContent = "Snapshot Palette Controls";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "SecondaryButton snapshotViewerPalettePanelClose";
  closeBtn.textContent = "Close";
  closeBtn.setAttribute("data-snapshot-viewer-panel-close", "true");
  closeBtn.addEventListener("click", () => args.onClose());
  header.appendChild(title);
  header.appendChild(closeBtn);
  root.appendChild(header);

  const body = document.createElement("div");
  body.className = "snapshotViewerPalettePanelBody";
  root.appendChild(body);

  const createSelectRow = (labelText: string, dataId: string): HTMLSelectElement => {
    const row = document.createElement("label");
    row.className = "snapshotViewerPalettePanelRow";

    const label = document.createElement("span");
    label.className = "snapshotViewerPalettePanelLabel";
    label.textContent = labelText;

    const select = document.createElement("select");
    select.className = "snapshotViewerPalettePanelSelect";
    select.setAttribute("data-snapshot-viewer-control", dataId);

    row.appendChild(label);
    row.appendChild(select);
    body.appendChild(row);
    return select;
  };

  const paletteGroupSelect = createSelectRow("Palette Group", "palette-group");
  for (let i = 0; i < PALETTE_GROUPS.length; i += 1) {
    const group = PALETTE_GROUPS[i];
    const option = document.createElement("option");
    option.value = group;
    option.textContent = group;
    paletteGroupSelect.appendChild(option);
  }

  const paletteIdSelect = createSelectRow("Palette", "palette-id");
  const saturationSelect = createSelectRow("Saturation Weight", "saturation-weight");
  const darknessSelect = createSelectRow("Darkness", "darkness");
  const lightModeSelect = createSelectRow("Light Mode", "light-mode");
  const lightStrengthSelect = createSelectRow("Light Strength", "light-strength");
  for (let i = 0; i < PALETTE_REMAP_WEIGHT_OPTIONS.length; i += 1) {
    const optionValue = PALETTE_REMAP_WEIGHT_OPTIONS[i];
    const option = document.createElement("option");
    option.value = `${optionValue}`;
    option.textContent = `${optionValue}%`;
    saturationSelect.appendChild(option.cloneNode(true));
    darknessSelect.appendChild(option);
  }
  const lightModeOptions: Array<{ value: LightColorModeOverride; label: string }> = [
    { value: "authored", label: "Authored" },
    { value: "off", label: "Off" },
    { value: "standard", label: "Standard" },
    { value: "palette", label: "Palette" },
  ];
  for (let i = 0; i < lightModeOptions.length; i += 1) {
    const optionDef = lightModeOptions[i];
    const option = document.createElement("option");
    option.value = optionDef.value;
    option.textContent = optionDef.label;
    lightModeSelect.appendChild(option);
  }
  const lightStrengthOptions: Array<{ value: LightStrengthOverride; label: string }> = [
    { value: "authored", label: "Authored" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ];
  for (let i = 0; i < lightStrengthOptions.length; i += 1) {
    const optionDef = lightStrengthOptions[i];
    const option = document.createElement("option");
    option.value = optionDef.value;
    option.textContent = optionDef.label;
    lightStrengthSelect.appendChild(option);
  }

  const rebuildPaletteOptions = (groupRaw: string, selectedIdRaw: string): string => {
    const group = normalizePaletteGroup(groupRaw);
    const selectedId = typeof selectedIdRaw === "string" ? selectedIdRaw : "";
    const palettes = getPalettesByGroup(group);
    const nextSelectedId = palettes.some((palette) => palette.id === selectedId)
      ? selectedId
      : (palettes[0]?.id ?? "db32");

    paletteIdSelect.replaceChildren();
    for (let i = 0; i < palettes.length; i += 1) {
      const palette = palettes[i];
      const option = document.createElement("option");
      option.value = palette.id;
      option.textContent = `${palette.name} (${palette.id})`;
      paletteIdSelect.appendChild(option);
    }
    paletteIdSelect.value = nextSelectedId;
    return nextSelectedId;
  };

  let lastSettingsKey = "";
  const buildSettingsKey = () => {
    const settings = getUserSettings();
    return [
      settings.render.paletteSwapEnabled ? "1" : "0",
      settings.render.paletteGroup,
      settings.render.paletteId,
      settings.render.lightColorModeOverride,
      settings.render.lightStrengthOverride,
      settings.debug.paletteSWeightPercent,
      settings.debug.paletteDarknessPercent,
    ].join("|");
  };

  const syncFromSettings = () => {
    const settings = getUserSettings();
    const group = normalizePaletteGroup(settings.render.paletteGroup);
    paletteGroupSelect.value = group;
    const nextPaletteId = rebuildPaletteOptions(group, settings.render.paletteId);
    saturationSelect.value = `${normalizePaletteRemapWeightPercent(settings.debug.paletteSWeightPercent)}`;
    darknessSelect.value = `${normalizePaletteRemapWeightPercent(settings.debug.paletteDarknessPercent)}`;
    lightModeSelect.value = settings.render.lightColorModeOverride;
    lightStrengthSelect.value = settings.render.lightStrengthOverride;
    if (nextPaletteId !== settings.render.paletteId || group !== settings.render.paletteGroup) {
      updateUserSettings({
        render: {
          paletteSwapEnabled: true,
          paletteGroup: group,
          paletteId: nextPaletteId,
        },
      });
    }
  };

  const forcePaletteSwapEnabled = () => {
    const settings = getUserSettings();
    if (settings.render.paletteSwapEnabled) return;
    updateUserSettings({ render: { paletteSwapEnabled: true } });
  };

  paletteGroupSelect.addEventListener("change", () => {
    const group = normalizePaletteGroup(paletteGroupSelect.value);
    const currentPaletteId = getUserSettings().render.paletteId;
    const nextPaletteId = rebuildPaletteOptions(group, currentPaletteId);
    updateUserSettings({
      render: {
        paletteSwapEnabled: true,
        paletteGroup: group,
        paletteId: nextPaletteId,
      },
    });
    lastSettingsKey = "";
  });

  paletteIdSelect.addEventListener("change", () => {
    const group = normalizePaletteGroup(paletteGroupSelect.value);
    const nextPaletteId = rebuildPaletteOptions(group, paletteIdSelect.value);
    updateUserSettings({
      render: {
        paletteSwapEnabled: true,
        paletteGroup: group,
        paletteId: nextPaletteId,
      },
    });
    lastSettingsKey = "";
  });

  saturationSelect.addEventListener("change", () => {
    const numeric = Number.parseInt(saturationSelect.value, 10);
    updateUserSettings({
      debug: { paletteSWeightPercent: normalizePaletteRemapWeightPercent(numeric) },
    });
    lastSettingsKey = "";
  });

  darknessSelect.addEventListener("change", () => {
    const numeric = Number.parseInt(darknessSelect.value, 10);
    updateUserSettings({
      debug: { paletteDarknessPercent: normalizePaletteRemapWeightPercent(numeric) },
    });
    lastSettingsKey = "";
  });

  lightModeSelect.addEventListener("change", () => {
    updateUserSettings({
      render: {
        lightColorModeOverride: lightModeSelect.value as LightColorModeOverride,
      },
    });
    lastSettingsKey = "";
  });

  lightStrengthSelect.addEventListener("change", () => {
    updateUserSettings({
      render: {
        lightStrengthOverride: lightStrengthSelect.value as LightStrengthOverride,
      },
    });
    lastSettingsKey = "";
  });

  document.body.appendChild(root);

  return {
    sync(active: boolean) {
      if (!active) {
        root.hidden = true;
        lastSettingsKey = "";
        return;
      }

      root.hidden = false;
      forcePaletteSwapEnabled();
      const key = buildSettingsKey();
      if (key === lastSettingsKey) return;
      syncFromSettings();
      lastSettingsKey = buildSettingsKey();
    },
    destroy() {
      root.remove();
      lastSettingsKey = "";
    },
  };
}
