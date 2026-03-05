import { describe, expect, test } from "vitest";
import {
  BOSS_GOLD_MULTIPLIER,
  GOLD_PER_HP,
  baseGoldFromEnemyBaseLife,
  coinColorFromValue,
  goldValueFromEnemyBaseLife,
} from "../../../game/economy/coins";

describe("coins", () => {
  test("base gold clamps to at least 1 from base life", () => {
    expect(baseGoldFromEnemyBaseLife(0)).toBe(1);
    expect(baseGoldFromEnemyBaseLife(10)).toBe(1);
    expect(baseGoldFromEnemyBaseLife(64)).toBe(Math.floor(64 * GOLD_PER_HP));
  });

  test("boss multiplier applies after base-life calculation", () => {
    expect(goldValueFromEnemyBaseLife(0)).toBe(1);
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
