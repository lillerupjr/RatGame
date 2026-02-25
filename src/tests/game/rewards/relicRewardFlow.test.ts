import { describe, expect, test } from "vitest";
import {
  beginRelicReward,
  chooseRelicReward,
  ensureRelicRewardState,
} from "../../../game/combat_mods/rewards/relicRewardFlow";

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
    relics: [] as string[],
  };
}

describe("relicRewardFlow", () => {
  test("beginRelicReward creates deterministic options", () => {
    const w1 = createWorld(999);
    const w2 = createWorld(999);
    beginRelicReward(w1, "OBJECTIVE_COMPLETION", 3);
    beginRelicReward(w2, "OBJECTIVE_COMPLETION", 3);

    expect(ensureRelicRewardState(w1).active).toBe(true);
    expect(ensureRelicRewardState(w1).options.length).toBe(3);
    expect(ensureRelicRewardState(w1).options).toEqual(ensureRelicRewardState(w2).options);
  });

  test("chooseRelicReward applies selected relic, dedupes, and clears state", () => {
    const w = createWorld(77);
    beginRelicReward(w, "OBJECTIVE_COMPLETION", 3);
    const pick = ensureRelicRewardState(w).options[0];

    w.relics = [pick];
    chooseRelicReward(w, pick);

    expect(w.relics).toEqual([pick]);
    expect(ensureRelicRewardState(w).active).toBe(false);
    expect(ensureRelicRewardState(w).options).toEqual([]);
  });
});
