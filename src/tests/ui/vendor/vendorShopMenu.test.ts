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

  dispatchEvent(ev: FakeEvent): boolean {
    const arr = this.listeners.get(ev.type) ?? [];
    for (const fn of arr) fn(ev);
    return true;
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
    const cardButtons = buttons.filter((b) => b.className.includes("vendorCard"));
    expect(cardButtons[0].className).toContain("tier-1");
    expect(cardButtons[1].className).toContain("tier-2");
    expect(cardButtons[2].className).toContain("tier-3");
    expect(cardButtons[3].className).toContain("tier-4");
  });

  test("switches to relic tab and keeps actions functional", () => {
    const onBuyRelic = vi.fn();
    const onLeave = vi.fn();
    const root = document.createElement("div") as unknown as HTMLElement;
    const menu = mountVendorShopMenu({
      root,
      onBuy: vi.fn(),
      onBuyRelic,
      onLeave,
      onClose: vi.fn(),
    });

    menu.render({
      active: true,
      gold: 999,
      cards: [{ cardId: "CARD_DAMAGE_FLAT_1", priceG: 50, purchased: false }],
      relicOffers: [{ relicId: "PASS_DOT_MORE_50", priceG: 300, isSold: false }],
    });

    const initialButtons = (root as any).querySelectorAll("button") as any[];
    const relicTab = initialButtons.find((b) => b.textContent === "Relics (1)");
    expect(relicTab).toBeTruthy();
    relicTab.dispatchEvent(new FakeEvent("click"));

    const afterTabButtons = (root as any).querySelectorAll("button") as any[];
    const relicBuyBtn = afterTabButtons.find((b) => b.dataset.relicIndex === "0");
    expect(relicBuyBtn).toBeTruthy();
    relicBuyBtn.dispatchEvent(new FakeEvent("click"));
    expect(onBuyRelic).toHaveBeenCalledWith(0);

    const leaveBtn = afterTabButtons.find((b) => b.textContent === "Leave");
    expect(leaveBtn).toBeTruthy();
    leaveBtn.dispatchEvent(new FakeEvent("click"));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
