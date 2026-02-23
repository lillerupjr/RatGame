import { beforeEach, describe, expect, test, vi } from "vitest";

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

  private _text = "";
  private listeners = new Map<string, Listener[]>();

  children: FakeElement[] = [];
  parentNode: FakeElement | null = null;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentNode = this;
    this.children.push(child);
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
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[key] = value;
    }
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
    this.dispatchEvent(new FakeEvent("click"));
  }

  querySelector(selector: string): FakeElement | null {
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

  private find(pred: (node: FakeElement) => boolean): FakeElement | null {
    for (const child of this.children) {
      if (pred(child)) return child;
      const inner = child.find(pred);
      if (inner) return inner;
    }
    return null;
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

import { mountPauseMenu } from "../../../ui/pause/pauseMenu";
import * as audioSettingsMock from "../../../game/audio/audioSettings";

function makeWorld(overrides: Record<string, unknown> = {}) {
  return {
    playerHp: 80,
    playerHpMax: 100,
    pSpeed: 260,
    dmgMult: 1,
    fireRateMult: 1,
    baseCritChance: 0.05,
    critChanceBonus: 0,
    critMultiplier: 1.5,
    gold: 10,
    kills: 2,
    relics: [],
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
  });

  test("renders pause panel structure", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);

    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);

    expect(root.querySelector(".pausePanel")).toBeTruthy();
    expect(root.querySelector(".pauseGrid")).toBeTruthy();
  });

  test("resume and quit buttons call actions", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);

    const onResume = vi.fn();
    const onQuitRun = vi.fn();
    const menu = mountPauseMenu({ root, actions: { onResume, onQuitRun } });
    menu.setVisible(true);

    (root.querySelector("[data-pause-resume]") as any).click();
    (root.querySelector("[data-pause-quit]") as any).click();

    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onQuitRun).toHaveBeenCalledTimes(1);
  });

  test("audio controls call setter functions", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);

    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });
    menu.setVisible(true);

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
    expect(root.textContent).toContain("No cards yet");

    menu.render(
      makeWorld({
        cards: ["CARD_DAMAGE_FLAT_1", "CARD_DAMAGE_FLAT_1"],
        relics: ["RELIC_ALPHA"],
      })
    );

    expect(root.textContent).toContain("CARD_DAMAGE_FLAT_1");
    expect(root.textContent).toContain("x2");
    expect(root.textContent).toContain("RELIC_ALPHA");
    expect(root.querySelector(".pauseCardTile")).toBeTruthy();
  });

  test("render does not throw when world is null", () => {
    const root = document.createElement("div") as unknown as HTMLDivElement;
    document.body.appendChild(root as any);
    const menu = mountPauseMenu({ root, actions: { onResume: vi.fn(), onQuitRun: vi.fn() } });

    expect(() => menu.render(null as any)).not.toThrow();
  });
});
