import { describe, expect, test } from "vitest";
import { resolveCombatStarterStatCards } from "./characterStarterMods";
import { STAT_KEYS } from "../../stats/statKeys";

describe("resolveCombatStarterStatCards", () => {
  test("returns hidden +1 projectile starter bonus for JAMAL", () => {
    const cards = resolveCombatStarterStatCards("JAMAL");
    expect(cards.length).toBe(1);
    expect(cards[0].mods).toEqual([{ key: STAT_KEYS.PROJECTILES_ADD, op: "add", value: 1 }]);
  });

  test("returns no starter stat cards for other characters", () => {
    expect(resolveCombatStarterStatCards("JACK")).toEqual([]);
    expect(resolveCombatStarterStatCards("JOEY")).toEqual([]);
    expect(resolveCombatStarterStatCards("HOBO")).toEqual([]);
    expect(resolveCombatStarterStatCards("TOMMY")).toEqual([]);
    expect(resolveCombatStarterStatCards("UNKNOWN")).toEqual([]);
    expect(resolveCombatStarterStatCards()).toEqual([]);
  });
});
