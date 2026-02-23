import { beforeEach, describe, expect, test, vi } from "vitest";

class FakeEvent {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
}

type Listener = (ev: FakeEvent) => void;

class FakeElement {
  tagName: string;
  hidden = false;
  className = "";
  dataset: Record<string, string> = {};
  type = "";
  text = "";
  children: FakeElement[] = [];
  parentNode: FakeElement | null = null;
  private listeners = new Map<string, Listener[]>();

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

  get firstChild(): FakeElement | null {
    return this.children[0] ?? null;
  }

  set textContent(v: string) {
    this.text = v;
  }

  get textContent(): string {
    return this.text + this.children.map((c) => c.textContent).join("");
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

  click(): void {
    const arr = this.listeners.get("click") ?? [];
    for (const listener of arr) listener(new FakeEvent("click"));
  }

  querySelector(selector: string): FakeElement | null {
    if (selector.startsWith(".")) {
      const cls = selector.slice(1);
      return this.find((n) => n.className.split(/\s+/).includes(cls));
    }

    const dataWithValue = selector.match(/^\[data-([a-z0-9-]+)=\"([^\"]+)\"\]$/i);
    if (dataWithValue) {
      const key = dataWithValue[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const val = dataWithValue[2];
      return this.find((n) => n.dataset[key] === val);
    }

    return null;
  }

  private find(pred: (node: FakeElement) => boolean): FakeElement | null {
    for (const child of this.children) {
      if (pred(child)) return child;
      const nested = child.find(pred);
      if (nested) return nested;
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

const debugFlags = vi.hoisted(() => ({ enabled: false }));

vi.mock("../../../userSettings", () => ({
  isPauseDebugCardsEnabled: vi.fn(() => debugFlags.enabled),
}));

import { mountPauseDebugCardsPanel } from "../../../ui/pause/pauseDebugCardsPanel";

describe("pauseDebugCardsPanel", () => {
  beforeEach(() => {
    const doc = new FakeDocument();
    (globalThis as any).document = doc;
    (globalThis as any).Event = FakeEvent;
    (globalThis as any).HTMLElement = FakeElement;
    (globalThis as any).HTMLDivElement = FakeElement;
    (globalThis as any).HTMLButtonElement = FakeElement;
    debugFlags.enabled = false;
  });

  test("renders nothing while debug flag is off", () => {
    const root = document.createElement("div") as unknown as HTMLElement;
    const world: any = { cards: [] };

    const panel = mountPauseDebugCardsPanel({ root, getWorld: () => world, onChange: vi.fn() });
    panel.render();

    expect(root.textContent).not.toContain("CARD_DAMAGE_FLAT_1");
    expect((root as any).hidden).toBe(true);
  });

  test("plus/minus edits draft and applies only on save", () => {
    const root = document.createElement("div") as unknown as HTMLElement;
    document.body.appendChild(root as any);
    const world: any = { cards: [] };
    const panel = mountPauseDebugCardsPanel({
      root,
      getWorld: () => world,
      onChange: () => panel.render(),
    });

    debugFlags.enabled = true;
    panel.render();
    expect(root.textContent).toContain("Edit Debug Cards");

    const toggle = root.querySelector("[data-debug-cards-toggle=\"1\"]") as any;
    expect(toggle).toBeTruthy();
    toggle.click();
    expect(root.textContent).toContain("CARD_DAMAGE_FLAT_1");

    const plus = root.querySelector('[data-debug-card-add="CARD_DAMAGE_FLAT_1"]') as any;
    const minus = root.querySelector('[data-debug-card-remove="CARD_DAMAGE_FLAT_1"]') as any;
    const save = root.querySelector('[data-debug-cards-save="1"]') as any;
    expect(plus).toBeTruthy();
    expect(minus).toBeTruthy();
    expect(save).toBeTruthy();

    plus.click();
    expect(world.cards).toEqual([]);
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

    save.click();
    expect(world.cards.length).toBe(0);

    plus.click();
    plus.click();
    save.click();
    expect(world.cards).toEqual(["CARD_DAMAGE_FLAT_1", "CARD_DAMAGE_FLAT_1"]);
  });
});
