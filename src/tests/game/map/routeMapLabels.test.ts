import { describe, expect, it } from "vitest";
import { floorArchetypeDisplayLabel } from "../../../game/map/floorArchetype";
import type { FloorArchetype } from "../../../game/map/floorArchetype";

describe("floorArchetypeDisplayLabel", () => {
  it.each<[FloorArchetype, string]>([
    ["SURVIVE", "Survive"],
    ["TIME_TRIAL", "Zone Trial"],
    ["VENDOR", "Vendor"],
    ["HEAL", "Heal"],
    ["ACT_BOSS", "Boss"],
    ["RARE_TRIPLE", "3 Rares"],
  ])('archetype %s maps to label "%s"', (archetype, expected) => {
    expect(floorArchetypeDisplayLabel(archetype)).toBe(expected);
  });

  it('RARE_TRIPLE renders exactly as "3 Rares"', () => {
    expect(floorArchetypeDisplayLabel("RARE_TRIPLE")).toBe("3 Rares");
  });

  it("all labels are non-empty readable strings (no raw abbreviations)", () => {
    const archetypes: FloorArchetype[] = [
      "SURVIVE",
      "TIME_TRIAL",
      "VENDOR",
      "HEAL",
      "ACT_BOSS",
      "RARE_TRIPLE",
    ];
    const abbreviationPattern = /^[A-Z_]{2,}$/;
    for (const archetype of archetypes) {
      const label = floorArchetypeDisplayLabel(archetype);
      expect(label.length).toBeGreaterThan(0);
      expect(abbreviationPattern.test(label)).toBe(false);
    }
  });
});
