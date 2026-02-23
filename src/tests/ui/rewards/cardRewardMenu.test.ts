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
  id = "";
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

  set textContent(v: string) {
    this.text = v ?? "";
  }

  get textContent(): string {
    return this.text + this.children.map((c) => c.textContent).join("");
  }

  set innerHTML(_v: string) {
    this.children = [];
    this.text = "";
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
      return this.find((node) => node.className.split(/\s+/).includes(cls));
    }
    if (selector.startsWith("#")) {
      const id = selector.slice(1);
      return this.find((node) => node.id === id);
    }
    return null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const out: FakeElement[] = [];
    if (selector === "button") {
      this.collect((node) => node.tagName === "BUTTON", out);
    }
    return out;
  }

  private find(pred: (node: FakeElement) => boolean): FakeElement | null {
    for (const child of this.children) {
      if (pred(child)) return child;
      const nested = child.find(pred);
      if (nested) return nested;
    }
    return null;
  }

  private collect(pred: (node: FakeElement) => boolean, out: FakeElement[]): void {
    for (const child of this.children) {
      if (pred(child)) out.push(child);
      child.collect(pred, out);
    }
  }
}

class FakeDocument {
  body = new FakeElement("body");
  createElement(tag: string): FakeElement {
    return new FakeElement(tag);
  }
}

import { mountCardRewardMenu } from "../../../ui/rewards/cardRewardMenu";

describe("cardRewardMenu", () => {
  beforeEach(() => {
    const doc = new FakeDocument();
    (globalThis as any).document = doc;
    (globalThis as any).Event = FakeEvent;
    (globalThis as any).HTMLElement = FakeElement;
  });

  test("render inactive hides root", () => {
    const root = document.createElement("div") as unknown as HTMLElement;
    const menu = mountCardRewardMenu({ root, onPick: vi.fn() });

    menu.render({ active: false, source: "ZONE_TRIAL", options: [] });
    expect((root as any).hidden).toBe(true);
  });

  test("render active shows options and click calls onPick", () => {
    const root = document.createElement("div") as unknown as HTMLElement;
    const onPick = vi.fn();
    const menu = mountCardRewardMenu({ root, onPick });

    menu.render({
      active: true,
      source: "BOSS_CHEST",
      options: ["CARD_DAMAGE_FLAT_1", "CARD_CONVERT_FIRE_1", "CARD_IGNITE_CHANCE_1"],
    });

    expect((root as any).hidden).toBe(false);
    const buttons = (root as any).querySelectorAll("button") as any[];
    expect(buttons.length).toBe(3);

    buttons[1].click();
    expect(onPick).toHaveBeenCalledWith("CARD_CONVERT_FIRE_1");
  });
});
