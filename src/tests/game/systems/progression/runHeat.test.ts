import { describe, expect, test } from "vitest";
import {
  commitFloorClear,
  normalizedRunHeat,
  resetFloorClearCommit,
} from "../../../../game/systems/progression/runHeat";

describe("runHeat progression", () => {
  test("commits exactly once until reset", () => {
    const state = {
      runHeat: 0,
      floorClearCommitted: false,
    };

    expect(commitFloorClear(state)).toBe(true);
    expect(state.runHeat).toBe(1);
    expect(state.floorClearCommitted).toBe(true);

    expect(commitFloorClear(state)).toBe(false);
    expect(state.runHeat).toBe(1);

    resetFloorClearCommit(state);
    expect(state.floorClearCommitted).toBe(false);

    expect(commitFloorClear(state)).toBe(true);
    expect(state.runHeat).toBe(2);
  });

  test("normalizes invalid heat values", () => {
    expect(normalizedRunHeat(NaN)).toBe(0);
    expect(normalizedRunHeat(-8)).toBe(0);
    expect(normalizedRunHeat(4.8)).toBe(4);
  });

  test("duplicate completion signals cannot increment heat twice in one floor", () => {
    const state = {
      runHeat: 0,
      floorClearCommitted: false,
    };

    expect(commitFloorClear(state)).toBe(true);
    expect(state.runHeat).toBe(1);

    expect(commitFloorClear(state)).toBe(false);
    expect(state.runHeat).toBe(1);
    expect(state.floorClearCommitted).toBe(true);

    resetFloorClearCommit(state);
    expect(commitFloorClear(state)).toBe(true);
    expect(state.runHeat).toBe(2);
  });
});
