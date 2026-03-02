import { beforeEach, describe, expect, test, vi } from "vitest";
import { createMobileControls } from "../../../ui/mobile/mobileControls";

type Listener = (ev: any) => void;

class FakeClassList {
  private classes = new Set<string>();
  add(name: string): void { this.classes.add(name); }
  remove(name: string): void { this.classes.delete(name); }
  contains(name: string): boolean { return this.classes.has(name); }
}

class FakeElement {
  hidden = false;
  style: Record<string, string> = {};
  classList = new FakeClassList();
  private listeners = new Map<string, Listener[]>();
  private rect = { left: 0, top: 0, width: 0, height: 0 };
  setPointerCapture = vi.fn();
  releasePointerCapture = vi.fn();

  addEventListener(type: string, listener: Listener): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(listener);
    this.listeners.set(type, arr);
  }

  removeEventListener(type: string, listener: Listener): void {
    const arr = this.listeners.get(type) ?? [];
    this.listeners.set(type, arr.filter((it) => it !== listener));
  }

  dispatchEvent(ev: any): void {
    const arr = this.listeners.get(ev.type) ?? [];
    for (let i = 0; i < arr.length; i++) arr[i](ev);
  }

  setRect(left: number, top: number, width: number, height: number): void {
    this.rect = { left, top, width, height };
  }

  getBoundingClientRect(): any {
    const { left, top, width, height } = this.rect;
    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON() {
        return {};
      },
    };
  }
}

function pointer(type: string, pointerId: number, clientX: number, clientY: number, target?: any, button = 0) {
  return {
    type,
    pointerId,
    clientX,
    clientY,
    target,
    button,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    composedPath: () => (target ? [target] : []),
  };
}

function contextMenuEvent(target?: any) {
  return {
    type: "contextmenu",
    target,
    preventDefault: vi.fn(),
  };
}

function buildFixture() {
  const root = new FakeElement();
  const stick = new FakeElement();
  const knob = new FakeElement();
  const interact = new FakeElement();
  stick.setRect(100, 100, 120, 120);
  knob.setRect(0, 0, 40, 40);
  return { root, stick, knob, interact };
}

