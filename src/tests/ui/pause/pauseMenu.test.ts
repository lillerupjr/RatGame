import { beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_SPAWN_TUNING } from "../../../game/balance/spawnTuningDefaults";

class FakeEvent {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
}

type Listener = (ev: FakeEvent) => void;

class FakeClassList {
  private classes = new Set<string>();
  add(name: string) { this.classes.add(name); }
  remove(name: string) { this.classes.delete(name); }
  contains(name: string) { return this.classes.has(name); }
  toggle(name: string, force?: boolean): boolean {
    if (force === true) {
      this.classes.add(name);
      return true;
    }
    if (force === false) {
      this.classes.delete(name);
      return false;
    }
    if (this.classes.has(name)) {
      this.classes.delete(name);
      return false;
    }
    this.classes.add(name);
    return true;
  }
}

class FakeElement {
  tagName: string;
  hidden = false;
  className = "";
  classList = new FakeClassList();
  dataset: Record<string, string> = {};
  type = "";
  min = "";
  max = "";
  step = "";
  value = "";
  checked = false;
  disabled = false;

  private _text = "";
  private listeners = new Map<string, Listener[]>();
  private attrs = new Map<string, string>();

  children: FakeElement[] = [];
  parentNode: FakeElement | null = null;

  get parentElement(): FakeElement | null {
    return this.parentNode;
  }

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  appendChild(child: FakeElement): FakeElement {
    if (child.parentNode && child.parentNode !== this) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child: FakeElement, reference: FakeElement | null): FakeElement {
    if (!reference || !this.children.includes(reference)) {
      return this.appendChild(child);
    }
    if (child.parentNode && child.parentNode !== this) {
      child.parentNode.removeChild(child);
    }
    if (child.parentNode === this) {
      const existingIndex = this.children.indexOf(child);
      if (existingIndex >= 0) this.children.splice(existingIndex, 1);
    }
    const index = this.children.indexOf(reference);
    child.parentNode = this;
    this.children.splice(index, 0, child);
    return child;
  }

  removeChild(child: FakeElement): FakeElement {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parentNode = null;
    return child;
  }

  remove(): void {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  get firstChild(): FakeElement | null {
    return this.children[0] ?? null;
  }

  set textContent(v: string) {
    this._text = v ?? "";
  }

  get textContent(): string {
    return this._text + this.children.map((c) => c.textContent).join("");
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[key] = value;
    }
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  addEventListener(type: string, listener: Listener): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(listener);
    this.listeners.set(type, arr);
  }

  removeEventListener(type: string, listener: Listener): void {
    const arr = this.listeners.get(type) ?? [];
    this.listeners.set(type, arr.filter((l) => l !== listener));
  }

  dispatchEvent(ev: FakeEvent): void {
    const arr = this.listeners.get(ev.type) ?? [];
    for (const listener of arr) listener(ev);
  }

  click(): void {
    if (this.tagName === "INPUT" && this.type === "checkbox") {
      this.checked = !this.checked;
    }
    this.dispatchEvent(new FakeEvent("click"));
    if (this.tagName === "INPUT" && this.type === "checkbox") {
      this.dispatchEvent(new FakeEvent("change"));
    }
  }

