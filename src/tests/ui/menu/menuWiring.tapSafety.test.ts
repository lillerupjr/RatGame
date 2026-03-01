import { beforeEach, describe, expect, test, vi } from "vitest";
import { wireMenus } from "../../../ui/menuWiring";
import type { DomRefs } from "../../../ui/domRefs";

type Listener = (ev: FakeEvent) => void;

class FakeEvent {
  type: string;
  target: FakeElement | null;
  currentTarget: FakeElement | null = null;
  defaultPrevented = false;
  propagationStopped = false;
  constructor(type: string, target: FakeElement | null = null) {
    this.type = type;
    this.target = target;
  }
  preventDefault(): void {
    this.defaultPrevented = true;
  }
  stopPropagation(): void {
    this.propagationStopped = true;
  }
}

class FakePointerEvent extends FakeEvent {
  pointerId: number;
  button: number;
  clientX: number;
  clientY: number;
  constructor(
    type: string,
    opts: {
      target?: FakeElement | null;
      pointerId?: number;
      button?: number;
      clientX?: number;
      clientY?: number;
    } = {},
  ) {
    super(type, opts.target ?? null);
    this.pointerId = opts.pointerId ?? 1;
    this.button = opts.button ?? 0;
    this.clientX = opts.clientX ?? 0;
    this.clientY = opts.clientY ?? 0;
  }
}

class FakeMouseEvent extends FakeEvent {
  clientX: number;
  clientY: number;
  constructor(
    type: string,
    opts: {
      target?: FakeElement | null;
      clientX?: number;
      clientY?: number;
    } = {},
  ) {
    super(type, opts.target ?? null);
    this.clientX = opts.clientX ?? 0;
    this.clientY = opts.clientY ?? 0;
  }
}

class FakeElement {
  tagName: string;
  hidden = false;
  disabled = false;
  type = "";
  className = "";
  id = "";
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  attributes: Record<string, string> = {};
  private _text = "";
  children: FakeElement[] = [];
  parentNode: FakeElement | null = null;
  private listeners = new Map<string, Listener[]>();

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  set innerHTML(_v: string) {
    this.children = [];
    this._text = "";
  }

  set textContent(v: string) {
    this._text = v ?? "";
  }

  get textContent(): string {
    return this._text + this.children.map((c) => c.textContent).join("");
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
    if (name.startsWith("data-")) {
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (_m, g1: string) => g1.toUpperCase());
      this.dataset[key] = value;
    }
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type: string, listener: Listener): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(listener);
    this.listeners.set(type, arr);
  }

  dispatchEvent(ev: FakeEvent): boolean {
    if (!ev.target) ev.target = this;
    ev.currentTarget = this;
    const arr = this.listeners.get(ev.type) ?? [];
    for (const listener of [...arr]) listener(ev);
    return true;
  }

  contains(node: unknown): boolean {
    let cur = node as FakeElement | null;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const out: FakeElement[] = [];
    const dataWithValue = selector.match(/^button\[data-([a-z0-9-]+)="([^"]+)"\]$/i);
    const dataMatch = selector.match(/^button\[data-([a-z0-9-]+)\]$/i);
    const isButton = selector === "button";
    const key = (dataWithValue?.[1] ?? dataMatch?.[1] ?? "").replace(
      /-([a-z])/g,
      (_m, g1: string) => g1.toUpperCase(),
    );
    const value = dataWithValue?.[2];
    const match = (node: FakeElement): boolean => {
      if (isButton) return node.tagName === "BUTTON";
      if (!key) return false;
      if (node.tagName !== "BUTTON") return false;
      if (!(key in node.dataset)) return false;
      if (value == null) return true;
      return node.dataset[key] === value;
    };
    this.collect(match, out);
    return out;
  }

  private collect(match: (node: FakeElement) => boolean, out: FakeElement[]): void {
    for (const child of this.children) {
      if (match(child)) out.push(child);
      child.collect(match, out);
    }
  }
}

class FakeDocument {
  body = new FakeElement("body");
  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }
}

