import { describe, expect, test } from "vitest";
import { WEAPONS } from "../../../game/content/weapons";
import { PLAYABLE_CHARACTERS } from "../../../game/content/playableCharacters";

describe("weapon catalog migration", () => {
  test("bazooka weapons are removed from weapon defs", () => {
    expect((WEAPONS as Record<string, unknown>).BAZOOKA).toBeUndefined();
    expect((WEAPONS as Record<string, unknown>).BAZOOKA_EVOLVED).toBeUndefined();
  });

  test("no playable character starts with bazooka", () => {
    for (const ch of PLAYABLE_CHARACTERS) {
      expect(ch.startingWeaponId).not.toBe("BAZOOKA" as any);
    }
  });
});