  querySelector(selector: string): FakeElement | null {
    const mv = selector.match(/^\[data-([a-z0-9-]+)=['"]([^'"]+)['"]\]$/i);
    if (mv) {
      const raw = mv[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return this.find((node) => node.dataset[raw] === mv[2]);
    }
    const m = selector.match(/^\[data-([a-z0-9-]+)\]$/i);
    if (m) {
      const raw = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return this.find((node) => raw in node.dataset);
    }
    if (selector.startsWith(".")) {
      const cls = selector.slice(1);
      return this.find((node) => {
        const byName = node.className.split(/\s+/).includes(cls);
        return byName || node.classList.contains(cls);
      });
    }
    return null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const mv = selector.match(/^\[data-([a-z0-9-]+)=['"]([^'"]+)['"]\]$/i);
    if (mv) {
      const raw = mv[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return this.findAll((node) => node.dataset[raw] === mv[2]);
    }
    const m = selector.match(/^\[data-([a-z0-9-]+)\]$/i);
    if (m) {
      const raw = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return this.findAll((node) => raw in node.dataset);
    }
    if (selector.startsWith(".")) {
      const cls = selector.slice(1);
      return this.findAll((node) => {
        const byName = node.className.split(/\s+/).includes(cls);
        return byName || node.classList.contains(cls);
      });
    }
    return [];
  }

  private find(pred: (node: FakeElement) => boolean): FakeElement | null {
    for (const child of this.children) {
      if (pred(child)) return child;
      const inner = child.find(pred);
      if (inner) return inner;
    }
    return null;
  }

  private findAll(pred: (node: FakeElement) => boolean): FakeElement[] {
    const out: FakeElement[] = [];
    for (const child of this.children) {
      if (pred(child)) out.push(child);
      const inner = child.findAll(pred);
      if (inner.length > 0) out.push(...inner);
    }
    return out;
  }
}

class FakeDocument {
  body = new FakeElement("body");
  createElement(tag: string): FakeElement {
    return new FakeElement(tag);
  }
}

const audioMockState = vi.hoisted(() => ({
  musicVolume: 0.6,
  musicMuted: false,
  sfxVolume: 1,
  sfxMuted: false,
}));

const debugFlags = vi.hoisted(() => ({
  pauseDebugCards: false,
  pauseCsvControls: false,
}));

const userSettingsState = vi.hoisted(() => ({
  settings: {
    debug: {
      pauseDebugCards: false,
      pauseCsvControls: false,
    },
    game: {
      userModeEnabled: true,
      healthOrbSide: "left",
      gameSpeed: 1.0,
    },
    render: {
      entityShadowsDisable: false,
      entityAnchorsEnabled: false,
      renderPerfCountersEnabled: false,
      paletteSwapEnabled: false,
      paletteId: "db32",
      performanceMode: false,
      verticalTilesMode: "auto",
      verticalTilesUser: 9,
      verticalTilesAutoPhone: 6,
      verticalTilesAutoDesktop: 9,
      visibleVerticalTiles: 12,
      tileRenderRadius: 0,
      spawnBase: 1.0,
      spawnPerDepth: 1.12,
      hpBase: 1.0,
      hpPerDepth: 1.18,
      pressureAt0Sec: 0.8,
      pressureAt120Sec: 1.4,
    },
    audio: {
      masterVolume: 1,
      musicVolume: 0.6,
      sfxVolume: 1,
      musicMuted: false,
      sfxMuted: false,
    },
  },
}));

vi.mock("../../../game/audio/audioSettings", () => ({
  getAudioSettings: vi.fn(() => ({ ...audioMockState })),
  setMusicVolume: vi.fn((v: number) => {
    audioMockState.musicVolume = Math.max(0, Math.min(1, v));
  }),
  setMusicMuted: vi.fn((m: boolean) => {
    audioMockState.musicMuted = !!m;
  }),
  setSfxVolume: vi.fn((v: number) => {
    audioMockState.sfxVolume = Math.max(0, Math.min(1, v));
  }),
  setSfxMuted: vi.fn((m: boolean) => {
    audioMockState.sfxMuted = !!m;
  }),
  applySfxSettingsToWorld: vi.fn((w: any) => {
    if (!w) return;
    w.sfxMaster = audioMockState.sfxMuted ? 0 : audioMockState.sfxVolume;
  }),
}));

vi.mock("../../../userSettings", () => ({
  DEFAULT_GAME_SPEED: 1.0,
  DEFAULT_VISIBLE_VERTICAL_TILES_PHONE: 6,
  DEFAULT_VISIBLE_VERTICAL_TILES_DESKTOP: 9,
  DEFAULT_VISIBLE_VERTICAL_TILES: 9,
  DEFAULT_VERTICAL_TILES_MODE: "auto",
  MIN_GAME_SPEED: 0.5,
  MIN_VISIBLE_VERTICAL_TILES: 8,
  MAX_GAME_SPEED: 1.5,
  MAX_VISIBLE_VERTICAL_TILES: 20,
  clampGameSpeed: (v: number) => Math.max(0.5, Math.min(1.5, Number.isFinite(v) ? v : 1.0)),
  clampVisibleVerticalTiles: (v: number) => Math.max(8, Math.min(20, Math.round(Number.isFinite(v) ? v : 9))),
  resolveVerticalTiles: (render: any) => {
    const mode = render?.verticalTilesMode === "manual" ? "manual" : "auto";
    const manual = Math.max(8, Math.min(20, Math.round(Number(render?.verticalTilesUser ?? render?.visibleVerticalTiles ?? 9))));
    const autoPhone = Math.max(8, Math.min(20, Math.round(Number(render?.verticalTilesAutoPhone ?? 6))));
    const autoDesktop = Math.max(8, Math.min(20, Math.round(Number(render?.verticalTilesAutoDesktop ?? 9))));
    const viewportClass = "desktop" as const;
    const effective = mode === "manual" ? manual : autoDesktop;
    return { mode, viewportClass, effective, manual, autoPhone, autoDesktop };
  },
  DEFAULT_SETTINGS: {
    debug: {
      pauseDebugCards: false,
      pauseCsvControls: false,
    },
    game: {
      userModeEnabled: true,
      healthOrbSide: "left",
      gameSpeed: 1.0,
    },
    render: {
      entityShadowsDisable: false,
      entityAnchorsEnabled: false,
      renderPerfCountersEnabled: false,
      performanceMode: false,
      verticalTilesMode: "auto",
      verticalTilesUser: 9,
      verticalTilesAutoPhone: 6,
      verticalTilesAutoDesktop: 9,
      visibleVerticalTiles: 12,
      tileRenderRadius: 0,
      paletteSwapEnabled: false,
      paletteId: "db32",
      spawnBase: 1.0,
      spawnPerDepth: 1.12,
      hpBase: 1.0,
      hpPerDepth: 1.18,
      pressureAt0Sec: 0.8,
      pressureAt120Sec: 1.4,
    },
    audio: {
      masterVolume: 1,
      musicVolume: 0.6,
      sfxVolume: 1,
      musicMuted: false,
      sfxMuted: false,
    },
  },
  isPauseDebugCardsEnabled: vi.fn(() => debugFlags.pauseDebugCards),
  isPauseCsvControlsEnabled: vi.fn(() => debugFlags.pauseCsvControls),
  getUserSettings: vi.fn(() => userSettingsState.settings),
  updateUserSettings: vi.fn((patch: any) => {
    userSettingsState.settings = {
      ...userSettingsState.settings,
      ...patch,
      render: {
        ...userSettingsState.settings.render,
        ...(patch.render ?? {}),
      },
      game: {
        ...(userSettingsState.settings as any).game,
        ...(patch.game ?? {}),
      },
      debug: {
        ...userSettingsState.settings.debug,
        ...(patch.debug ?? {}),
      },
    };
    return userSettingsState.settings;
  }),
}));

import { mountPauseMenu } from "../../../ui/pause/pauseMenu";
import * as audioSettingsMock from "../../../game/audio/audioSettings";
import * as userSettingsMock from "../../../userSettings";

function makeWorld(overrides: Record<string, unknown> = {}) {
  return {
    playerHp: 80,
    playerHpMax: 100,
    basePlayerHpMax: 100,
    baseMoveSpeed: 300,
    pSpeed: 260,
    basePickupRadius: 0,
    pickupRadius: 0,
    maxArmor: 50,
    currentArmor: 0,
    momentumMax: 20,
    momentumValue: 0,
    dmgMult: 1,
    fireRateMult: 1,
    areaMult: 1,
    durationMult: 1,
    baseCritChance: 0.05,
    critChanceBonus: 0,
    critMultiplier: 1.5,
    gold: 10,
    kills: 2,
    relics: [],
    items: [],
    cards: [],
    combatCardIds: [],
    ...overrides,
  } as any;
}

describe("pauseMenu", () => {
  beforeEach(() => {
    const doc = new FakeDocument();
    (globalThis as any).document = doc;
    (globalThis as any).Event = FakeEvent;
    (globalThis as any).HTMLElement = FakeElement;
    (globalThis as any).HTMLDivElement = FakeElement;
    (globalThis as any).HTMLButtonElement = FakeElement;
    (globalThis as any).HTMLInputElement = FakeElement;
    (globalThis as any).HTMLTableElement = FakeElement;

    vi.mocked(audioSettingsMock.setMusicVolume).mockClear();
    vi.mocked(audioSettingsMock.setMusicMuted).mockClear();
    vi.mocked(audioSettingsMock.setSfxVolume).mockClear();
    vi.mocked(audioSettingsMock.setSfxMuted).mockClear();
    vi.mocked(audioSettingsMock.applySfxSettingsToWorld).mockClear();
    vi.mocked(userSettingsMock.updateUserSettings).mockClear();
    debugFlags.pauseDebugCards = false;
    debugFlags.pauseCsvControls = false;
    userSettingsState.settings = {
      debug: { pauseDebugCards: false, pauseCsvControls: false },
      game: { userModeEnabled: true, healthOrbSide: "left",
      gameSpeed: 1.0 },
      render: {
        entityShadowsDisable: false,
        entityAnchorsEnabled: false,
        renderPerfCountersEnabled: false,
        paletteSwapEnabled: false,
        paletteId: "db32",
        performanceMode: false,
        verticalTilesMode: "auto",
        verticalTilesUser: 9,
        verticalTilesAutoPhone: 6,
        verticalTilesAutoDesktop: 9,
        visibleVerticalTiles: 12,
        tileRenderRadius: 0,
        spawnBase: 1.0,
        spawnPerDepth: 1.12,
        hpBase: 1.0,
        hpPerDepth: 1.18,
        pressureAt0Sec: 0.8,
        pressureAt120Sec: 1.4,
      },
      audio: {
        masterVolume: 1,
        musicVolume: 0.6,
        sfxVolume: 1,
        musicMuted: false,
        sfxMuted: false,
      },
    };
  });

  test("renders pause panel structure", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);

    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);

    expect(root.querySelector(".pausePanel")).toBeTruthy();
    expect(root.querySelector(".pauseNavLayout")).toBeTruthy();
  });

