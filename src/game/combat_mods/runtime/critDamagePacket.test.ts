import { describe, expect, test } from "vitest";
import { resolveCritRoll01, resolveProjectileDamagePacket } from "./critDamagePacket";

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

  test("lucky crit second roll is consumed only when first fails", () => {
    const seq = [0.9, 0.1];
    const out = resolveCritRoll01(0.5, () => seq.shift() ?? 1, 2);
    expect(out.secondUsed).toBe(true);
    expect(out.roll01).toBeCloseTo(0.1);

    const seq2 = [0.1, 0.0];
    const out2 = resolveCritRoll01(0.5, () => seq2.shift() ?? 1, 2);
    expect(out2.secondUsed).toBe(false);
    expect(out2.roll01).toBeCloseTo(0.1);
  });
});
