import { describe, expect, test } from "vitest";
import { resolveProjectileDamagePacket } from "./critDamagePacket";

describe("resolveProjectileDamagePacket", () => {
  test("critChance=1 multiplies all damage types", () => {
    const out = resolveProjectileDamagePacket(
      {
        physical: 10,
        fire: 5,
        chaos: 2,
        critChance: 1,
        critMulti: 1.5,
      },
      0.42
    );

    expect(out.isCrit).toBe(true);
    expect(out.physical).toBeCloseTo(15);
    expect(out.fire).toBeCloseTo(7.5);
    expect(out.chaos).toBeCloseTo(3);
    expect(out.total).toBeCloseTo(25.5);
  });

  test("critChance=0 never multiplies", () => {
    const out = resolveProjectileDamagePacket(
      {
        physical: 10,
        fire: 5,
        chaos: 2,
        critChance: 0,
        critMulti: 1.5,
      },
      0.0
    );

    expect(out.isCrit).toBe(false);
    expect(out.physical).toBeCloseTo(10);
    expect(out.fire).toBeCloseTo(5);
    expect(out.chaos).toBeCloseTo(2);
    expect(out.total).toBeCloseTo(17);
  });
});
