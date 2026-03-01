import { describe, expect, test, vi } from "vitest";
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

function pointer(type: string, pointerId: number, clientX: number, clientY: number) {
  return {
    type,
    pointerId,
    clientX,
    clientY,
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

    stick.dispatchEvent(pointer("pointerdown", 1, 190, 160));
    expect(onMove).toHaveBeenLastCalledWith(expect.any(Number), expect.any(Number), true);
    expect(knob.style.transform).toContain("calc(-50%");

    stick.dispatchEvent(pointer("pointermove", 1, 120, 120));
    expect(onMove).toHaveBeenLastCalledWith(expect.any(Number), expect.any(Number), true);

    stick.dispatchEvent(pointer("pointerup", 1, 120, 120));
    expect(onMove).toHaveBeenLastCalledWith(0, 0, false);
    expect(knob.style.transform).toBe("translate(-50%, -50%)");
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
    stick.dispatchEvent(pointer("pointerdown", 1, 190, 160));
    interact.dispatchEvent(pointer("pointerdown", 2, 20, 20));

    onMove.mockClear();
    onInteractDown.mockClear();
    controls.setEnabled(false);

    expect(root.hidden).toBe(true);
    expect(onMove).toHaveBeenCalledWith(0, 0, false);
    expect(onInteractDown).toHaveBeenCalledWith(false);
    expect(knob.style.transform).toBe("translate(-50%, -50%)");
    expect(interact.classList.contains("isPressed")).toBe(false);
  });
});
