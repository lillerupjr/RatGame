import { describe, expect, test } from "vitest";
import {
  FLOOR_END_COUNTDOWN_SEC,
  isFloorEndCountdownDone,
  maybeStartFloorEndCountdown,
  tickFloorEndCountdown,
} from "../../../../game/systems/progression/floorEndCountdown";

describe("floorEndCountdown", () => {
  test("starts exactly once per floor objective completion", () => {
    const w: any = {
      floorIndex: 2,
      runState: "FLOOR",
      objectiveStates: [{ status: "COMPLETED" }],
      floorEndCountdownActive: false,
      floorEndCountdownSec: 0,
      floorEndCountdownStartedKey: null,
    };

    const first = maybeStartFloorEndCountdown(w);
    const second = maybeStartFloorEndCountdown(w);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(w.floorEndCountdownActive).toBe(true);
    expect(w.floorEndCountdownSec).toBe(FLOOR_END_COUNTDOWN_SEC);
  });

  test("ticks to zero and reports done", () => {
    const w: any = {
      floorEndCountdownActive: true,
      floorEndCountdownSec: 10,
    };

    tickFloorEndCountdown(w, 9.1);
    expect(isFloorEndCountdownDone(w)).toBe(false);

    tickFloorEndCountdown(w, 1.0);
    expect(w.floorEndCountdownSec).toBe(0);
    expect(isFloorEndCountdownDone(w)).toBe(true);
  });

  test("completion can be deferred while reward is open", () => {
    const w: any = {
      floorEndCountdownActive: true,
      floorEndCountdownSec: 0,
      state: "REWARD",
    };
    expect(isFloorEndCountdownDone(w)).toBe(true);
    expect(w.state).toBe("REWARD");
  });
});

