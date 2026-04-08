import { describe, expect, test } from "vitest";
import {
  isCardVisibleForCharacter,
  isCardVisibleForWeapon,
} from "../../../game/combat_mods/rewards/cardVisibilityPolicy";
import { getCardById } from "../../../game/combat_mods/content/cards/cardPool";
import { HOBO_SYRINGE_V1 } from "../../../game/combat_mods/content/weapons/hoboSyringe";
import { JACK_PISTOL_V1 } from "../../../game/combat_mods/content/weapons/jackPistol";
import { JOEY_RIFLE_V1 } from "../../../game/combat_mods/content/weapons/joeyRifle";
import type { CardDef } from "../../../game/combat_mods/stats/modifierTypes";

describe("cardVisibilityPolicy", () => {
  test("uses single-overlap (OR) matching for non-global tags", () => {
    const poison = getCardById("CARD_POISON_CHANCE_1");
    const ignite = getCardById("CARD_IGNITE_CHANCE_1");
    const fireRate = getCardById("CARD_FIRE_RATE_1");
    const crit = getCardById("CARD_CRIT_CHANCE_1");
    const projectile = getCardById("CARD_PROJECTILE_1");
    const flatPhysical = getCardById("CARD_DAMAGE_FLAT_1");
    if (!poison || !ignite || !fireRate || !crit || !projectile || !flatPhysical) {
      throw new Error("Expected core cards to exist");
    }

    const mockAnyOverlap: CardDef = {
      id: "MOCK_ANY_OVERLAP",
      isEnabled: true,
      displayName: "mock",
      rarity: 1,
      powerTier: 1,
      tags: ["chaos", "fires"],
      mods: [],
    };
    const mockNoOverlap: CardDef = {
      id: "MOCK_NO_OVERLAP",
      isEnabled: true,
      displayName: "mock",
      rarity: 1,
      powerTier: 1,
      tags: ["chaos"],
      mods: [],
    };

    expect(isCardVisibleForWeapon(mockAnyOverlap, JACK_PISTOL_V1.tags)).toBe(true);
    expect(isCardVisibleForWeapon(mockNoOverlap, JACK_PISTOL_V1.tags)).toBe(false);

    expect(isCardVisibleForWeapon(poison, HOBO_SYRINGE_V1.tags)).toBe(true);
    expect(isCardVisibleForWeapon(poison, JACK_PISTOL_V1.tags)).toBe(false);
    expect(isCardVisibleForWeapon(poison, JOEY_RIFLE_V1.tags)).toBe(false);
    expect(isCardVisibleForWeapon(ignite, JOEY_RIFLE_V1.tags)).toBe(true);
    expect(isCardVisibleForWeapon(ignite, JACK_PISTOL_V1.tags)).toBe(false);
    expect(isCardVisibleForWeapon(fireRate, JACK_PISTOL_V1.tags)).toBe(true);
    expect(isCardVisibleForWeapon(fireRate, JOEY_RIFLE_V1.tags)).toBe(false);
    expect(isCardVisibleForWeapon(crit, JACK_PISTOL_V1.tags)).toBe(true);
    expect(isCardVisibleForWeapon(crit, JOEY_RIFLE_V1.tags)).toBe(false);
    expect(isCardVisibleForWeapon(projectile, JACK_PISTOL_V1.tags)).toBe(true);
    expect(isCardVisibleForWeapon(projectile, JOEY_RIFLE_V1.tags)).toBe(false);
    expect(isCardVisibleForWeapon(flatPhysical, JACK_PISTOL_V1.tags)).toBe(true);
    expect(isCardVisibleForWeapon(flatPhysical, HOBO_SYRINGE_V1.tags)).toBe(false);
    expect(isCardVisibleForWeapon(flatPhysical, JOEY_RIFLE_V1.tags)).toBe(false);
  });

  test("global life/defense tags bypass overlap matching", () => {
    const life = getCardById("CARD_LIFE_1");
    const defense = getCardById("CARD_DAMAGE_REDUCTION_1");
    if (!life || !defense) throw new Error("Expected global cards to exist");

    expect(isCardVisibleForWeapon(life, JACK_PISTOL_V1.tags)).toBe(true);
    expect(isCardVisibleForWeapon(life, JOEY_RIFLE_V1.tags)).toBe(true);
    expect(isCardVisibleForWeapon(defense, JACK_PISTOL_V1.tags)).toBe(false); // disabled card
    expect(isCardVisibleForWeapon(defense, JOEY_RIFLE_V1.tags)).toBe(false); // disabled card
  });

  test("cards must be enabled and tagged unless global", () => {
    const mockUntyped: CardDef = {
      id: "MOCK_UNTAGGED",
      isEnabled: true,
      displayName: "mock",
      rarity: 1,
      powerTier: 1,
      tags: [],
      mods: [],
    };
    expect(isCardVisibleForWeapon(mockUntyped, JACK_PISTOL_V1.tags)).toBe(false);

    const mockDisabled: CardDef = {
      id: "MOCK_DISABLED",
      isEnabled: false,
      displayName: "mock",
      rarity: 1,
      powerTier: 1,
      tags: ["life"],
      mods: [],
    };
    expect(isCardVisibleForWeapon(mockDisabled, JACK_PISTOL_V1.tags)).toBe(false);
  });

  test("card-id API resolves visibility by character starter weapon tags", () => {
    expect(isCardVisibleForCharacter("CARD_DAMAGE_INC_1", "JOEY")).toBe(true);
    expect(isCardVisibleForCharacter("CARD_DAMAGE_FLAT_1", "JOEY")).toBe(false);
    expect(isCardVisibleForCharacter("CARD_IGNITE_CHANCE_1", "JACK")).toBe(false);
    expect(isCardVisibleForCharacter("CARD_IGNITE_CHANCE_1", "JOEY")).toBe(true);
    expect(isCardVisibleForCharacter("CARD_POISON_CHANCE_1", "JACK")).toBe(false);
    expect(isCardVisibleForCharacter("CARD_POISON_CHANCE_1", "HOBO")).toBe(true);
    expect(isCardVisibleForCharacter("CARD_DOES_NOT_EXIST", "HOBO")).toBe(false);
  });
});
