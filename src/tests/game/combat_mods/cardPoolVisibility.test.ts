import { describe, expect, test } from "vitest";
import { getEligibleCardPool } from "../../../game/combat_mods/rewards/cardPool";

function idsFor(characterId: string): string[] {
  return getEligibleCardPool(characterId).map((c) => c.id);
}

describe("cardPool character visibility", () => {
  test("HOBO pool includes poison and excludes ignite", () => {
    const ids = idsFor("HOBO");
    expect(ids.some((id) => id.includes("POISON"))).toBe(true);
    expect(ids.some((id) => id.includes("IGNITE"))).toBe(false);
  });

  test("JOEY pool includes ignite and excludes poison", () => {
    const ids = idsFor("JOEY");
    expect(ids.some((id) => id.includes("IGNITE"))).toBe(true);
    expect(ids.some((id) => id.includes("POISON"))).toBe(false);
  });

  test("neutral cards remain available for both HOBO and JOEY", () => {
    const hobo = idsFor("HOBO");
    const joey = idsFor("JOEY");
    expect(hobo).toContain("CARD_DAMAGE_FLAT_1");
    expect(joey).toContain("CARD_DAMAGE_FLAT_1");
  });
});
