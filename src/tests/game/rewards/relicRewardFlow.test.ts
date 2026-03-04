import { describe, expect, test } from "vitest";
import { createWorld as createGameWorld } from "../../../engine/world/world";
import { stageDocks } from "../../../game/content/stages";
import { applyCardToWorld } from "../../../game/combat_mods/rewards/cardApply";
import {
  beginRelicReward,
  chooseRelicReward,
  ensureRelicRewardState,
} from "../../../game/combat_mods/rewards/relicRewardFlow";

function createStubWorld(seed = 123): any {
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
    const w1 = createStubWorld(999);
    const w2 = createStubWorld(999);
    beginRelicReward(w1, "OBJECTIVE_COMPLETION", 3);
    beginRelicReward(w2, "OBJECTIVE_COMPLETION", 3);

    expect(ensureRelicRewardState(w1).active).toBe(true);
    expect(ensureRelicRewardState(w1).options.length).toBe(3);
    expect(ensureRelicRewardState(w1).options).toEqual(ensureRelicRewardState(w2).options);
  });

  test("chooseRelicReward applies selected relic, dedupes, and clears state", () => {
    const w = createStubWorld(77);
    beginRelicReward(w, "OBJECTIVE_COMPLETION", 3);
    const pick = ensureRelicRewardState(w).options[0];

    w.relics = [pick];
    chooseRelicReward(w, pick);

    expect(w.relics).toEqual([pick]);
    expect(ensureRelicRewardState(w).active).toBe(false);
    expect(ensureRelicRewardState(w).options).toEqual([]);
  });

  test("beginRelicReward excludes already-owned relics", () => {
    const w = createStubWorld(42);
    w.relics = ["relic_berserker", "relic_bigPockets"];
    beginRelicReward(w, "OBJECTIVE_COMPLETION", 3);
    const options = ensureRelicRewardState(w).options;
    expect(options.includes("relic_berserker")).toBe(false);
    expect(options.includes("relic_bigPockets")).toBe(false);
  });

  test("chooseRelicReward immediately recomputes and clamps HP", () => {
    const w = createGameWorld({ seed: 778, stage: stageDocks });
    applyCardToWorld(w, "CARD_LIFE_3");
    w.playerHp = 175;
    const state = ensureRelicRewardState(w);
    state.active = true;
    state.options = ["SPEC_DAMAGE_MORE_200_MAX_LIFE_LESS_50"];

    chooseRelicReward(w, "SPEC_DAMAGE_MORE_200_MAX_LIFE_LESS_50");

    expect(w.relics).toContain("SPEC_DAMAGE_MORE_200_MAX_LIFE_LESS_50");
    expect(w.playerHpMax).toBe(87);
    expect(w.playerHp).toBe(87);
    expect(state.active).toBe(false);
    expect(state.options).toEqual([]);
  });
});