  test("resume, quit, and dev tools buttons call actions", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);

    const onResume = vi.fn();
    const onQuitRun = vi.fn();
    const onOpenDevTools = vi.fn();
    userSettingsState.settings = {
      ...userSettingsState.settings,
      game: {
        userModeEnabled: false,
      },
    } as any;

    const menu = mountPauseMenu({ root, actions: { onResume, onQuitRun, onOpenDevTools } });
    menu.setVisible(true);

    (root.querySelector("[data-pause-resume]") as any).click();
    (root.querySelector("[data-pause-quit]") as any).click();
    expect(onQuitRun).toHaveBeenCalledTimes(0);
    (root.querySelector("[data-pause-quit-confirm]") as any).click();
    (root.querySelector("[data-pause-dev-tools]") as any).click();

    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onQuitRun).toHaveBeenCalledTimes(1);
    expect(onOpenDevTools).toHaveBeenCalledTimes(1);
  });

  test("setVisible(true) reapplies visibility if root gets hidden externally", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);
    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });

    menu.setVisible(true);
    expect((root as any).hidden).toBe(false);

    // Simulate syncUiForAppState forcing menu hidden between frames.
    (root as any).hidden = true;
    menu.setVisible(true);

    expect((root as any).hidden).toBe(false);
  });

  test("audio controls call setter functions", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);

    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);
    (root.querySelector('[data-settings-tab="AUDIO"]') as any).click();

    const musicSlider = root.querySelector("[data-audio-music-slider]") as any;
    const musicMute = root.querySelector("[data-audio-music-mute]") as any;
    const sfxSlider = root.querySelector("[data-audio-sfx-slider]") as any;
    const sfxMute = root.querySelector("[data-audio-sfx-mute]") as any;

    musicSlider.value = "0.25";
    musicSlider.dispatchEvent(new Event("input") as any);
    musicMute.click();

    sfxSlider.value = "0.4";
    sfxSlider.dispatchEvent(new Event("input") as any);
    sfxMute.click();

    expect(audioSettingsMock.setMusicVolume).toHaveBeenCalled();
    expect(audioSettingsMock.setMusicMuted).toHaveBeenCalled();
    expect(audioSettingsMock.setSfxVolume).toHaveBeenCalled();
    expect(audioSettingsMock.setSfxMuted).toHaveBeenCalled();
  });

  test("renders cards, relics, and no-cards fallback", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);

    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);

    menu.render(makeWorld());
    expect(root.textContent).toContain("No cards owned yet.");

    menu.render(
      makeWorld({
        cards: ["CARD_DAMAGE_FLAT_1", "CARD_DAMAGE_FLAT_1"],
        relics: ["PASS_MOVE_SPEED_20"],
      })
    );

    expect(root.textContent).toContain("+3 physical damage");
    expect(root.textContent).toContain("x2");
    expect(root.querySelector(".pauseOwnedCardRow")).toBeTruthy();
  });

  test("build panel shows laser weapon summary for JOEY", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);

    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);
    menu.render(makeWorld({ currentCharacterId: "JOEY" }));

    expect(root.textContent).toContain("Weapon: Laser");
    expect(root.textContent).toContain("Crit Multi1.75x");
  });

  test("build panel shows syringe weapon summary for HOBO", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);

    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);
    menu.render(makeWorld({ currentCharacterId: "HOBO" }));

    expect(root.textContent).toContain("Weapon: Syringe");
  });

  test("build panel shows shotgun weapon summary for TOMMY", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);

    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);
    menu.render(makeWorld({ currentCharacterId: "TOMMY" }));

    expect(root.textContent).toContain("Weapon: Shotgun");
  });

  test("build panel shows throwing knife weapon summary for JAMAL", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);

    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);
    menu.render(makeWorld({ currentCharacterId: "JAMAL" }));

    expect(root.textContent).toContain("Weapon: Throwing Knife");
  });

  test("render does not throw when world is null", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);
    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });

    expect(() => menu.render(null as any)).not.toThrow();
  });

  test("debug cards section is hidden while user mode is on", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);
    userSettingsState.settings = {
      ...userSettingsState.settings,
      game: { userModeEnabled: true, healthOrbSide: "left",
      gameSpeed: 1.0 },
    } as any;
    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);

    menu.render(makeWorld({ cards: ["CARD_DAMAGE_FLAT_1"] }));
    const debugSection = root.querySelector("[data-debug-cards-section]") as any;
    expect(debugSection).toBeTruthy();
    expect(debugSection.hidden).toBe(true);
  });

  test("debug cards section is visible while user mode is off", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);
    userSettingsState.settings = {
      ...userSettingsState.settings,
      game: { userModeEnabled: false, healthOrbSide: "left",
      gameSpeed: 1.0 },
    } as any;
    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);

    menu.render(makeWorld({ cards: ["CARD_DAMAGE_FLAT_1"] }));

    const debugSection = root.querySelector("[data-debug-cards-section]") as any;
    expect(debugSection).toBeTruthy();
    expect(debugSection.hidden).toBe(false);
    expect(root.textContent).toContain("Open Debug Cards Editor");
    expect(root.textContent).toContain("Open Debug Relics Editor");
  });

  test("debug cards apply immediately in editor layer", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);
    userSettingsState.settings = {
      ...userSettingsState.settings,
      game: { userModeEnabled: false, healthOrbSide: "left",
      gameSpeed: 1.0 },
    } as any;
    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);

    const world = makeWorld({ cards: [] });
    menu.render(world);

    const openBtn = root.querySelector("[data-debug-cards-open]") as any;
    expect(openBtn).toBeTruthy();
    openBtn.click();

    const layer = root.querySelector("[data-debug-layer]") as any;
    expect(layer).toBeTruthy();
    expect(layer.hidden).toBe(false);
    expect(root.textContent).toContain("Debug Cards Editor");
    expect(root.querySelector("[data-debug-cards-cancel]")).toBeTruthy();

    const plus = root.querySelector('[data-debug-card-add="CARD_DAMAGE_FLAT_1"]') as any;
    const minus = root.querySelector('[data-debug-card-remove="CARD_DAMAGE_FLAT_1"]') as any;
    expect(plus).toBeTruthy();
    expect(minus).toBeTruthy();

    plus.click();
    expect(world.cards.includes("CARD_DAMAGE_FLAT_1")).toBe(true);
    expect(root.textContent).toContain("x1");

    plus.click();
    plus.click();
    expect(root.textContent).toContain("x3");

    minus.click();
    expect(root.textContent).toContain("x2");

    minus.click();
    minus.click();
    minus.click();
    expect(root.textContent).toContain("x0");
    expect(() => minus.click()).not.toThrow();
  });

  test("debug card editor recomputes max HP and clamps current HP immediately", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);
    userSettingsState.settings = {
      ...userSettingsState.settings,
      game: { userModeEnabled: false, healthOrbSide: "left",
      gameSpeed: 1.0 },
    } as any;
    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);

    const world = makeWorld({ cards: [], playerHp: 80, playerHpMax: 100, basePlayerHpMax: 100 });
    menu.render(world);

    const openBtn = root.querySelector("[data-debug-cards-open]") as any;
    openBtn.click();

    const addBtn = root.querySelector('[data-debug-card-add="CARD_LIFE_3"]') as any;
    expect(addBtn).toBeTruthy();
    addBtn.click();
    expect(world.playerHpMax).toBe(175);
    expect(world.playerHp).toBe(155);

    const removeBtn = root.querySelector('[data-debug-card-remove="CARD_LIFE_3"]') as any;
    expect(removeBtn).toBeTruthy();
    removeBtn.click();
    expect(world.playerHpMax).toBe(100);
    expect(world.playerHp).toBe(100);
  });

  test("debug relic editor saves add/remove to world.relics", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);
    userSettingsState.settings = {
      ...userSettingsState.settings,
      game: { userModeEnabled: false, healthOrbSide: "left",
      gameSpeed: 1.0 },
    } as any;
    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);

    const world = makeWorld({ relics: [] });
    menu.render(world);

    const openBtn = root.querySelector("[data-debug-relics-open]") as any;
    expect(openBtn).toBeTruthy();
    openBtn.click();

    expect(root.textContent).toContain("Debug Relics Editor");

    const addBtn = root.querySelector('[data-debug-relic-add="PASS_MOVE_SPEED_20"]') as any;
    expect(addBtn).toBeTruthy();
    addBtn.click();
    expect(world.relics).toContain("PASS_MOVE_SPEED_20");

    const removeBtn = root.querySelector('[data-debug-relic-remove="PASS_MOVE_SPEED_20"]') as any;
    expect(removeBtn).toBeTruthy();
    removeBtn.click();
    expect(world.relics).not.toContain("PASS_MOVE_SPEED_20");
  });

  test("debug relic editor recomputes move speed immediately", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);
    userSettingsState.settings = {
      ...userSettingsState.settings,
      game: { userModeEnabled: false, healthOrbSide: "left",
      gameSpeed: 1.0 },
    } as any;
    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);

    const world = makeWorld({
      pSpeed: 300,
      baseMoveSpeed: 300,
      relics: [],
      items: [],
    });
    menu.render(world);
    expect(world.pSpeed).toBeCloseTo(300, 3);

    const openBtn = root.querySelector("[data-debug-relics-open]") as any;
    openBtn.click();

    const addBtn = root.querySelector('[data-debug-relic-add="PASS_MOVE_SPEED_20"]') as any;
    addBtn.click();
    expect(world.pSpeed).toBeCloseTo(360, 3);

    const removeBtn = root.querySelector('[data-debug-relic-remove="PASS_MOVE_SPEED_20"]') as any;
    removeBtn.click();
    expect(world.pSpeed).toBeCloseTo(300, 3);
  });

  test("performance mode toggle updates user settings", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);
    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);
    menu.render(makeWorld());

    (root.querySelector('[data-settings-tab="GRAPHICS"]') as any).click();
    const toggle = root.querySelector("[data-performance-mode-toggle]") as any;
    expect(toggle).toBeTruthy();

    toggle.checked = true;
    toggle.dispatchEvent(new Event("change") as any);
    expect(userSettingsMock.updateUserSettings).toHaveBeenCalledWith({ render: { performanceMode: true } });
  });

  test("vertical tiles slider updates user settings", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);
    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);
    menu.render(makeWorld());

    (root.querySelector('[data-settings-tab="GRAPHICS"]') as any).click();
    const slider = root.querySelector("[data-vertical-tiles-slider]") as any;
    expect(slider).toBeTruthy();

    slider.value = "16";
    slider.dispatchEvent(new Event("input") as any);
    expect(userSettingsMock.updateUserSettings).toHaveBeenCalledWith({ render: { verticalTilesAutoDesktop: 16 } });
  });

  test("vertical tiles mode manual stores user override", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);
    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);
    menu.render(makeWorld());

    (root.querySelector('[data-settings-tab="GRAPHICS"]') as any).click();
    const manualBtn = root.querySelector('[data-vertical-tiles-mode="manual"]') as any;
    const slider = root.querySelector("[data-vertical-tiles-slider]") as any;
    expect(manualBtn).toBeTruthy();
    expect(slider).toBeTruthy();

    manualBtn.click();
    expect(userSettingsMock.updateUserSettings).toHaveBeenCalledWith({
      render: {
        verticalTilesMode: "manual",
        verticalTilesUser: 9,
        visibleVerticalTiles: 9,
      },
    });

    slider.value = "14";
    slider.dispatchEvent(new Event("input") as any);
    expect(userSettingsMock.updateUserSettings).toHaveBeenCalledWith({
      render: {
        verticalTilesUser: 14,
        visibleVerticalTiles: 14,
      },
    });
  });

  test("game speed slider updates user settings", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);
    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);
    menu.render(makeWorld());

    (root.querySelector('[data-settings-tab="GAME"]') as any).click();
    const slider = root.querySelector("[data-game-speed-slider]") as any;
    expect(slider).toBeTruthy();

    slider.value = "1.25";
    slider.dispatchEvent(new Event("input") as any);
    expect(userSettingsMock.updateUserSettings).toHaveBeenCalledWith({ game: { gameSpeed: 1.25 } });
  });

  test("settings tabs switch visible panels", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);
    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);
    menu.render(makeWorld());

    const gamePanel = root.querySelector('[data-settings-panel="GAME"]') as any;
    const graphicsPanel = root.querySelector('[data-settings-panel="GRAPHICS"]') as any;
    const audioPanel = root.querySelector('[data-settings-panel="AUDIO"]') as any;
    const gameTab = root.querySelector('[data-settings-tab="GAME"]') as any;
    const graphicsTab = root.querySelector('[data-settings-tab="GRAPHICS"]') as any;
    const audioTab = root.querySelector('[data-settings-tab="AUDIO"]') as any;

    expect(gamePanel.hidden).toBe(false);
    expect(graphicsPanel.hidden).toBe(true);
    expect(audioPanel.hidden).toBe(true);

    graphicsTab.click();
    expect(gamePanel.hidden).toBe(true);
    expect(graphicsPanel.hidden).toBe(false);
    expect(audioPanel.hidden).toBe(true);

    audioTab.click();
    expect(gamePanel.hidden).toBe(true);
    expect(graphicsPanel.hidden).toBe(true);
    expect(audioPanel.hidden).toBe(false);

    gameTab.click();
    expect(gamePanel.hidden).toBe(false);
  });

  test("shows on-screen enemy HP in debug metrics", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);
    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);

    menu.render(
      makeWorld({
        spawnDirectorDebug: {
          actualDpsInstant: 0,
          actualDps: 0,
          expectedDps: 0,
          aheadFactor: 0,
          basePressure: 1,
          effectivePressure: 1,
          pressure: 1,
          waveMult: 1,
          queuedPerSecond: 0,
          pendingSpawns: 0,
          waveRemaining: 0,
          chunkCooldownSec: 0,
          waveCooldownSecLeft: 0,
          lastChunkSize: 0,
          pendingThresholdToStartWave: 0,
          powerPerSecond: 0,
          spawnHpPerSecond: 0,
          trashPowerCost: 1,
          powerBudget: 0,
          spawnsPerSecond: 0,
        },
        eAlive: [true, false, true],
        eHp: [10, 999, 5],
      })
    );

    expect(root.textContent).toContain("On-screen Enemy HP15");
  });

  test("debug metrics tabs switch visible metric groups", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);
    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);

    menu.render(
      makeWorld({
        spawnDirectorDebug: {
          actualDpsInstant: 1,
          actualDps: 2,
          expectedDps: 3,
          aheadFactor: 0.7,
          basePressure: 1,
          effectivePressure: 1,
          pressure: 1,
          waveMult: 1,
          queuedPerSecond: 0,
          pendingSpawns: 4,
          waveRemaining: 5,
          chunkCooldownSec: 0.1,
          waveCooldownSecLeft: 0.2,
          lastChunkSize: 2,
          pendingThresholdToStartWave: 6,
          powerPerSecond: 7,
          spawnHpPerSecond: 80,
          trashPowerCost: 1,
          powerBudget: 2,
          spawnsPerSecond: 1.2,
        },
      })
    );

    // Default tab: Spawn
    expect(root.textContent).toContain("Spawn HP Budget/sec80");
    expect(root.textContent).not.toContain("Actual DPS (inst)1.00");

    const combatTab = root.querySelector('[data-stats-debug-tab-id="COMBAT"]') as any;
    expect(combatTab).toBeTruthy();
    combatTab.click();
    expect(root.textContent).toContain("Actual DPS (inst)1.00");

    const flowTab = root.querySelector('[data-stats-debug-tab-id="FLOW"]') as any;
    expect(flowTab).toBeTruthy();
    flowTab.click();
    expect(root.textContent).toContain("Pending4");
  });

  test("spawn tuning reset button restores defaults", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);

    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);

    menu.render(makeWorld());
    const spawnSlider = root.querySelector("[data-spawn-rate-orb-slider]") as any;
    expect(spawnSlider).toBeTruthy();
    spawnSlider.value = "1.25";
    spawnSlider.dispatchEvent(new Event("input") as any);

    const resetBtn = root.querySelector(".pauseInlineAction") as any;
    expect(resetBtn).toBeTruthy();
    resetBtn.click();
    expect(userSettingsMock.updateUserSettings).toHaveBeenCalledWith({ render: { ...DEFAULT_SPAWN_TUNING } });
  });

  test("spawn tuning orb sliders persist to local settings and apply to world", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);

    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);

    const world = makeWorld({
      expectedPowerBudgetConfig: { basePowerPerSecond: 1.0 },
      balance: { spawnTuning: {} },
    });
    menu.render(world);

    const spawnSlider = root.querySelector("[data-spawn-rate-orb-slider]") as any;
    const healthOrbSlider = root.querySelector("[data-monster-health-orb-slider]") as any;
    const spawnBaseSlider = root.querySelector("[data-spawn-base-slider]") as any;
    const healthBaseSlider = root.querySelector("[data-monster-health-base-slider]") as any;
    const pressureT0Slider = root.querySelector("[data-pressure-t0-slider]") as any;
    const pressureT120Slider = root.querySelector("[data-pressure-t120-slider]") as any;
    expect(spawnSlider).toBeTruthy();
    expect(healthOrbSlider).toBeTruthy();
    expect(spawnBaseSlider).toBeTruthy();
    expect(healthBaseSlider).toBeTruthy();
    expect(pressureT0Slider).toBeTruthy();
    expect(pressureT120Slider).toBeTruthy();

    spawnSlider.value = "1.25";
    spawnSlider.dispatchEvent(new Event("input") as any);
    healthOrbSlider.value = "1.30";
    healthOrbSlider.dispatchEvent(new Event("input") as any);
    spawnBaseSlider.value = "1.40";
    spawnBaseSlider.dispatchEvent(new Event("input") as any);
    healthBaseSlider.value = "1.15";
    healthBaseSlider.dispatchEvent(new Event("input") as any);
    pressureT0Slider.value = "0.90";
    pressureT0Slider.dispatchEvent(new Event("input") as any);
    pressureT120Slider.value = "1.80";
    pressureT120Slider.dispatchEvent(new Event("input") as any);

    expect(userSettingsMock.updateUserSettings).toHaveBeenCalledWith({
      render: {
        spawnBase: 1.0,
        spawnPerDepth: 1.25,
        hpBase: 1.0,
        hpPerDepth: 1.18,
        pressureAt0Sec: 0.8,
        pressureAt120Sec: 1.4,
      },
    });
    expect(userSettingsMock.updateUserSettings).toHaveBeenCalledWith({
      render: {
        spawnBase: 1.0,
        spawnPerDepth: 1.25,
        hpBase: 1.0,
        hpPerDepth: 1.3,
        pressureAt0Sec: 0.8,
        pressureAt120Sec: 1.4,
      },
    });
    expect(userSettingsMock.updateUserSettings).toHaveBeenCalledWith({
      render: {
        spawnBase: 1.4,
        spawnPerDepth: 1.25,
        hpBase: 1.0,
        hpPerDepth: 1.3,
        pressureAt0Sec: 0.8,
        pressureAt120Sec: 1.4,
      },
    });
    expect(userSettingsMock.updateUserSettings).toHaveBeenCalledWith({
      render: {
        spawnBase: 1.4,
        spawnPerDepth: 1.25,
        hpBase: 1.15,
        hpPerDepth: 1.3,
        pressureAt0Sec: 0.8,
        pressureAt120Sec: 1.4,
      },
    });
    expect(userSettingsMock.updateUserSettings).toHaveBeenCalledWith({
      render: {
        spawnBase: 1.4,
        spawnPerDepth: 1.25,
        hpBase: 1.15,
        hpPerDepth: 1.3,
        pressureAt0Sec: 0.9,
        pressureAt120Sec: 1.4,
      },
    });
    expect(userSettingsMock.updateUserSettings).toHaveBeenCalledWith({
      render: {
        spawnBase: 1.4,
        spawnPerDepth: 1.25,
        hpBase: 1.15,
        hpPerDepth: 1.3,
        pressureAt0Sec: 0.9,
        pressureAt120Sec: 1.8,
      },
    });

    expect((world as any).balance.spawnTuning.spawnPerDepth).toBeCloseTo(1.25, 3);
    expect((world as any).balance.spawnTuning.hpPerDepth).toBeCloseTo(1.3, 3);
    expect((world as any).balance.spawnTuning.spawnBase).toBeCloseTo(1.4, 3);
    expect((world as any).balance.spawnTuning.hpBase).toBeCloseTo(1.15, 3);
    expect((world as any).balance.spawnTuning.pressureAt0Sec).toBeCloseTo(0.9, 3);
    expect((world as any).balance.spawnTuning.pressureAt120Sec).toBeCloseTo(1.8, 3);
  });
});
