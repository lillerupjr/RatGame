import { describe, expect, test } from "vitest";
import { coinColorFromValue, goldValueFromEnemyMaxHp } from "../../../game/economy/coins";

describe("coins", () => {
  test("gold value scales up with enemy max hp", () => {
    expect(goldValueFromEnemyMaxHp(1)).toBe(1);
    expect(goldValueFromEnemyMaxHp(24)).toBe(1);
    expect(goldValueFromEnemyMaxHp(25)).toBe(1);
    expect(goldValueFromEnemyMaxHp(50)).toBe(2);
    expect(goldValueFromEnemyMaxHp(125)).toBe(5);
  });

  test("coin color tiers map from copper to higher tiers", () => {
    expect(coinColorFromValue(1)).toBe("#b87333");
    expect(coinColorFromValue(2)).toBe("#c0c0c0");
    expect(coinColorFromValue(4)).toBe("#ffd700");
    expect(coinColorFromValue(8)).toBe("#8ecae6");
    expect(coinColorFromValue(16)).toBe("#67e8f9");
    expect(coinColorFromValue(32)).toBe("#a855f7");
    expect(coinColorFromValue(64)).toContain("hsl(");
  });
});
