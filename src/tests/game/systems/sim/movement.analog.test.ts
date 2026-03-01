import { describe, expect, test } from "vitest";
import { resolvePlayerMoveIntent } from "../../../../game/systems/sim/movement";
import type { InputState } from "../../../../game/systems/sim/input";

function baseInput(): InputState {
  return {
    moveX: 0,
    moveY: 0,
    moveMag: 0,
    up: false,
    down: false,
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    interact: false,
    interactPressed: false,
  };
}

describe("resolvePlayerMoveIntent", () => {
  test("uses analog direction and variable magnitude", () => {
    const input = baseInput();
    input.moveX = 0.8;
    input.moveY = 0.6;
    input.moveMag = 0.5;

    const out = resolvePlayerMoveIntent(input);
    expect(out.gdx).toBeCloseTo(0.8, 4);
    expect(out.gdy).toBeCloseTo(0.6, 4);
    expect(out.gmag).toBeCloseTo(0.5, 4);
  });

  test("returns zero movement near zero analog", () => {
    const input = baseInput();
    input.moveX = 0;
    input.moveY = 0;
    input.moveMag = 0.01;
    const out = resolvePlayerMoveIntent(input);
    expect(out).toEqual({ gdx: 0, gdy: 0, gmag: 0 });
  });

  test("full analog magnitude matches max-speed scalar", () => {
    const input = baseInput();
    input.moveX = 1;
    input.moveY = 0;
    input.moveMag = 1;
    const out = resolvePlayerMoveIntent(input);
    expect(out).toEqual({ gdx: 1, gdy: 0, gmag: 1 });
  });

  test("falls back to digital booleans when analog fields are zero", () => {
    const input = baseInput();
    input.right = true;
    input.up = true;
    const out = resolvePlayerMoveIntent(input);
    expect(out.gmag).toBe(1);
    expect(out.gdx).toBeCloseTo(Math.SQRT1_2, 4);
    expect(out.gdy).toBeCloseTo(Math.SQRT1_2, 4);
  });
});
