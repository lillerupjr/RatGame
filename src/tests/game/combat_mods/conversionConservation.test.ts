import { describe, test, expect } from "vitest";
import { applyConversionPriorityFill } from "../../../game/combat_mods/damage/conversion";

function sum(d: {physical:number, fire:number, chaos:number}) {
  return d.physical + d.fire + d.chaos;
}

describe("conversion conservation", () => {
  test("conversion preserves total damage", () => {
    const base = { physical: 100, fire: 0, chaos: 0 };

    const out = applyConversionPriorityFill(base, {
      physToFire: 0.5,
      physToChaos: 0.5,
      fireToChaos: 0,
    });

    expect(sum(out)).toBeCloseTo(sum(base));
  });

  test("conversion with chained fire->chaos preserves damage", () => {
    const base = { physical: 100, fire: 0, chaos: 0 };

    const out = applyConversionPriorityFill(base, {
      physToFire: 1.0,
      physToChaos: 0,
      fireToChaos: 0.25,
    });

    expect(sum(out)).toBeCloseTo(sum(base));
  });
});
