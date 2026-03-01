import { describe, expect, it } from "vitest";
import { recomputeDerivedStats } from "../../../game/stats/derivedStats";

/**
 * Minimal stub world that satisfies the fields touched by recomputeDerivedStats.
 * We only care about the card → playerHpMax pipeline here.
 */
function stubWorld(overrides: Record<string, unknown> = {}): any {
  return {
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
    cards: [],
    playerHpMax: 100,
    playerHp: 100,
    ...overrides,
  };
}

describe("recomputeDerivedStats – card LIFE_ADD", () => {
  it("CARD_LIFE_1 adds +25 max life", () => {
    const w = stubWorld({ cards: ["CARD_LIFE_1"] });
    recomputeDerivedStats(w);
    expect(w.playerHpMax).toBe(125);
  });

  it("CARD_LIFE_2 adds +50 max life", () => {
    const w = stubWorld({ cards: ["CARD_LIFE_2"] });
    recomputeDerivedStats(w);
    expect(w.playerHpMax).toBe(150);
  });

  it("CARD_LIFE_3 adds +75 max life", () => {
    const w = stubWorld({ cards: ["CARD_LIFE_3"] });
    recomputeDerivedStats(w);
    expect(w.playerHpMax).toBe(175);
  });

  it("stacking CARD_LIFE_1 + CARD_LIFE_2 adds +75 total", () => {
    const w = stubWorld({ cards: ["CARD_LIFE_1", "CARD_LIFE_2"] });
    recomputeDerivedStats(w);
    expect(w.playerHpMax).toBe(175);
  });

  it("stacking all three life cards adds +150 total", () => {
    const w = stubWorld({ cards: ["CARD_LIFE_1", "CARD_LIFE_2", "CARD_LIFE_3"] });
    recomputeDerivedStats(w);
    expect(w.playerHpMax).toBe(250);
  });

  it("non-life cards do not affect playerHpMax", () => {
    // CARD_PHYS_1 adds physical damage, not life
    const w = stubWorld({ cards: ["CARD_PHYS_1"] });
    recomputeDerivedStats(w);
    expect(w.playerHpMax).toBe(100);
  });

  it("unknown card IDs are safely skipped", () => {
    const w = stubWorld({ cards: ["DOES_NOT_EXIST"] });
    recomputeDerivedStats(w);
    expect(w.playerHpMax).toBe(100);
  });

  it("playerHp is clamped to new playerHpMax (no free heal)", () => {
    const w = stubWorld({ cards: ["CARD_LIFE_1"], playerHp: 50 });
    recomputeDerivedStats(w);
    expect(w.playerHpMax).toBe(125);
    expect(w.playerHp).toBe(50); // not healed, just clamped
  });
});

