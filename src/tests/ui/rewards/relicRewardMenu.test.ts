import { beforeEach, describe, expect, test, vi } from "vitest";

class FakeEvent {
  type: string;
  clientX: number;
  clientY: number;
  target: any;
  preventDefault = vi.fn();
  stopPropagation = vi.fn();
  constructor(type: string, init: Partial<FakeEvent> = {}) {
    this.type = type;
    this.clientX = init.clientX ?? 0;
    this.clientY = init.clientY ?? 0;
    this.target = init.target ?? null;
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

  removeEventListener(type: string, listener: Listener): void {
    const arr = this.listeners.get(type) ?? [];
    this.listeners.set(type, arr.filter((it) => it !== listener));
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

  contains(node: any): boolean {
    if (!node) return false;
    if (node === this) return true;
    for (const child of this.children) {
      if (child.contains(node)) return true;
    }
    return false;
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

import { mountRelicRewardMenu } from "../../../ui/rewards/relicRewardMenu";

describe("relicRewardMenu", () => {
  beforeEach(() => {
    const doc = new FakeDocument();
    (globalThis as any).document = doc;
    (globalThis as any).Event = FakeEvent;
    (globalThis as any).HTMLElement = FakeElement;
    vi.restoreAllMocks();
  });

  test("render active shows options", () => {
    const root = document.createElement("div") as unknown as HTMLElement;
    const menu = mountRelicRewardMenu({ root, onPick: vi.fn() });

    menu.render({
      active: true,
      source: "ZONE_TRIAL",
      options: ["PASS_DOT_MORE_50", "PASS_MAX_HP_20"],
    });

    expect((root as any).hidden).toBe(false);
    const buttons = (root as any).querySelectorAll("button") as any[];
    expect(buttons.length).toBe(2);
  });

  test("entry shield blocks immediate click and delayed click picks relic", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1000);
    const root = document.createElement("div") as unknown as HTMLElement;
    const onPick = vi.fn();
    const menu = mountRelicRewardMenu({ root, onPick });

    menu.render({
      active: true,
      source: "ZONE_TRIAL",
      options: ["PASS_DOT_MORE_50", "PASS_MAX_HP_20"],
    });

    const buttons = (root as any).querySelectorAll("button") as any[];
    expect(buttons.length).toBe(2);

    buttons[0].dispatchEvent(new FakeEvent("click", { clientX: 110, clientY: 130, target: buttons[0] }));
    expect(onPick).not.toHaveBeenCalled();

    nowSpy.mockReturnValue(1401);
    buttons[0].dispatchEvent(new FakeEvent("click", { clientX: 110, clientY: 130, target: buttons[0] }));
    expect(onPick).toHaveBeenCalledWith("PASS_DOT_MORE_50");
  });
});