describe("mobile controls", () => {
  beforeEach(() => {
    (globalThis as any).window = { innerWidth: 1000, innerHeight: 800 };
  });

  test("stick drag emits movement and resets on release", () => {
    const { root, stick, knob, interact } = buildFixture();
    const onMove = vi.fn();
    const onInteractDown = vi.fn();
    const controls = createMobileControls({
      root: root as any,
      stickBase: stick as any,
      stickKnob: knob as any,
      interactBtn: interact as any,
      onMove,
      onInteractDown,
    });
    controls.setEnabled(true);

    root.dispatchEvent(pointer("pointerdown", 1, 190, 160));
    expect(stick.classList.contains("isFloating")).toBe(true);
    expect(stick.style.left).toBe("130px");
    expect(stick.style.top).toBe("100px");
    expect(onMove).toHaveBeenLastCalledWith(expect.any(Number), expect.any(Number), true);
    expect(knob.style.transform).toContain("calc(-50%");

    root.dispatchEvent(pointer("pointermove", 1, 120, 120));
    expect(onMove).toHaveBeenLastCalledWith(expect.any(Number), expect.any(Number), true);

    root.dispatchEvent(pointer("pointerup", 1, 120, 120));
    expect(onMove).toHaveBeenLastCalledWith(0, 0, false);
    expect(knob.style.transform).toBe("translate(-50%, -50%)");
    expect(stick.classList.contains("isFloating")).toBe(false);
    expect(stick.style.left).toBe("");
    expect(stick.style.top).toBe("");
  });

  test("interact button emits down/up state", () => {
    const { root, stick, knob, interact } = buildFixture();
    const onMove = vi.fn();
    const onInteractDown = vi.fn();
    const controls = createMobileControls({
      root: root as any,
      stickBase: stick as any,
      stickKnob: knob as any,
      interactBtn: interact as any,
      onMove,
      onInteractDown,
    });
    controls.setEnabled(true);

    interact.dispatchEvent(pointer("pointerdown", 7, 10, 10));
    expect(onInteractDown).toHaveBeenLastCalledWith(true);
    expect(interact.classList.contains("isPressed")).toBe(true);

    interact.dispatchEvent(pointer("pointerup", 7, 10, 10));
    expect(onInteractDown).toHaveBeenLastCalledWith(false);
    expect(interact.classList.contains("isPressed")).toBe(false);
  });

  test("setEnabled(false) resets stick and interact state", () => {
    const { root, stick, knob, interact } = buildFixture();
    const onMove = vi.fn();
    const onInteractDown = vi.fn();
    const controls = createMobileControls({
      root: root as any,
      stickBase: stick as any,
      stickKnob: knob as any,
      interactBtn: interact as any,
      onMove,
      onInteractDown,
    });
    controls.setEnabled(true);
    root.dispatchEvent(pointer("pointerdown", 1, 190, 160));
    interact.dispatchEvent(pointer("pointerdown", 2, 20, 20));

    onMove.mockClear();
    onInteractDown.mockClear();
    controls.setEnabled(false);

    expect(root.hidden).toBe(true);
    expect(root.style.display).toBe("none");
    expect(root.style.pointerEvents).toBe("none");
    expect(onMove).toHaveBeenCalledWith(0, 0, false);
    expect(onInteractDown).toHaveBeenCalledWith(false);
    expect(knob.style.transform).toBe("translate(-50%, -50%)");
    expect(stick.classList.contains("isFloating")).toBe(false);
    expect(stick.style.left).toBe("");
    expect(stick.style.top).toBe("");
    expect(interact.classList.contains("isPressed")).toBe(false);
    expect(interact.releasePointerCapture).toHaveBeenCalledWith(2);
  });

  test("setEnabled(true) restores root visibility for mobile css", () => {
    const { root, stick, knob, interact } = buildFixture();
    const controls = createMobileControls({
      root: root as any,
      stickBase: stick as any,
      stickKnob: knob as any,
      interactBtn: interact as any,
      onMove: vi.fn(),
      onInteractDown: vi.fn(),
    });

    controls.setEnabled(true);
    expect(root.hidden).toBe(false);
    expect(root.style.display).toBe("");
    expect(root.style.pointerEvents).toBe("auto");
  });

  test("setEnabled(false) releases active stick pointer capture", () => {
    const { root, stick, knob, interact } = buildFixture();
    const controls = createMobileControls({
      root: root as any,
      stickBase: stick as any,
      stickKnob: knob as any,
      interactBtn: interact as any,
      onMove: vi.fn(),
      onInteractDown: vi.fn(),
    });
    controls.setEnabled(true);

    root.dispatchEvent(pointer("pointerdown", 11, 190, 160));
    expect(root.setPointerCapture).toHaveBeenCalledWith(11);

    controls.setEnabled(false);
    expect(root.releasePointerCapture).toHaveBeenCalledWith(11);
  });

  test("stick spawn clamps inside viewport bounds", () => {
    const { root, stick, knob, interact } = buildFixture();
    const onMove = vi.fn();
    const onInteractDown = vi.fn();
    const controls = createMobileControls({
      root: root as any,
      stickBase: stick as any,
      stickKnob: knob as any,
      interactBtn: interact as any,
      onMove,
      onInteractDown,
    });
    controls.setEnabled(true);

    (globalThis as any).window = { innerWidth: 220, innerHeight: 200 };
    root.dispatchEvent(pointer("pointerdown", 3, 5, 6));
    expect(stick.style.left).toBe("0px");
    expect(stick.style.top).toBe("0px");
  });

  test("interact press cancels active stick movement", () => {
    const { root, stick, knob, interact } = buildFixture();
    const onMove = vi.fn();
    const onInteractDown = vi.fn();
    const controls = createMobileControls({
      root: root as any,
      stickBase: stick as any,
      stickKnob: knob as any,
      interactBtn: interact as any,
      onMove,
      onInteractDown,
    });
    controls.setEnabled(true);
    onMove.mockClear();
    onInteractDown.mockClear();

    root.dispatchEvent(pointer("pointerdown", 1, 190, 160));
    expect(stick.classList.contains("isActive")).toBe(true);
    onMove.mockClear();

    const interactDown = pointer("pointerdown", 2, 10, 10, interact);
    interact.dispatchEvent(interactDown);

    expect(interactDown.stopPropagation).toHaveBeenCalled();
    expect(root.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(onMove).toHaveBeenCalledWith(0, 0, false);
    expect(onInteractDown).toHaveBeenLastCalledWith(true);
    expect(stick.classList.contains("isActive")).toBe(false);
    expect(stick.classList.contains("isFloating")).toBe(false);
    expect(knob.style.transform).toBe("translate(-50%, -50%)");

    onMove.mockClear();
    root.dispatchEvent(pointer("pointermove", 1, 160, 160));
    expect(onMove).not.toHaveBeenCalled();
  });

  test("stick handler ignores pointerdowns that originate from interact control", () => {
    const { root, stick, knob, interact } = buildFixture();
    const onMove = vi.fn();
    const onInteractDown = vi.fn();
    const controls = createMobileControls({
      root: root as any,
      stickBase: stick as any,
      stickKnob: knob as any,
      interactBtn: interact as any,
      onMove,
      onInteractDown,
    });
    controls.setEnabled(true);
    onMove.mockClear();

    root.dispatchEvent(pointer("pointerdown", 8, 40, 40, interact));
    expect(onMove).not.toHaveBeenCalled();
    expect(stick.classList.contains("isActive")).toBe(false);
  });

  test("secondary pointer button does not activate stick or interact", () => {
    const { root, stick, knob, interact } = buildFixture();
    const onMove = vi.fn();
    const onInteractDown = vi.fn();
    const controls = createMobileControls({
      root: root as any,
      stickBase: stick as any,
      stickKnob: knob as any,
      interactBtn: interact as any,
      onMove,
      onInteractDown,
    });
    controls.setEnabled(true);
    onMove.mockClear();
    onInteractDown.mockClear();

    const stickDown = pointer("pointerdown", 9, 100, 100, undefined, 2);
    root.dispatchEvent(stickDown);
    expect(stickDown.preventDefault).toHaveBeenCalled();
    expect(stick.classList.contains("isActive")).toBe(false);
    expect(onMove).not.toHaveBeenCalled();

    const interactDown = pointer("pointerdown", 10, 12, 12, interact, 2);
    interact.dispatchEvent(interactDown);
    expect(interactDown.preventDefault).toHaveBeenCalled();
    expect(onInteractDown).not.toHaveBeenCalled();
    expect(interact.classList.contains("isPressed")).toBe(false);
  });

  test("contextmenu is blocked while mobile controls are enabled", () => {
    const { root, stick, knob, interact } = buildFixture();
    const controls = createMobileControls({
      root: root as any,
      stickBase: stick as any,
      stickKnob: knob as any,
      interactBtn: interact as any,
      onMove: vi.fn(),
      onInteractDown: vi.fn(),
    });
    controls.setEnabled(true);

    const rootMenu = contextMenuEvent(root);
    root.dispatchEvent(rootMenu);
    expect(rootMenu.preventDefault).toHaveBeenCalled();

    const interactMenu = contextMenuEvent(interact);
    interact.dispatchEvent(interactMenu);
    expect(interactMenu.preventDefault).toHaveBeenCalled();
  });
});
