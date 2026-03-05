import { describe, expect, test } from "vitest";
import {
  BOSS_GOLD_MULTIPLIER,
  GOLD_PER_HP,
  coinColorFromValue,
  goldValueFromEnemyBaseLife,
} from "../../../game/economy/coins";

describe("coins", () => {
  test("gold value is derived from base life (floor(baseLife * GOLD_PER_HP))", () => {
    expect(goldValueFromEnemyBaseLife(24)).toBe(Math.floor(24 * GOLD_PER_HP));
    expect(goldValueFromEnemyBaseLife(64)).toBe(Math.floor(64 * GOLD_PER_HP));
    expect(goldValueFromEnemyBaseLife(240)).toBe(Math.floor(240 * GOLD_PER_HP));
    expect(goldValueFromEnemyBaseLife(80, { isBoss: true })).toBe(
      Math.floor(Math.floor(80 * GOLD_PER_HP) * BOSS_GOLD_MULTIPLIER)
    );
  });

  test("coin fallback color stays fixed across values", () => {
    expect(coinColorFromValue(1)).toBe("#ffd700");
    expect(coinColorFromValue(4)).toBe("#ffd700");
    expect(coinColorFromValue(128)).toBe("#ffd700");
  });
});
