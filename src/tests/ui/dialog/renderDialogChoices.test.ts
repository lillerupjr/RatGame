import { beforeEach, describe, expect, test, vi } from "vitest";
import { renderDialogChoices } from "../../../ui/dialog/renderDialogChoices";

class FakeEvent {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
}

type Listener = (ev: FakeEvent) => void;

class FakeElement {
  tagName: string;
  className = "";
  text = "";
  type = "";
  children: FakeElement[] = [];
  private listeners = new Map<string, Listener[]>();

  constructor(tag: string) {
    this.tagName = tag.toUpperCase();
  }

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  set innerHTML(_v: string) {
    this.children = [];
    this.text = "";
  }

  set textContent(v: string) {
    this.text = v ?? "";
  }

  get textContent(): string {
    return this.text + this.children.map((c) => c.textContent).join("");
  }

  addEventListener(type: string, fn: Listener): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(fn);
    this.listeners.set(type, arr);
  }

  dispatchEvent(ev: FakeEvent): boolean {
    const arr = this.listeners.get(ev.type) ?? [];
    for (const fn of arr) fn(ev);
    return true;
  }
}

class FakeDocument {
  createElement(tag: string): FakeElement {
    return new FakeElement(tag);
  }
}

describe("renderDialogChoices", () => {
  beforeEach(() => {
    (globalThis as any).document = new FakeDocument();
    (globalThis as any).HTMLElement = FakeElement;
    (globalThis as any).Event = FakeEvent;
  });

  test("renders active class and triggers callbacks on click", () => {
    const root = new FakeElement("div") as unknown as HTMLElement;
    const onYes = vi.fn();
    const onNo = vi.fn();

    renderDialogChoices(root, [
      { label: "Yes", active: true, onSelect: onYes },
      { label: "No", active: false, onSelect: onNo },
    ]);

    const buttons = (root as any).children as FakeElement[];
    expect(buttons).toHaveLength(2);
    expect(buttons[0].className).toBe("dialogChoice active");
    expect(buttons[1].className).toBe("dialogChoice");

    buttons[0].dispatchEvent(new FakeEvent("click"));
    buttons[1].dispatchEvent(new FakeEvent("click"));
    expect(onYes).toHaveBeenCalledTimes(1);
    expect(onNo).toHaveBeenCalledTimes(1);
  });
});
