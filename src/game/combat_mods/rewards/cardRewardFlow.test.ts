import { describe, expect, test } from "vitest";
import { beginCardReward, chooseCardReward, ensureCardRewardState } from "./cardRewardFlow";
import { getCardById } from "../content/cards/cardPool";

function createWorld(seed = 123, currentCharacterId?: string): any {
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
    currentCharacterId,
    baseMoveSpeed: 100,
    basePickupRadius: 32,
    pSpeed: 100,
    pickupRadius: 32,
    maxArmor: 50,
    currentArmor: 0,
    momentumMax: 20,
    momentumValue: 0,
    dmgMult: 1,
    fireRateMult: 1,
    areaMult: 1,
    durationMult: 1,
    critChanceBonus: 0,
    items: [],
    relics: [],
    playerHpMax: 100,
    basePlayerHpMax: 100,
    playerHp: 100,
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

  test("HOBO reward options exclude physical-tagged cards", () => {
    const w = createWorld(91, "HOBO");
    beginCardReward(w, "ZONE_TRIAL", 3);
    for (const id of ensureCardRewardState(w).options) {
      const card = getCardById(id);
      expect(card).toBeTruthy();
      if (!card) continue;
      expect(card.tags.includes("physical")).toBe(false);
    }
  });

  test("JOEY reward options exclude fires/hit/projectile/crit-tagged cards", () => {
    const w = createWorld(92, "JOEY");
    beginCardReward(w, "ZONE_TRIAL", 3);
    for (const id of ensureCardRewardState(w).options) {
      const card = getCardById(id);
      expect(card).toBeTruthy();
      if (!card) continue;
      expect(card.tags.includes("fires")).toBe(false);
      expect(card.tags.includes("hit")).toBe(false);
      expect(card.tags.includes("projectile")).toBe(false);
      expect(card.tags.includes("crit")).toBe(false);
    }
  });
});
