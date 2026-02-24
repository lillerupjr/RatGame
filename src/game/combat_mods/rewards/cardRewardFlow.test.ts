import { describe, expect, test } from "vitest";
import { beginCardReward, chooseCardReward, ensureCardRewardState } from "./cardRewardFlow";

function createWorld(seed = 123): any {
  let s = seed >>> 0;
  const next = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };
  return {
    rng: { next },
    cards: [] as string[],
  };
}

describe("cardRewardFlow", () => {
  test("beginCardReward creates deterministic options", () => {
    const w1 = createWorld(999);
    const w2 = createWorld(999);

    beginCardReward(w1, "ZONE_TRIAL", 3);
    beginCardReward(w2, "ZONE_TRIAL", 3);

    expect(ensureCardRewardState(w1).active).toBe(true);
    expect(ensureCardRewardState(w1).options.length).toBe(3);
    expect(ensureCardRewardState(w1).options).toEqual(ensureCardRewardState(w2).options);
  });

  test("chooseCardReward applies selected card and clears state", () => {
    const w = createWorld(77);
    beginCardReward(w, "BOSS_CHEST", 3);
    const pick = ensureCardRewardState(w).options[0];

    chooseCardReward(w, pick);

    expect(w.cards).toContain(pick);
    expect(ensureCardRewardState(w).active).toBe(false);
    expect(ensureCardRewardState(w).options).toEqual([]);
  });

  test("chooseCardReward rejects invalid card id", () => {
    const w = createWorld(88);
    beginCardReward(w, "ZONE_TRIAL", 3);

    expect(() => chooseCardReward(w, "NOT_IN_OPTIONS")).toThrow();
  });
});
