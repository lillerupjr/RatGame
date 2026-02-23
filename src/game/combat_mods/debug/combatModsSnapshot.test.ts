import { describe, expect, test } from "vitest";
import { aggregateCardCounts, getCombatModsSnapshot } from "./combatModsSnapshot";

describe("combatModsSnapshot", () => {
  test("aggregateCardCounts groups duplicates into xN", () => {
    const out = aggregateCardCounts([
      "CARD_DAMAGE_FLAT_1",
      "CARD_DAMAGE_FLAT_1",
      "CARD_IGNITE_CHANCE_1",
    ]);
    const dmg = out.find((e) => e.id === "CARD_DAMAGE_FLAT_1");
    const ign = out.find((e) => e.id === "CARD_IGNITE_CHANCE_1");
    expect(dmg?.count).toBe(2);
    expect(ign?.count).toBe(1);
  });

  test("getCombatModsSnapshot resolves baseline stats with no cards", () => {
    const snap = getCombatModsSnapshot({ cards: [] });
    expect(snap.weaponStats.shotsPerSecond).toBeCloseTo(3.0);
    expect(snap.weaponStats.baseDamage.physical).toBeGreaterThan(0);
  });

  test("getCombatModsSnapshot reads world.cards and applies mods", () => {
    const snap = getCombatModsSnapshot({ cards: ["CARD_DAMAGE_FLAT_1"] });
    // Base pistol phys 8 + 3 = 11 (no other scaling)
    expect(snap.weaponStats.baseDamage.physical).toBeCloseTo(11);
  });
});
