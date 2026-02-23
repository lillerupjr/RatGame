import { describe, expect, test } from "vitest";
import { applyConversionPriorityFill } from "./conversion";

describe("applyConversionPriorityFill", () => {
  test("100% phys->fire consumes all phys; later phys->chaos gets nothing", () => {
    const out = applyConversionPriorityFill(
      { physical: 100, fire: 0, chaos: 0 },
      { physToFire: 1.0, physToChaos: 0.2, fireToChaos: 0 }
    );
    expect(out.physical).toBeCloseTo(0);
    expect(out.fire).toBeCloseTo(100);
    expect(out.chaos).toBeCloseTo(0);
  });

  test("phys->fire then phys->chaos uses remaining pool", () => {
    const out = applyConversionPriorityFill(
      { physical: 100, fire: 0, chaos: 0 },
      { physToFire: 0.5, physToChaos: 0.5, fireToChaos: 0 }
    );
    // After phys->fire: phys=50, fire=50
    // Then phys->chaos 50% of remaining phys => 25
    expect(out.physical).toBeCloseTo(25);
    expect(out.fire).toBeCloseTo(50);
    expect(out.chaos).toBeCloseTo(25);
  });

  test("fire->chaos converts remaining fire after phys conversions", () => {
    const out = applyConversionPriorityFill(
      { physical: 100, fire: 0, chaos: 0 },
      { physToFire: 1.0, physToChaos: 0, fireToChaos: 0.5 }
    );
    // phys->fire makes fire=100, then fire->chaos converts 50
    expect(out.physical).toBeCloseTo(0);
    expect(out.fire).toBeCloseTo(50);
    expect(out.chaos).toBeCloseTo(50);
  });

  test("clamps conversion rates to [0,1]", () => {
    const out = applyConversionPriorityFill(
      { physical: 10, fire: 0, chaos: 0 },
      { physToFire: 2, physToChaos: -1, fireToChaos: 0 }
    );
    // physToFire clamps to 1 => all phys->fire
    expect(out.physical).toBeCloseTo(0);
    expect(out.fire).toBeCloseTo(10);
    expect(out.chaos).toBeCloseTo(0);
  });
});