function createDomRefs(): DomRefs {
  const mkDiv = () => document.createElement("div") as unknown as HTMLDivElement;
  const mkBtn = () => document.createElement("button") as unknown as HTMLButtonElement;
  const refs = {
    welcomeScreen: mkDiv(),
    continueBtn: mkBtn(),
    mainMenuEl: mkDiv(),
    startRunBtn: mkBtn(),
    innkeeperBtn: mkBtn(),
    settingsBtn: mkBtn(),
    likeSubBtn: mkBtn(),
    characterSelectEl: mkDiv(),
    characterChoicesEl: mkDiv(),
    characterBackBtn: mkBtn(),
    characterContinueBtn: mkBtn(),
    mapMenuEl: mkDiv(),
    mapChoicesEl: mkDiv(),
    mapMenuSublineEl: mkDiv(),
    mapBackBtn: mkBtn(),
    mapContinueBtn: mkBtn(),
    innkeeperMenuEl: mkDiv(),
    innkeeperBackBtn: mkBtn(),
    settingsMenuEl: mkDiv(),
    mainSettingsHostEl: mkDiv(),
    settingsBackBtn: mkBtn(),
    creditsMenuEl: mkDiv(),
    creditsBackBtn: mkBtn(),
    menuEl: mkDiv(),
    startBtn: mkBtn(),
    weaponChoicesEl: mkDiv(),
    menuSublineEl: mkDiv(),
  } as Partial<DomRefs>;

  refs.mainMenuEl!.hidden = false;
  refs.characterSelectEl!.hidden = true;
  refs.mapMenuEl!.hidden = true;
  refs.characterContinueBtn!.disabled = true;

  return refs as DomRefs;
}

function tapElement(el: FakeElement, pointerId: number, x: number, y: number): void {
  el.dispatchEvent(new FakePointerEvent("pointerdown", { pointerId, button: 0, clientX: x, clientY: y, target: el }));
  el.dispatchEvent(new FakePointerEvent("pointerup", { pointerId, button: 0, clientX: x, clientY: y, target: el }));
}

describe("menuWiring tap safety", () => {
  beforeEach(() => {
    const doc = new FakeDocument();
    (globalThis as any).document = doc;
    (globalThis as any).Event = FakeEvent;
    (globalThis as any).PointerEvent = FakePointerEvent;
    (globalThis as any).MouseEvent = FakeMouseEvent;
    (globalThis as any).HTMLElement = FakeElement;
    (globalThis as any).HTMLDivElement = FakeElement;
    (globalThis as any).HTMLButtonElement = FakeElement;
    (globalThis as any).Node = FakeElement;
    (globalThis as any).window = { open: vi.fn() };
  });

  test("start-run tap does not ghost-select a character on next screen", () => {
    const refs = createDomRefs();
    wireMenus(refs, {
      previewMap: vi.fn(),
      startRun: vi.fn(),
      startDeterministicRun: vi.fn(),
      startSandboxRun: vi.fn(),
    });

    const startRunBtn = refs.startRunBtn as unknown as FakeElement;
    tapElement(startRunBtn, 1, 240, 420);
    expect(refs.mainMenuEl.hidden).toBe(true);
    expect(refs.characterSelectEl.hidden).toBe(false);

    const characterButtons = (refs.characterChoicesEl as unknown as FakeElement).querySelectorAll("button[data-character]");
    expect(characterButtons.length).toBeGreaterThan(0);
    const firstCharacterBtn = characterButtons[0];

    firstCharacterBtn.dispatchEvent(new FakeMouseEvent("click", { clientX: 240, clientY: 420, target: firstCharacterBtn }));
    expect(refs.characterContinueBtn.disabled).toBe(true);

    tapElement(firstCharacterBtn, 2, 260, 440);
    expect(refs.characterContinueBtn.disabled).toBe(false);
  });

  test("pointerup outside the pressed control does not activate", () => {
    const refs = createDomRefs();
    wireMenus(refs, {
      previewMap: vi.fn(),
      startRun: vi.fn(),
      startDeterministicRun: vi.fn(),
      startSandboxRun: vi.fn(),
    });

    const startRunBtn = refs.startRunBtn as unknown as FakeElement;
    startRunBtn.dispatchEvent(
      new FakePointerEvent("pointerdown", { pointerId: 7, button: 0, clientX: 100, clientY: 220, target: startRunBtn }),
    );
    startRunBtn.dispatchEvent(
      new FakePointerEvent("pointerup", {
        pointerId: 7,
        button: 0,
        clientX: 500,
        clientY: 700,
        target: refs.mainMenuEl as unknown as FakeElement,
      }),
    );

    expect(refs.mainMenuEl.hidden).toBe(false);
    expect(refs.characterSelectEl.hidden).toBe(true);
  });

  test("mouse click still triggers action once without pointer events", () => {
    const refs = createDomRefs();
    wireMenus(refs, {
      previewMap: vi.fn(),
      startRun: vi.fn(),
      startDeterministicRun: vi.fn(),
      startSandboxRun: vi.fn(),
    });

    const startRunBtn = refs.startRunBtn as unknown as FakeElement;
    startRunBtn.dispatchEvent(new FakeMouseEvent("click", { clientX: 40, clientY: 50, target: startRunBtn }));

    expect(refs.mainMenuEl.hidden).toBe(true);
    expect(refs.characterSelectEl.hidden).toBe(false);
    expect(refs.characterContinueBtn.disabled).toBe(true);
  });
});
