import { describe, expect, test } from "vitest";
import { isCardVisibleForCharacter, isIgniteCard, isPoisonCard } from "../../../game/combat_mods/rewards/cardVisibilityPolicy";

describe("cardVisibilityPolicy", () => {
  test("classifies poison and ignite cards by id", () => {
    expect(isPoisonCard("CARD_POISON_CHANCE_1")).toBe(true);
    expect(isIgniteCard("CARD_IGNITE_CHANCE_1")).toBe(true);
    expect(isPoisonCard("CARD_DAMAGE_FLAT_1")).toBe(false);
    expect(isIgniteCard("CARD_DAMAGE_FLAT_1")).toBe(false);
  });

  test("poison cards are visible only for HOBO", () => {
    expect(isCardVisibleForCharacter("CARD_POISON_CHANCE_1", "HOBO")).toBe(true);
    expect(isCardVisibleForCharacter("CARD_POISON_CHANCE_1", "JOEY")).toBe(false);
    expect(isCardVisibleForCharacter("CARD_POISON_CHANCE_1", "JACK")).toBe(false);
  });

  test("ignite cards are visible only for JOEY", () => {
    expect(isCardVisibleForCharacter("CARD_IGNITE_CHANCE_1", "JOEY")).toBe(true);
    expect(isCardVisibleForCharacter("CARD_IGNITE_CHANCE_1", "HOBO")).toBe(false);
    expect(isCardVisibleForCharacter("CARD_IGNITE_CHANCE_1", "JACK")).toBe(false);
  });

  test("neutral cards are visible for all characters", () => {
    expect(isCardVisibleForCharacter("CARD_DAMAGE_FLAT_1", "JOEY")).toBe(true);
    expect(isCardVisibleForCharacter("CARD_DAMAGE_FLAT_1", "HOBO")).toBe(true);
    expect(isCardVisibleForCharacter("CARD_DAMAGE_FLAT_1", "JACK")).toBe(true);
  });
});
