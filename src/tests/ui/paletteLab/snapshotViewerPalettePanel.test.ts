import { beforeEach, describe, expect, test, vi } from "vitest";

const paletteData = vi.hoisted(() => ({
  groups: ["live", "experimental"] as const,
  byGroup: {
    live: [
      { id: "db32", name: "DawnBringer 32" },
      { id: "berry", name: "Berry" },
    ],
    experimental: [
      { id: "exp_a", name: "Exp A" },
      { id: "exp_b", name: "Exp B" },
    ],
  } as const,
}));

type FakeListener = (ev: FakeEvent) => void;

class FakeEvent {
  type: string;
  target: FakeElement | null;
  constructor(type: string, target: FakeElement | null = null) {
    this.type = type;
    this.target = target;
  }
}

class FakeElement {
  tagName: string;
  className = "";
  hidden = false;
  type = "";
  value = "";
  textContent = "";
  dataset: Record<string, string> = {};
  children: FakeElement[] = [];
  parentNode: FakeElement | null = null;
  private listeners = new Map<string, FakeListener[]>();

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(...newChildren: FakeElement[]): void {
    this.children = [];
    for (let i = 0; i < newChildren.length; i += 1) {
      this.appendChild(newChildren[i]);
    }
  }

  setAttribute(name: string, value: string): void {
    if (!name.startsWith("data-")) return;
    const key = name.slice(5).replace(/-([a-z])/g, (_m, g1: string) => g1.toUpperCase());
    this.dataset[key] = value;
  }

  addEventListener(type: string, listener: FakeListener): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  dispatchEvent(ev: FakeEvent): boolean {
    if (!ev.target) ev.target = this;
    const listeners = this.listeners.get(ev.type) ?? [];
    for (let i = 0; i < listeners.length; i += 1) listeners[i](ev);
    return true;
  }

  remove(): void {
    if (!this.parentNode) return;
    const idx = this.parentNode.children.indexOf(this);
    if (idx >= 0) this.parentNode.children.splice(idx, 1);
    this.parentNode = null;
  }

  cloneNode(_deep = false): FakeElement {
    const clone = new FakeElement(this.tagName);
    clone.className = this.className;
    clone.hidden = this.hidden;
    clone.type = this.type;
    clone.value = this.value;
    clone.textContent = this.textContent;
    clone.dataset = { ...this.dataset };
    return clone;
  }
}

class FakeDocument {
  body = new FakeElement("body");
  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }
}

const userSettingsState = vi.hoisted(() => ({
  settings: {
    render: {
      paletteSwapEnabled: false,
      paletteGroup: "live",
      paletteId: "db32",
      lightColorModeOverride: "authored",
      lightStrengthOverride: "authored",
    },
    debug: {
      paletteSWeightPercent: 25,
      paletteDarknessPercent: 50,
    },
  },
}));

vi.mock("../../../engine/render/palette/palettes", () => ({
  PALETTE_GROUPS: [...paletteData.groups],
  normalizePaletteGroup: (raw: string) => (raw === "experimental" ? "experimental" : "live"),
  getPalettesByGroup: (groupRaw: string) => {
    const group = groupRaw === "experimental" ? "experimental" : "live";
    return paletteData.byGroup[group];
  },
}));

vi.mock("../../../debugSettings", () => ({
  PALETTE_REMAP_WEIGHT_OPTIONS: [0, 25, 50, 75, 100],
  normalizePaletteRemapWeightPercent: (value: unknown) => {
    const numeric = Number(value);
    const options = [0, 25, 50, 75, 100];
    if (!Number.isFinite(numeric)) return 0;
    let best = 0;
    let dist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < options.length; i += 1) {
      const option = options[i];
      const currentDist = Math.abs(option - numeric);
      if (currentDist < dist) {
        best = option;
        dist = currentDist;
      }
    }
    return best;
  },
}));

vi.mock("../../../userSettings", () => ({
  getUserSettings: () => userSettingsState.settings,
  updateUserSettings: (patch: Record<string, Record<string, unknown>>) => {
    if (patch.render) {
      userSettingsState.settings.render = {
        ...userSettingsState.settings.render,
        ...patch.render,
      };
    }
    if (patch.debug) {
      userSettingsState.settings.debug = {
        ...userSettingsState.settings.debug,
        ...patch.debug,
      };
    }
    return userSettingsState.settings;
  },
}));

import { mountSnapshotViewerPalettePanel } from "../../../ui/paletteLab/snapshotViewerPalettePanel";

function findByData(root: FakeElement, key: string, value?: string): FakeElement | null {
  const match = value == null ? key in root.dataset : root.dataset[key] === value;
  if (match) return root;
  for (let i = 0; i < root.children.length; i += 1) {
    const found = findByData(root.children[i], key, value);
    if (found) return found;
  }
  return null;
}

