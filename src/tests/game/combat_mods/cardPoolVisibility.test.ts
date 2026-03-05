import { describe, expect, test } from "vitest";
import { getEligibleCardPool } from "../../../game/combat_mods/rewards/cardPool";
import { getCardById } from "../../../game/combat_mods/content/cards/cardPool";

function idsFor(characterId: string): string[] {
  return getEligibleCardPool(characterId).map((c) => c.id);
}

describe("cardPool character visibility", () => {
  test("JOEY laser pool excludes fires/hit/projectile/crit cards", () => {
    const ids = idsFor("JOEY");
    for (const id of ids) {
      const card = getCardById(id);
      expect(card).toBeTruthy();
      if (!card) continue;
      expect(card.tags.includes("fires")).toBe(false);
      expect(card.tags.includes("hit")).toBe(false);
      expect(card.tags.includes("projectile")).toBe(false);
      expect(card.tags.includes("crit")).toBe(false);
    }

    expect(ids).not.toContain("CARD_FIRE_RATE_1");
    expect(ids).not.toContain("CARD_CRIT_CHANCE_1");
    expect(ids).not.toContain("CARD_DAMAGE_FLAT_1");
    expect(ids).not.toContain("CARD_PROJECTILE_1");
    expect(ids).not.toContain("CARD_IGNITE_CHANCE_1");
  });

  test("JOEY laser pool keeps global and gun cards", () => {
    const ids = idsFor("JOEY");
    expect(ids).toContain("CARD_DAMAGE_INC_1");
    expect(ids).toContain("CARD_LIFE_1");
  });

  test("JACK pistol pool includes expected overlap cards and excludes chaos-only cards", () => {
    const ids = idsFor("JACK");
    expect(ids).toContain("CARD_FIRE_RATE_1");
    expect(ids).toContain("CARD_CRIT_CHANCE_1");
    expect(ids).toContain("CARD_DAMAGE_FLAT_1");
    expect(ids).toContain("CARD_PROJECTILE_1");
    expect(ids).toContain("CARD_DAMAGE_INC_1");
    expect(ids).not.toContain("CARD_POISON_CHANCE_1");
  });
});
