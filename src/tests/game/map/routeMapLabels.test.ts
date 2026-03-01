import { describe, expect, it } from "vitest";
import { floorArchetypeDisplayLabel } from "../../../game/map/floorArchetype";
import type { FloorArchetype } from "../../../game/map/floorArchetype";

describe("floorArchetypeDisplayLabel", () => {
  it.each<[FloorArchetype, string]>([
    ["SURVIVE", "Survive"],
    ["TIME_TRIAL", "Zone Trial"],
    ["VENDOR", "Vendor"],
    ["HEAL", "Heal"],
    ["BOSS_TRIPLE", "3 Bosses"],
  ])('archetype %s maps to label "%s"', (archetype, expected) => {
    expect(floorArchetypeDisplayLabel(archetype)).toBe(expected);
  });

  it('BOSS_TRIPLE renders exactly as "3 Bosses"', () => {
    expect(floorArchetypeDisplayLabel("BOSS_TRIPLE")).toBe("3 Bosses");
  });

  it("all labels are non-empty readable strings (no raw abbreviations)", () => {
    const archetypes: FloorArchetype[] = [
      "SURVIVE",
      "TIME_TRIAL",
      "VENDOR",
      "HEAL",
      "BOSS_TRIPLE",
    ];
    const abbreviationPattern = /^[A-Z_]{2,}$/;
    for (const archetype of archetypes) {
      const label = floorArchetypeDisplayLabel(archetype);
      expect(label.length).toBeGreaterThan(0);
      expect(abbreviationPattern.test(label)).toBe(false);
    }
  });
});
