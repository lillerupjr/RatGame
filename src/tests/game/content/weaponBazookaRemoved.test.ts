import { describe, expect, test } from "vitest";
import { COMBAT_STARTER_WEAPONS } from "../../../game/combat_mods/content/weapons/starterWeapons";
import { resolveCombatStarterWeaponId } from "../../../game/combat_mods/content/weapons/characterStarterMap";
import { PLAYABLE_CHARACTERS } from "../../../game/content/playableCharacters";

describe("weapon catalog migration", () => {
  test("bazooka weapons are removed from starter combat catalog", () => {
    expect((COMBAT_STARTER_WEAPONS as Record<string, unknown>).BAZOOKA).toBeUndefined();
    expect((COMBAT_STARTER_WEAPONS as Record<string, unknown>).BAZOOKA_EVOLVED).toBeUndefined();
  });

  test("no playable character resolves to bazooka starter", () => {
    for (const ch of PLAYABLE_CHARACTERS) {
      const starterId = resolveCombatStarterWeaponId(ch.id);
      expect(starterId).not.toBe("BAZOOKA" as any);
      expect(starterId).not.toBe("BAZOOKA_EVOLVED" as any);
      expect((COMBAT_STARTER_WEAPONS as Record<string, unknown>)[starterId]).toBeTruthy();
    }
  });
});
