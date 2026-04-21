import { beforeEach, describe, expect, test, vi } from "vitest";
const paletteSnapshotStorageState = vi.hoisted(() => ({
  records: [] as Array<{
    id: string;
    metadata: { id: string; version: number; createdAt: number; name: string };
    sceneContext: { mapId?: string; biomeId?: string };
    cameraState: { cameraX: number; cameraY: number; cameraZoom: number };
    worldState: Record<string, unknown>;
    thumbnail: Blob;
  }>,
}));
vi.mock("../../../game/paletteLab/snapshotStorage", () => ({
  listPaletteSnapshotRecords: vi.fn(async () => paletteSnapshotStorageState.records),
  renamePaletteSnapshotRecord: vi.fn(async (id: string, nextName: string) => {
    const record = paletteSnapshotStorageState.records.find((item) => item.id === id);
    if (!record) throw new Error(`Snapshot "${id}" not found`);
    const normalizedName = nextName.trim();
    if (!normalizedName) throw new Error("Palette snapshot name cannot be empty.");
    record.metadata = { ...record.metadata, name: normalizedName };
    return record;
  }),
  deletePaletteSnapshotRecord: vi.fn(async (id: string) => {
    const before = paletteSnapshotStorageState.records.length;
    paletteSnapshotStorageState.records = paletteSnapshotStorageState.records.filter((item) => item.id !== id);
    return paletteSnapshotStorageState.records.length !== before;
  }),
}));
import { wireMenus } from "../../../ui/menuWiring";
import type { DomRefs } from "../../../ui/domRefs";
import { updateUserSettings } from "../../../userSettings";
import {
  deletePaletteSnapshotRecord,
  listPaletteSnapshotRecords,
  renamePaletteSnapshotRecord,
} from "../../../game/paletteLab/snapshotStorage";

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