describe("snapshot viewer palette panel", () => {
  beforeEach(() => {
    userSettingsState.settings = {
      render: {
        paletteSwapEnabled: false,
        paletteGroup: "live",
        paletteId: "db32",
        lightColorModeOverride: "authored",
        lightStrengthOverride: "authored",
      },
      debug: {
        paletteSWeightPercent: 25,
        paletteDarknessPercent: 50,
      },
    };
    const doc = new FakeDocument();
    (globalThis as any).document = doc;
  });

  test("shows only when active and forces palette swap enabled", () => {
    const panel = mountSnapshotViewerPalettePanel({ onClose: vi.fn() });
    const root = findByData((globalThis as any).document.body, "snapshotViewerPalettePanel", "true");
    expect(root).toBeTruthy();
    expect(root?.hidden).toBe(true);

    panel.sync(true);
    expect(root?.hidden).toBe(false);
    expect(userSettingsState.settings.render.paletteSwapEnabled).toBe(true);

    panel.sync(false);
    expect(root?.hidden).toBe(true);
  });

  test("close button triggers callback", () => {
    const onClose = vi.fn();
    const panel = mountSnapshotViewerPalettePanel({ onClose });
    panel.sync(true);

    const closeBtn = findByData((globalThis as any).document.body, "snapshotViewerPanelClose", "true");
    expect(closeBtn).toBeTruthy();
    closeBtn?.dispatchEvent(new FakeEvent("click", closeBtn));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("reroll seed button triggers callback", () => {
    const onRerollSeed = vi.fn();
    const panel = mountSnapshotViewerPalettePanel({ onClose: vi.fn(), onRerollSeed });
    panel.sync(true);

    const rerollBtn = findByData((globalThis as any).document.body, "snapshotViewerPanelReroll", "true");
    expect(rerollBtn).toBeTruthy();
    rerollBtn?.dispatchEvent(new FakeEvent("click", rerollBtn));
    expect(onRerollSeed).toHaveBeenCalledTimes(1);
  });

  test("group change rebuilds palette and updates settings", () => {
    const panel = mountSnapshotViewerPalettePanel({ onClose: vi.fn() });
    panel.sync(true);

    const groupSelect = findByData((globalThis as any).document.body, "snapshotViewerControl", "palette-group");
    const paletteSelect = findByData((globalThis as any).document.body, "snapshotViewerControl", "palette-id");
    expect(groupSelect).toBeTruthy();
    expect(paletteSelect).toBeTruthy();

    (groupSelect as FakeElement).value = "experimental";
    groupSelect?.dispatchEvent(new FakeEvent("change", groupSelect));
    expect(userSettingsState.settings.render.paletteGroup).toBe("experimental");
    expect(userSettingsState.settings.render.paletteId).toBe("exp_a");
    expect((paletteSelect as FakeElement).value).toBe("exp_a");
  });

  test("saturation and darkness controls persist in settings", () => {
    const panel = mountSnapshotViewerPalettePanel({ onClose: vi.fn() });
    panel.sync(true);

    const saturationSelect = findByData((globalThis as any).document.body, "snapshotViewerControl", "saturation-weight");
    const darknessSelect = findByData((globalThis as any).document.body, "snapshotViewerControl", "darkness");
    expect(saturationSelect).toBeTruthy();
    expect(darknessSelect).toBeTruthy();

    (saturationSelect as FakeElement).value = "100";
    saturationSelect?.dispatchEvent(new FakeEvent("change", saturationSelect));
    (darknessSelect as FakeElement).value = "75";
    darknessSelect?.dispatchEvent(new FakeEvent("change", darknessSelect));

    expect(userSettingsState.settings.debug.paletteSWeightPercent).toBe(100);
    expect(userSettingsState.settings.debug.paletteDarknessPercent).toBe(75);
  });

  test("light mode and strength controls persist in settings", () => {
    const panel = mountSnapshotViewerPalettePanel({ onClose: vi.fn() });
    panel.sync(true);

    const modeSelect = findByData((globalThis as any).document.body, "snapshotViewerControl", "light-mode");
    const strengthSelect = findByData((globalThis as any).document.body, "snapshotViewerControl", "light-strength");
    expect(modeSelect).toBeTruthy();
    expect(strengthSelect).toBeTruthy();

    (modeSelect as FakeElement).value = "palette";
    modeSelect?.dispatchEvent(new FakeEvent("change", modeSelect));
    (strengthSelect as FakeElement).value = "high";
    strengthSelect?.dispatchEvent(new FakeEvent("change", strengthSelect));

    expect(userSettingsState.settings.render.lightColorModeOverride).toBe("palette");
    expect(userSettingsState.settings.render.lightStrengthOverride).toBe("high");
  });
});
