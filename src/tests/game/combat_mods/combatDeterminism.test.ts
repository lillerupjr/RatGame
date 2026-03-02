import { describe, test, expect } from "vitest";
import { getCombatModsSnapshot } from "../../../game/combat_mods/debug/combatModsSnapshot";

function createMockWorld(seed: number, cards: string[]) {
  return {
    seed,
    cards,
  };
}

describe("Combat Mods determinism", () => {
  test("snapshot resolves identically for same input", () => {
    const w1 = createMockWorld(123, ["CARD_DAMAGE_FLAT_1"]);
    const w2 = createMockWorld(123, ["CARD_DAMAGE_FLAT_1"]);

    const s1 = getCombatModsSnapshot(w1);
    const s2 = getCombatModsSnapshot(w2);

    expect(s1.weaponStats.shotsPerSecond)
      .toBeCloseTo(s2.weaponStats.shotsPerSecond);

    expect(s1.weaponStats.baseDamage.physical)
      .toBeCloseTo(s2.weaponStats.baseDamage.physical);

    expect(s1.weaponStats.baseDamage.fire)
      .toBeCloseTo(s2.weaponStats.baseDamage.fire);

    expect(s1.weaponStats.baseDamage.chaos)
      .toBeCloseTo(s2.weaponStats.baseDamage.chaos);
  });

  test("card stacking is deterministic", () => {
    const baseSnap = getCombatModsSnapshot(createMockWorld(1, []));
    const w = createMockWorld(1, [
      "CARD_DAMAGE_FLAT_1",
      "CARD_DAMAGE_FLAT_1",
      "CARD_DAMAGE_FLAT_1"
    ]);

    const snap = getCombatModsSnapshot(w);

    expect(snap.cards.find(c => c.id === "CARD_DAMAGE_FLAT_1")?.count)
      .toBe(3);

    expect(snap.weaponStats.baseDamage.physical)
      .toBeCloseTo(baseSnap.weaponStats.baseDamage.physical + 9);
  });
});