class FakeKeyboardEvent extends FakeEvent {
  key: string;
  constructor(type: string, opts: { key?: string; target?: FakeElement | null } = {}) {
    super(type, opts.target ?? null);
    this.key = opts.key ?? "";
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

  removeChild(child: FakeElement): FakeElement {
    const idx = this.children.indexOf(child);
    if (idx >= 0) this.children.splice(idx, 1);
    child.parentNode = null;
    return child;
  }

  get firstChild(): FakeElement | null {
    return this.children[0] ?? null;
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
  private listeners = new Map<string, Listener[]>();
  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }
  addEventListener(type: string, listener: Listener): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(listener);
    this.listeners.set(type, arr);
  }
  dispatchEvent(ev: FakeEvent): boolean {
    const arr = this.listeners.get(ev.type) ?? [];
    for (const listener of [...arr]) listener(ev);
    return true;
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
    paletteLabBtn: mkBtn(),
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
    paletteLabMenuEl: mkDiv(),
    paletteLabSublineEl: mkDiv(),
    paletteLabSnapshotGridEl: mkDiv(),
    paletteLabBackBtn: mkBtn(),
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
  refs.paletteLabMenuEl!.hidden = true;
  refs.characterContinueBtn!.disabled = true;

  return refs as DomRefs;
}

function tapElement(el: FakeElement, pointerId: number, x: number, y: number): void {
  el.dispatchEvent(new FakePointerEvent("pointerdown", { pointerId, button: 0, clientX: x, clientY: y, target: el }));
  el.dispatchEvent(new FakePointerEvent("pointerup", { pointerId, button: 0, clientX: x, clientY: y, target: el }));
}

async function flushUiTasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function findByData(root: FakeElement, key: string, value?: string): FakeElement | null {
  const match = value == null
    ? (key in root.dataset)
    : (root.dataset[key] === value);
  if (match) return root;
  for (const child of root.children) {
    const found = findByData(child, key, value);
    if (found) return found;
  }
  return null;
}

function createGameApiMock() {
  return {
    previewMap: vi.fn(),
    reloadCurrentMapForDebug: vi.fn(),
    startRun: vi.fn(),
    startDeterministicRun: vi.fn(),
    startSandboxRun: vi.fn(),
    openPaletteSnapshot: vi.fn(async () => undefined),
  };
}

describe("menuWiring tap safety", () => {
  beforeEach(() => {
    const doc = new FakeDocument();
    (globalThis as any).document = doc;
    (globalThis as any).Event = FakeEvent;
    (globalThis as any).PointerEvent = FakePointerEvent;
    (globalThis as any).MouseEvent = FakeMouseEvent;
    (globalThis as any).KeyboardEvent = FakeKeyboardEvent;
    (globalThis as any).HTMLElement = FakeElement;
    (globalThis as any).HTMLDivElement = FakeElement;
    (globalThis as any).HTMLButtonElement = FakeElement;
    (globalThis as any).Node = FakeElement;
    (globalThis as any).window = {
      open: vi.fn(),
      prompt: vi.fn(),
      confirm: vi.fn(),
    };
    updateUserSettings({ game: { userModeEnabled: true } });
    paletteSnapshotStorageState.records = [];
    vi.mocked(listPaletteSnapshotRecords).mockClear();
    vi.mocked(renamePaletteSnapshotRecord).mockClear();
    vi.mocked(deletePaletteSnapshotRecord).mockClear();
  });

  test("start-run tap does not ghost-select a character on next screen", () => {
    const refs = createDomRefs();
    wireMenus(refs, createGameApiMock());

    const startRunBtn = refs.startRunBtn as unknown as FakeElement;
    tapElement(startRunBtn, 1, 240, 420);
    expect(refs.mainMenuEl.hidden).toBe(true);
    expect(refs.characterSelectEl.hidden).toBe(false);

    const characterButtons = (refs.characterChoicesEl as unknown as FakeElement).querySelectorAll("button[data-character]");
    expect(characterButtons.length).toBeGreaterThan(0);
    const firstCharacterBtn = characterButtons[0];
    const starterModal = findByData(refs.characterSelectEl as unknown as FakeElement, "characterStarterModal");
    expect(starterModal).toBeTruthy();
    expect(starterModal?.hidden).toBe(true);

    firstCharacterBtn.dispatchEvent(new FakeMouseEvent("click", { clientX: 240, clientY: 420, target: firstCharacterBtn }));
    expect(refs.characterContinueBtn.disabled).toBe(true);
    expect(starterModal?.hidden).toBe(true);

    tapElement(firstCharacterBtn, 2, 260, 440);
    expect(refs.characterContinueBtn.disabled).toBe(false);
    expect(starterModal?.hidden).toBe(false);
  });

  test("starter modal closes via close button and backdrop tap", () => {
    const refs = createDomRefs();
    wireMenus(refs, createGameApiMock());

    tapElement(refs.startRunBtn as unknown as FakeElement, 1, 240, 420);
    const characterButtons = (refs.characterChoicesEl as unknown as FakeElement).querySelectorAll("button[data-character]");
    const firstCharacterBtn = characterButtons[0];
    tapElement(firstCharacterBtn, 2, 260, 440);

    const modal = findByData(refs.characterSelectEl as unknown as FakeElement, "characterStarterModal");
    expect(modal).toBeTruthy();
    expect(modal?.hidden).toBe(false);

    const selectBtn = findByData(refs.characterSelectEl as unknown as FakeElement, "characterStarterSelect");
    expect(selectBtn).toBeTruthy();
    selectBtn?.dispatchEvent(new FakeMouseEvent("click", { target: selectBtn }));
    expect(modal?.hidden).toBe(true);
    expect(refs.characterContinueBtn.disabled).toBe(false);

    tapElement(firstCharacterBtn, 4, 280, 440);
    expect(modal?.hidden).toBe(false);

    const closeBtn = findByData(refs.characterSelectEl as unknown as FakeElement, "characterStarterClose");
    expect(closeBtn).toBeTruthy();
    closeBtn?.dispatchEvent(new FakeMouseEvent("click", { target: closeBtn }));
    expect(modal?.hidden).toBe(true);

    tapElement(firstCharacterBtn, 3, 280, 440);
    expect(modal?.hidden).toBe(false);
    modal?.dispatchEvent(new FakeMouseEvent("click", { target: modal }));
    expect(modal?.hidden).toBe(true);
  });

  test("starter modal closes with Escape and keeps selection active", () => {
    const refs = createDomRefs();
    wireMenus(refs, createGameApiMock());

    tapElement(refs.startRunBtn as unknown as FakeElement, 1, 240, 420);
    const characterButtons = (refs.characterChoicesEl as unknown as FakeElement).querySelectorAll("button[data-character]");
    const firstCharacterBtn = characterButtons[0];
    tapElement(firstCharacterBtn, 2, 260, 440);

    const modal = findByData(refs.characterSelectEl as unknown as FakeElement, "characterStarterModal");
    expect(modal?.hidden).toBe(false);

    (globalThis as any).document.dispatchEvent(new FakeKeyboardEvent("keydown", { key: "Escape" }));
    expect(modal?.hidden).toBe(true);
    expect(refs.characterContinueBtn.disabled).toBe(false);
  });

  test("pointerup outside the pressed control does not activate", () => {
    const refs = createDomRefs();
    wireMenus(refs, createGameApiMock());

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
    wireMenus(refs, createGameApiMock());

    const startRunBtn = refs.startRunBtn as unknown as FakeElement;
    startRunBtn.dispatchEvent(new FakeMouseEvent("click", { clientX: 40, clientY: 50, target: startRunBtn }));

    expect(refs.mainMenuEl.hidden).toBe(true);
    expect(refs.characterSelectEl.hidden).toBe(false);
    expect(refs.characterContinueBtn.disabled).toBe(true);
  });

  test("dev PATH SELECT opens deterministic flow and launches deterministic run", () => {
    const refs = createDomRefs();
    const game = createGameApiMock();
    updateUserSettings({ game: { userModeEnabled: false } });
    wireMenus(refs, game);

    const pathSelectBtn = findByData(refs.mainMenuEl as unknown as FakeElement, "pathSelectDebug");
    expect(pathSelectBtn).toBeTruthy();

    tapElement(pathSelectBtn as FakeElement, 1, 220, 300);
    expect(refs.mainMenuEl.hidden).toBe(true);
    expect(refs.characterSelectEl.hidden).toBe(false);

    const characterButtons = (refs.characterChoicesEl as unknown as FakeElement).querySelectorAll("button[data-character]");
    expect(characterButtons.length).toBeGreaterThan(0);
    const firstCharacterBtn = characterButtons[0];
    tapElement(firstCharacterBtn, 2, 260, 440);

    const starterSelectBtn = findByData(refs.characterSelectEl as unknown as FakeElement, "characterStarterSelect");
    expect(starterSelectBtn).toBeTruthy();
    tapElement(starterSelectBtn as FakeElement, 3, 280, 460);

    expect(game.startDeterministicRun).toHaveBeenCalledTimes(1);
    expect(game.startRun).not.toHaveBeenCalled();
    expect(game.startSandboxRun).not.toHaveBeenCalled();
  });

  test("palette lab opens from main menu and renders snapshot tiles", async () => {
    paletteSnapshotStorageState.records = [
      {
        id: "snap-1",
        metadata: { id: "snap-1", version: 1, createdAt: 100, name: "Avenue - 2026-03-13 18:32" },
        sceneContext: { mapId: "avenue", biomeId: "sewers" },
        cameraState: { cameraX: 0, cameraY: 0, cameraZoom: 1 },
        worldState: {},
        thumbnail: new Blob(["thumb"], { type: "image/jpeg" }),
      },
    ];

    const refs = createDomRefs();
    updateUserSettings({ game: { userModeEnabled: false } });
    wireMenus(refs, createGameApiMock());
    tapElement(refs.paletteLabBtn as unknown as FakeElement, 1, 220, 300);
    await flushUiTasks();

    expect(vi.mocked(listPaletteSnapshotRecords)).toHaveBeenCalledTimes(1);
    expect(refs.mainMenuEl.hidden).toBe(true);
    expect(refs.paletteLabMenuEl.hidden).toBe(false);
    expect(refs.paletteLabSublineEl.textContent).toContain("Saved palette snapshots: 1");
    expect(refs.paletteLabSnapshotGridEl.textContent).toContain("Avenue - 2026-03-13 18:32");
    expect(refs.paletteLabSnapshotGridEl.textContent).toContain("Avenue");
    expect(refs.paletteLabSnapshotGridEl.textContent).toContain("Sewers");
  });

  test("palette lab snapshot tile actions support open, rename, and confirmed delete", async () => {
    paletteSnapshotStorageState.records = [
      {
        id: "snap-1",
        metadata: { id: "snap-1", version: 1, createdAt: 100, name: "Snapshot One" },
        sceneContext: { mapId: "avenue", biomeId: "sewers" },
        cameraState: { cameraX: 0, cameraY: 0, cameraZoom: 1 },
        worldState: {},
        thumbnail: new Blob(["thumb"], { type: "image/jpeg" }),
      },
    ];

    const refs = createDomRefs();
    const game = createGameApiMock();
    updateUserSettings({ game: { userModeEnabled: false } });
    const win = (globalThis as any).window;
    vi.mocked(win.prompt).mockReturnValue("Snapshot Renamed");
    vi.mocked(win.confirm).mockReturnValue(false);

    wireMenus(refs, game);
    tapElement(refs.paletteLabBtn as unknown as FakeElement, 1, 220, 300);
    await flushUiTasks();

    const grid = refs.paletteLabSnapshotGridEl as unknown as FakeElement;
    const openBtn = grid.querySelectorAll("button[data-palette-snapshot-action=\"open\"]")[0];
    const sheetButtons = grid.querySelectorAll("button[data-palette-snapshot-action=\"sheet\"]");
    const renameBtn = grid.querySelectorAll("button[data-palette-snapshot-action=\"rename\"]")[0];
    const deleteBtn = grid.querySelectorAll("button[data-palette-snapshot-action=\"delete\"]")[0];
    expect(openBtn).toBeTruthy();
    expect(sheetButtons).toHaveLength(0);
    expect(renameBtn).toBeTruthy();
    expect(deleteBtn).toBeTruthy();

    tapElement(openBtn, 2, 230, 320);
    expect(game.openPaletteSnapshot).toHaveBeenCalledWith("snap-1");

    tapElement(renameBtn, 3, 250, 340);
    await flushUiTasks();
    expect(vi.mocked(renamePaletteSnapshotRecord)).toHaveBeenCalledWith("snap-1", "Snapshot Renamed");
    expect(refs.paletteLabSnapshotGridEl.textContent).toContain("Snapshot Renamed");

    tapElement(deleteBtn, 4, 260, 350);
    await flushUiTasks();
    expect(vi.mocked(deletePaletteSnapshotRecord)).not.toHaveBeenCalled();
    expect(paletteSnapshotStorageState.records).toHaveLength(1);

    vi.mocked(win.confirm).mockReturnValue(true);
    const deleteBtnAfterRename =
      (refs.paletteLabSnapshotGridEl as unknown as FakeElement)
        .querySelectorAll("button[data-palette-snapshot-action=\"delete\"]")[0];
    tapElement(deleteBtnAfterRename, 5, 270, 360);
    await flushUiTasks();
    expect(vi.mocked(deletePaletteSnapshotRecord)).toHaveBeenCalledWith("snap-1");
    expect(paletteSnapshotStorageState.records).toHaveLength(0);
    expect(refs.paletteLabSnapshotGridEl.textContent).toContain("No palette snapshots saved yet.");
  });

  test("palette lab shows a graceful error when snapshot open fails", async () => {
    paletteSnapshotStorageState.records = [
      {
        id: "snap-missing-map",
        metadata: { id: "snap-missing-map", version: 1, createdAt: 100, name: "Missing Map Snapshot" },
        sceneContext: { mapId: "missing_map", biomeId: "sewers" },
        cameraState: { cameraX: 0, cameraY: 0, cameraZoom: 1 },
        worldState: {},
        thumbnail: new Blob(["thumb"], { type: "image/jpeg" }),
      },
    ];

    const refs = createDomRefs();
    const game = createGameApiMock();
    updateUserSettings({ game: { userModeEnabled: false } });
    game.openPaletteSnapshot.mockRejectedValueOnce(
      new Error('Snapshot "Missing Map Snapshot" references map "missing_map" that is unavailable in this build.'),
    );

    wireMenus(refs, game);
    tapElement(refs.paletteLabBtn as unknown as FakeElement, 1, 220, 300);
    await flushUiTasks();

    const openBtn =
      (refs.paletteLabSnapshotGridEl as unknown as FakeElement)
        .querySelectorAll("button[data-palette-snapshot-action=\"open\"]")[0];
    tapElement(openBtn, 2, 230, 320);
    await flushUiTasks();

    expect(refs.paletteLabSublineEl.textContent).toContain("references map \"missing_map\"");
  });
});
