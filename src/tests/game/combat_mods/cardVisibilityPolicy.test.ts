import { describe, expect, test } from "vitest";
import {
  isCardVisibleForCharacter,
  isCardVisibleForWeapon,
} from "../../../game/combat_mods/rewards/cardVisibilityPolicy";
import { getCardById } from "../../../game/combat_mods/content/cards/cardPool";
import { HOBO_SYRINGE_V1 } from "../../../game/combat_mods/content/weapons/hoboSyringe";
import { JACK_PISTOL_V1 } from "../../../game/combat_mods/content/weapons/jackPistol";
import { JOEY_RIFLE_V1 } from "../../../game/combat_mods/content/weapons/joeyRifle";

describe("cardVisibilityPolicy", () => {
  test("gates poison/ignite/bleed by weapon tags", () => {
    const poison = getCardById("CARD_POISON_CHANCE_1");
    const ignite = getCardById("CARD_IGNITE_CHANCE_1");
    const bleed = getCardById("CARD_BLEED_CHANCE_1");
    if (!poison || !ignite || !bleed) throw new Error("Expected core cards to exist");

    expect(isCardVisibleForWeapon(poison, HOBO_SYRINGE_V1.tags)).toBe(true);
    expect(isCardVisibleForWeapon(poison, JOEY_RIFLE_V1.tags)).toBe(false);
    expect(isCardVisibleForWeapon(ignite, JOEY_RIFLE_V1.tags)).toBe(true);
    expect(isCardVisibleForWeapon(ignite, JACK_PISTOL_V1.tags)).toBe(false);
    expect(isCardVisibleForWeapon(bleed, JACK_PISTOL_V1.tags)).toBe(true);
    expect(isCardVisibleForWeapon(bleed, HOBO_SYRINGE_V1.tags)).toBe(false);
  });

  test("backward-compat card-id API only checks card existence", () => {
    expect(isCardVisibleForCharacter("CARD_DAMAGE_FLAT_1", "JOEY")).toBe(true);
    expect(isCardVisibleForCharacter("CARD_POISON_CHANCE_1", "JACK")).toBe(true);
    expect(isCardVisibleForCharacter("CARD_DOES_NOT_EXIST", "HOBO")).toBe(false);
  });
});
