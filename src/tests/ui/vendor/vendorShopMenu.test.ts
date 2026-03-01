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
  type = "";
  disabled = false;
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

import { mountVendorShopMenu } from "../../../ui/vendor/vendorShopMenu";

describe("vendorShopMenu", () => {
  beforeEach(() => {
    const doc = new FakeDocument();
    (globalThis as any).document = doc;
    (globalThis as any).Event = FakeEvent;
    (globalThis as any).HTMLElement = FakeElement;
  });

  test("vendor card buttons include tier classes", () => {
    const root = document.createElement("div") as unknown as HTMLElement;
    const menu = mountVendorShopMenu({
      root,
      onBuy: vi.fn(),
      onBuyRelic: vi.fn(),
      onLeave: vi.fn(),
      onClose: vi.fn(),
    });

    menu.render({
      active: true,
      gold: 999,
      cards: [
        { cardId: "CARD_DAMAGE_FLAT_1", priceG: 50, purchased: false },
        { cardId: "CARD_DAMAGE_FLAT_2", priceG: 100, purchased: false },
        { cardId: "CARD_DAMAGE_FLAT_3", priceG: 150, purchased: false },
        { cardId: "CARD_FIRE_RATE_4", priceG: 200, purchased: false },
      ],
      relicOffers: [],
    });

    const buttons = (root as any).querySelectorAll("button") as any[];
    expect(buttons[0].className).toContain("tier-1");
    expect(buttons[1].className).toContain("tier-2");
    expect(buttons[2].className).toContain("tier-3");
    expect(buttons[3].className).toContain("tier-4");
  });
});
