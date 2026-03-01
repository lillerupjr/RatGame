import { beforeEach, describe, expect, test } from "vitest";
import {
  clearInputEdges,
  createInputState,
  inputSystem,
  setVirtualInteractDown,
  setVirtualMoveAxes,
} from "../../../../game/systems/sim/input";

type KeyListener = (ev: { type: string; key: string }) => void;

class FakeWindow {
  private listeners = new Map<string, KeyListener[]>();

  addEventListener(type: string, listener: KeyListener): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(listener);
    this.listeners.set(type, arr);
  }

  dispatchEvent(ev: { type: string; key: string }): void {
    const arr = this.listeners.get(ev.type) ?? [];
    for (let i = 0; i < arr.length; i++) arr[i](ev);
  }
}

function dispatchKey(type: "keydown" | "keyup", key: string): void {
  (globalThis as any).window.dispatchEvent({ type, key });
}

describe("virtual controls input composition", () => {
  beforeEach(() => {
    (globalThis as any).window = new FakeWindow();
  });

  test("virtual right axis sets right movement only", () => {
    const input = createInputState();
    setVirtualMoveAxes(input, 1, 0, true);
    inputSystem(input, {} as HTMLCanvasElement);

    expect(input.right).toBe(true);
    expect(input.left).toBe(false);
    expect(input.up).toBe(false);
    expect(input.down).toBe(false);
  });

  test("deadzone virtual axis does not move", () => {
    const input = createInputState();
    setVirtualMoveAxes(input, 0.1, -0.1, true);
    inputSystem(input, {} as HTMLCanvasElement);

    expect(input.left).toBe(false);
    expect(input.right).toBe(false);
    expect(input.up).toBe(false);
    expect(input.down).toBe(false);
  });

  test("keyboard and virtual movement combine via OR", () => {
    const input = createInputState();
    dispatchKey("keydown", "a");
    setVirtualMoveAxes(input, 1, 0, true);
    inputSystem(input, {} as HTMLCanvasElement);

    expect(input.left).toBe(true);
    expect(input.right).toBe(true);

    dispatchKey("keyup", "a");
  });

  test("virtual interact down emits one edge then holds", () => {
    const input = createInputState();

    setVirtualInteractDown(input, true);
    expect(input.interact).toBe(true);
    expect(input.interactPressed).toBe(true);

    clearInputEdges(input);
    inputSystem(input, {} as HTMLCanvasElement);
    expect(input.interact).toBe(true);
    expect(input.interactPressed).toBe(false);

    setVirtualInteractDown(input, true);
    expect(input.interactPressed).toBe(false);

    setVirtualInteractDown(input, false);
    expect(input.interact).toBe(false);
    expect(input.interactPressed).toBe(false);
  });

  test("virtual interact can edge trigger again after release", () => {
    const input = createInputState();
    setVirtualInteractDown(input, true);
    clearInputEdges(input);
    setVirtualInteractDown(input, false);

    setVirtualInteractDown(input, true);
    expect(input.interactPressed).toBe(true);
  });
});
